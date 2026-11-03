"""Medication Timeline Service for Rxify.

Builds the unified, longitudinal patient medication timeline, handles
patient confirmation actions, status updates with audit trails, and
prescription lineage retrieval.
"""

from __future__ import annotations

import datetime as _dt
from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn
from services.medication_reconciliation import (
    migrate_legacy_current_medications,
    reconcile_patient_prescriptions,
    enforce_newest_prescription_active_status,
    _to_date,
)


def _get_patient_id(patient_user_id: int) -> Optional[int]:
    """Resolve patient_id from users.user_id."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (patient_user_id,))
            row = cur.fetchone()
            return row[0] if row else None


def get_patient_medication_timeline(patient_user_id: int) -> Dict[str, Any]:
    """Retrieve the unified medication timeline and active regimen for a patient."""
    patient_id = _get_patient_id(patient_user_id)
    if not patient_id:
        return {
            "patient_id": None,
            "milestones": [],
            "flowchart_links": [],
            "active_now": [],
            "pending_confirmation": [],
            "courses": [],
            "summary": {
                "total_prescriptions": 0,
                "total_courses": 0,
                "active_now_count": 0,
                "needs_confirmation_count": 0,
                "on_hold_count": 0,
                "completed_count": 0,
                "discontinued_count": 0,
                "timeline_nodes_count": 0,
            },
        }

    # 1. Reconcile any unlinked prescriptions and migrate legacy records
    reconcile_patient_prescriptions(patient_id)
    migrate_legacy_current_medications(patient_id)
    enforce_newest_prescription_active_status(patient_id)

    today = _dt.date.today()

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 2. Fetch all medication courses for this patient
            cur.execute(
                """
                SELECT
                    mc.course_id,
                    mc.patient_id,
                    mc.canonical_medicine_id,
                    mc.display_name,
                    mc.generic_name,
                    mc.brand_name,
                    mc.rxcui,
                    mc.active_strength,
                    mc.active_dosage,
                    mc.active_frequency,
                    mc.active_form,
                    mc.start_date,
                    mc.end_date,
                    mc.expected_end_date,
                    mc.status,
                    mc.confirmation_status,
                    mc.status_source,
                    mc.is_chronic,
                    mc.notes,
                    mc.created_at,
                    mc.updated_at
                FROM medication_course mc
                WHERE mc.patient_id = %s
                ORDER BY mc.start_date ASC, mc.course_id ASC
                """,
                (patient_id,),
            )
            courses_raw = cur.fetchall()

            # 3. Fetch all prescription links for these courses
            cur.execute(
                """
                SELECT
                    mcp.link_id,
                    mcp.course_id,
                    mcp.prescription_id,
                    mcp.prescription_medicine_id,
                    mcp.prescribed_name,
                    mcp.prescribed_strength,
                    mcp.prescribed_dosage,
                    mcp.prescribed_frequency,
                    mcp.prescribed_duration,
                    mcp.prescribed_instructions,
                    mcp.event_type,
                    mcp.event_date,
                    mcp.doctor_id,
                    COALESCE(doc_u.full_name, 'Prescribing Doctor') AS doctor_name,
                    cl.name AS clinic_name,
                    rx.diagnosis,
                    rx.issue_date AS rx_issue_date
                FROM medication_course_prescription mcp
                JOIN prescription rx ON rx.prescription_id = mcp.prescription_id
                LEFT JOIN doctor doc ON doc.doctor_id = mcp.doctor_id
                LEFT JOIN users doc_u ON doc_u.user_id = doc.user_id
                LEFT JOIN clinic_hospital cl ON cl.clinic_id = rx.clinic_id
                WHERE rx.patient_id = %s
                ORDER BY mcp.event_date ASC, mcp.link_id ASC
                """,
                (patient_id,),
            )
            links_raw = cur.fetchall()

    # Group prescription links by course_id
    links_by_course: Dict[int, List[Dict[str, Any]]] = {}
    seen_prescriptions = set()
    for lk in links_raw:
        c_id = lk["course_id"]
        rx_id = lk["prescription_id"]
        if rx_id:
            seen_prescriptions.add(rx_id)
        if c_id not in links_by_course:
            links_by_course[c_id] = []
        links_by_course[c_id].append({
            "link_id": lk["link_id"],
            "prescription_id": lk["prescription_id"],
            "prescription_medicine_id": lk["prescription_medicine_id"],
            "prescribed_name": lk["prescribed_name"],
            "prescribed_strength": lk["prescribed_strength"],
            "prescribed_dosage": lk["prescribed_dosage"],
            "prescribed_frequency": lk["prescribed_frequency"],
            "prescribed_duration": lk["prescribed_duration"],
            "prescribed_instructions": lk["prescribed_instructions"],
            "event_type": lk["event_type"],
            "event_date": str(lk["event_date"]) if lk["event_date"] else None,
            "doctor_name": lk["doctor_name"],
            "clinic_name": lk["clinic_name"],
            "diagnosis": lk["diagnosis"],
        })

    # Identify the newest prescription ID for this patient
    newest_prescription_id = None
    if links_raw:
        sorted_links = sorted(
            links_raw,
            key=lambda lk: (_to_date(lk["event_date"]) or _dt.date.min, lk["prescription_id"] or 0),
            reverse=True,
        )
        if sorted_links:
            newest_prescription_id = sorted_links[0]["prescription_id"]

    # Assemble formatted courses
    formatted_courses = []
    active_now = []
    pending_confirmation = []
    on_hold_count = 0
    completed_count = 0
    discontinued_count = 0

    for c in courses_raw:
        c_id = c["course_id"]
        start_d = _to_date(c["start_date"])
        end_d = _to_date(c["end_date"])
        expected_end_d = _to_date(c["expected_end_date"])
        status = c["status"]
        conf_status = c["confirmation_status"]

        course_links = links_by_course.get(c_id, [])
        primary_link = course_links[0] if course_links else {}

        # Strictly enforce: ONLY medicines in the newest prescription can be ACTIVE
        is_in_newest_rx = any(
            lk.get("prescription_id") == newest_prescription_id for lk in course_links
        )

        effective_status = status
        if not is_in_newest_rx:
            if status == "ACTIVE":
                status = "COMPLETED"
            effective_status = "COMPLETED"
        else:
            if status == "ACTIVE" and expected_end_d and expected_end_d < today:
                effective_status = "COMPLETED"

        # Days on therapy calculation
        days_on_therapy = (today - start_d).days if start_d else 0
        if end_d and start_d:
            days_on_therapy = (end_d - start_d).days

        course_item = {
            "course_id": c_id,
            "current_medication_id": c_id,  # Backward compatibility field
            "name": c["display_name"],
            "generic_name": c["generic_name"],
            "brand_name": c["brand_name"],
            "rxcui": c["rxcui"],
            "strength": c["active_strength"],
            "dosage": c["active_dosage"],
            "frequency": c["active_frequency"],
            "form": c["active_form"],
            "start_date": str(start_d) if start_d else None,
            "end_date": str(end_d) if end_d else None,
            "expected_end_date": str(expected_end_d) if expected_end_d else None,
            "status": status,
            "effective_status": effective_status,
            "confirmation_status": conf_status,
            "status_source": c["status_source"],
            "is_chronic": c["is_chronic"],
            "notes": c["notes"],
            "days_on_therapy": max(0, days_on_therapy),
            "linked_prescriptions_count": len(course_links),
            "prescriptions": course_links,
            "latest_doctor": course_links[-1]["doctor_name"] if course_links else None,
            "latest_instructions": course_links[-1]["prescribed_instructions"] if course_links else None,
        }
        formatted_courses.append(course_item)

        # Categorize
        if conf_status == "NEEDS_CONFIRMATION" and status == "ACTIVE":
            pending_confirmation.append(course_item)

        if status == "ACTIVE":
            active_now.append(course_item)
        elif status == "ON_HOLD":
            on_hold_count += 1
        elif status == "COMPLETED" or effective_status == "COMPLETED":
            completed_count += 1
        elif status == "DISCONTINUED":
            discontinued_count += 1

    # Build chronological milestones based on prescription event dates
    milestone_dates = sorted(list({
        _to_date(lk["event_date"])
        for lk in links_raw
        if lk["event_date"]
    }))

    milestones = []
    flowchart_links = []
    med_last_seen_node = {}

    for idx, m_date in enumerate(milestone_dates):
        date_str = str(m_date)
        display_date = m_date.strftime("%d %b %Y") if hasattr(m_date, "strftime") else str(m_date)

        events_on_date = [lk for lk in links_raw if _to_date(lk["event_date"]) == m_date]
        rx_ids_on_date = sorted(list({lk["prescription_id"] for lk in events_on_date if lk["prescription_id"]}))
        doctors_on_date = list(dict.fromkeys([lk["doctor_name"] for lk in events_on_date if lk["doctor_name"]]))
        clinics_on_date = list(dict.fromkeys([lk["clinic_name"] for lk in events_on_date if lk["clinic_name"]]))
        diagnoses_on_date = list(dict.fromkeys([lk["diagnosis"] for lk in events_on_date if lk["diagnosis"]]))

        # Medications involved in this milestone:
        # Either newly prescribed/refilled on this date, or continuing through this date
        items_at_milestone = []

        for c in formatted_courses:
            c_start = _to_date(c["start_date"])
            c_end = _to_date(c["end_date"]) or _to_date(c["expected_end_date"])
            c_status = c["status"]

            # Events specifically on this milestone date
            specific_event = next((lk for lk in c["prescriptions"] if lk["event_date"] == date_str), None)

            is_event_date = bool(specific_event)
            is_carried_over = (
                not is_event_date
                and c_start
                and c_start < m_date
                and (c_end is None or c_end >= m_date)
                and c_status not in ("DISCONTINUED", "COMPLETED")
            )

            if is_event_date or is_carried_over:
                node_item_id = f"node-{idx}-{c['course_id']}"
                transition = specific_event["event_type"] if specific_event else "CONTINUATION"

                clean_key = (c["generic_name"] or c["name"] or "").strip().lower()
                link_source = None
                if clean_key in med_last_seen_node:
                    prev_info = med_last_seen_node[clean_key]
                    link_source = prev_info["node_item_id"]
                    flowchart_links.append({
                        "id": f"link-{prev_info['node_item_id']}->{node_item_id}",
                        "source": prev_info["node_item_id"],
                        "target": node_item_id,
                        "source_milestone": prev_info["milestone_idx"],
                        "target_milestone": idx,
                        "medicine_name": c["name"],
                        "type": transition,
                    })

                med_last_seen_node[clean_key] = {
                    "node_item_id": node_item_id,
                    "milestone_idx": idx,
                    "date": date_str,
                }

                item_repr = dict(c)
                item_repr["node_item_id"] = node_item_id
                item_repr["transition"] = transition
                item_repr["connected_from"] = link_source
                if specific_event:
                    item_repr["prescribed_instructions"] = specific_event["prescribed_instructions"]
                    item_repr["prescribed_dosage"] = specific_event["prescribed_dosage"]

                # If this is not the latest milestone, medications are historical completed records
                is_latest_milestone = (idx == len(milestone_dates) - 1)
                if not is_latest_milestone:
                    item_repr["effective_status"] = "COMPLETED"
                    item_repr["status"] = "COMPLETED"

                items_at_milestone.append(item_repr)

        is_latest_milestone = (idx == len(milestone_dates) - 1)
        milestones.append({
            "index": idx,
            "date": date_str,
            "display_date": display_date,
            "title": f"Prescription #{rx_ids_on_date[0]}" if rx_ids_on_date else f"Clinical Encounter ({display_date})",
            "prescription_ids": rx_ids_on_date,
            "doctors": doctors_on_date,
            "clinics": clinics_on_date,
            "diagnoses": diagnoses_on_date,
            "total_active_meds": len([it for it in items_at_milestone if it["effective_status"] == "ACTIVE"]) if is_latest_milestone else 0,
            "medications": items_at_milestone,
        })

    return {
        "patient_id": patient_id,
        "milestones": milestones,
        "flowchart_links": flowchart_links,
        "active_now": active_now,
        "pending_confirmation": pending_confirmation,
        "courses": formatted_courses,
        "summary": {
            "total_prescriptions": len(seen_prescriptions),
            "total_courses": len(formatted_courses),
            "active_now_count": len(active_now),
            "needs_confirmation_count": len(pending_confirmation),
            "on_hold_count": on_hold_count,
            "completed_count": completed_count,
            "discontinued_count": discontinued_count,
            "timeline_nodes_count": len(milestones),
        },
    }


def confirm_patient_medication(
    patient_user_id: int,
    course_id: int,
    action: str,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Handle explicit patient adherence confirmation (e.g. Confirm Taking, Pause, Stop).
    
    Logs an immutable record in medication_status_history and updates the course.
    """
    valid_actions = {"CONFIRM_TAKING", "PAUSE", "STOP", "NOT_STARTED"}
    norm_action = action.strip().upper()
    if norm_action not in valid_actions:
        raise ValueError(f"Invalid confirmation action: '{action}'. Must be one of {valid_actions}")

    patient_id = _get_patient_id(patient_user_id)
    if not patient_id:
        raise ValueError("Patient profile not found.")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Verify ownership and fetch current state
            cur.execute(
                """
                SELECT course_id, status, confirmation_status, end_date
                FROM medication_course
                WHERE course_id = %s AND patient_id = %s
                """,
                (course_id, patient_id),
            )
            course = cur.fetchone()
            if not course:
                raise ValueError("Medication course not found or access denied.")

            prev_status = course["status"]
            prev_conf = course["confirmation_status"]

            # 2. Map action to new status and confirmation
            new_status = prev_status
            new_conf = prev_conf
            new_end_date = course["end_date"]

            if norm_action == "CONFIRM_TAKING":
                new_status = "ACTIVE"
                new_conf = "CONFIRMED_TAKING"
            elif norm_action == "PAUSE":
                new_status = "ON_HOLD"
                new_conf = "CONFIRMED_PAUSED"
            elif norm_action == "STOP":
                new_status = "DISCONTINUED"
                new_conf = "CONFIRMED_STOPPED"
                new_end_date = _dt.date.today()
            elif norm_action == "NOT_STARTED":
                new_status = "DISCONTINUED"
                new_conf = "NOT_STARTED"
                new_end_date = _dt.date.today()

            # 3. Update medication_course
            cur.execute(
                """
                UPDATE medication_course
                SET status              = %s,
                    confirmation_status = %s,
                    status_source       = 'PATIENT_REPORTED',
                    end_date            = COALESCE(%s, end_date),
                    notes               = COALESCE(%s, notes),
                    updated_at          = NOW()
                WHERE course_id = %s
                RETURNING course_id, status, confirmation_status, status_source, end_date, notes
                """,
                (new_status, new_conf, new_end_date, reason, course_id),
            )
            updated = cur.fetchone()

            # 4. Write audit log entry (guarded against duplicate identical states)
            if prev_status != new_status or prev_conf != new_conf:
                cur.execute(
                    """
                    INSERT INTO medication_status_history (
                        course_id, previous_status, new_status,
                        previous_confirmation, new_confirmation,
                        change_reason, source, changed_by_user_id,
                        effective_date
                    ) VALUES (
                        %s, %s, %s,
                        %s, %s,
                        %s, 'PATIENT_REPORTED', %s,
                        CURRENT_DATE
                    )
                    """,
                    (
                        course_id, prev_status, new_status,
                        prev_conf, new_conf,
                        reason or f"Patient confirmed {norm_action}",
                        patient_user_id,
                    ),
                )

            # 5. Keep legacy current_medication in sync
            cur.execute(
                """
                UPDATE current_medication
                SET status = %s,
                    end_date = COALESCE(%s, end_date),
                    notes = COALESCE(%s, notes),
                    updated_at = NOW()
                WHERE course_id = %s
                """,
                (new_status, new_end_date, reason, course_id),
            )

    return {
        "success": True,
        "message": f"Medication confirmation updated to {norm_action}.",
        "course": dict(updated),
    }


def update_patient_medication_status(
    patient_user_id: int,
    course_id: int,
    status: str,
    effective_date: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Update clinical status of a medication course (ACTIVE, ON_HOLD, DISCONTINUED, COMPLETED, UNCERTAIN)."""
    valid_statuses = {"ACTIVE", "ON_HOLD", "DISCONTINUED", "COMPLETED", "UNCERTAIN"}
    norm_status = status.strip().upper()
    if norm_status not in valid_statuses:
        raise ValueError(f"Invalid medication status: '{status}'. Must be one of {valid_statuses}")

    patient_id = _get_patient_id(patient_user_id)
    if not patient_id:
        raise ValueError("Patient profile not found.")

    parsed_end = None
    if effective_date:
        try:
            parsed_end = _dt.date.fromisoformat(effective_date.strip().split("T")[0])
        except ValueError:
            raise ValueError(f"Invalid effective_date format: '{effective_date}'. Expected YYYY-MM-DD.")
    elif norm_status in ("DISCONTINUED", "COMPLETED"):
        parsed_end = _dt.date.today()

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Verify ownership
            cur.execute(
                """
                SELECT course_id, status, confirmation_status, end_date
                FROM medication_course
                WHERE course_id = %s AND patient_id = %s
                """,
                (course_id, patient_id),
            )
            course = cur.fetchone()
            if not course:
                raise ValueError("Medication course not found or access denied.")

            prev_status = course["status"]
            prev_conf = course["confirmation_status"]

            # Map confirmation status if transitioning
            new_conf = prev_conf
            if norm_status == "ACTIVE" and prev_conf != "CONFIRMED_TAKING":
                new_conf = "CONFIRMED_TAKING"
            elif norm_status == "ON_HOLD":
                new_conf = "CONFIRMED_PAUSED"
            elif norm_status == "DISCONTINUED":
                new_conf = "CONFIRMED_STOPPED"

            # Update course
            cur.execute(
                """
                UPDATE medication_course
                SET status              = %s,
                    confirmation_status = %s,
                    status_source       = 'PATIENT_REPORTED',
                    end_date            = COALESCE(%s, end_date),
                    notes               = COALESCE(%s, notes),
                    updated_at          = NOW()
                WHERE course_id = %s
                RETURNING course_id, status, confirmation_status, status_source, start_date, end_date, notes
                """,
                (norm_status, new_conf, parsed_end, notes, course_id),
            )
            updated = cur.fetchone()

            # Append audit entry if state changed
            if prev_status != norm_status:
                cur.execute(
                    """
                    INSERT INTO medication_status_history (
                        course_id, previous_status, new_status,
                        previous_confirmation, new_confirmation,
                        change_reason, source, changed_by_user_id,
                        effective_date
                    ) VALUES (
                        %s, %s, %s,
                        %s, %s,
                        %s, 'PATIENT_REPORTED', %s,
                        %s
                    )
                    """,
                    (
                        course_id, prev_status, norm_status,
                        prev_conf, new_conf,
                        notes or f"Status changed to {norm_status}",
                        patient_user_id,
                        parsed_end or _dt.date.today(),
                    ),
                )

            # Sync current_medication
            cur.execute(
                """
                UPDATE current_medication
                SET status = %s,
                    end_date = COALESCE(%s, end_date),
                    notes = COALESCE(%s, notes),
                    updated_at = NOW()
                WHERE course_id = %s
                """,
                (norm_status, parsed_end, notes, course_id),
            )

    return {
        "success": True,
        "message": f"Medication course marked as {norm_status}.",
        "course": dict(updated),
    }


def get_course_history(patient_user_id: int, course_id: int) -> Dict[str, Any]:
    """Retrieve detailed prescription lineage and status audit history for a course."""
    patient_id = _get_patient_id(patient_user_id)
    if not patient_id:
        raise ValueError("Patient profile not found.")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Course details
            cur.execute(
                """
                SELECT
                    course_id, patient_id, canonical_medicine_id, display_name,
                    generic_name, brand_name, rxcui, active_strength,
                    active_dosage, active_frequency, active_form,
                    start_date, end_date, expected_end_date, status,
                    confirmation_status, status_source, is_chronic, notes,
                    created_at, updated_at
                FROM medication_course
                WHERE course_id = %s AND patient_id = %s
                """,
                (course_id, patient_id),
            )
            course = cur.fetchone()
            if not course:
                raise ValueError("Medication course not found or access denied.")

            # 2. Linked Prescriptions (Prescription Lineage)
            cur.execute(
                """
                SELECT
                    mcp.link_id,
                    mcp.prescription_id,
                    mcp.prescription_medicine_id,
                    mcp.prescribed_name,
                    mcp.prescribed_strength,
                    mcp.prescribed_dosage,
                    mcp.prescribed_frequency,
                    mcp.prescribed_duration,
                    mcp.prescribed_instructions,
                    mcp.event_type,
                    mcp.event_date,
                    COALESCE(doc_u.full_name, 'Prescribing Doctor') AS doctor_name,
                    cl.name AS clinic_name,
                    rx.diagnosis,
                    rx.issue_date AS rx_issue_date
                FROM medication_course_prescription mcp
                JOIN prescription rx ON rx.prescription_id = mcp.prescription_id
                LEFT JOIN doctor doc ON doc.doctor_id = mcp.doctor_id
                LEFT JOIN users doc_u ON doc_u.user_id = doc.user_id
                LEFT JOIN clinic_hospital cl ON cl.clinic_id = rx.clinic_id
                WHERE mcp.course_id = %s
                ORDER BY mcp.event_date ASC, mcp.link_id ASC
                """,
                (course_id,),
            )
            prescriptions = cur.fetchall()

            # 3. Status Audit History
            cur.execute(
                """
                SELECT
                    msh.history_id,
                    msh.previous_status,
                    msh.new_status,
                    msh.previous_confirmation,
                    msh.new_confirmation,
                    msh.change_reason,
                    msh.source,
                    msh.effective_date,
                    msh.created_at,
                    COALESCE(u.full_name, u.email, 'System') AS actor_name
                FROM medication_status_history msh
                LEFT JOIN users u ON u.user_id = msh.changed_by_user_id
                WHERE msh.course_id = %s
                ORDER BY msh.created_at DESC
                """,
                (course_id,),
            )
            history = cur.fetchall()

    return {
        "course": dict(course),
        "prescriptions": [dict(p) for p in prescriptions],
        "audit_history": [dict(h) for h in history],
    }
