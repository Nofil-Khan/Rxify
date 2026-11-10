"""Medication Timeline & Adherence Flowchart Engine."""

from __future__ import annotations
import datetime as _dt
import logging
import re
from typing import Any, Dict, List, Optional, Set

import psycopg2.extras
from database.db import get_conn
from services.patient_care.repository import PatientRepository, default_patient_repo

logger = logging.getLogger(__name__)


class MedicationTimelineService:
    """Calculates patient medication milestones, timeline transitions, and graphical links."""

    def __init__(self, repository: Optional[PatientRepository] = None):
        self._repo = repository or default_patient_repo

    def backfill_patient_current_medications(self, patient_id: int) -> None:
        """Ensure historical prescriptions are synced to current_medication table."""
        from services.prescription.parsers import DosageScheduleParser
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT rx.prescription_id, rx.issue_date
                    FROM prescription rx
                    WHERE rx.patient_id = %s
                      AND NOT EXISTS (
                          SELECT 1 FROM current_medication cm
                          JOIN prescription_medicine pm ON pm.prescription_medicine_id = cm.prescription_medicine_id
                          WHERE pm.prescription_id = rx.prescription_id
                      )
                    """,
                    (patient_id,),
                )
                unfilled = cur.fetchall()

        for row in unfilled:
            try:
                rx_id = row["prescription_id"]
                issue_d = str(row["issue_date"]) if row["issue_date"] else None
                with get_conn() as conn:
                    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                        cur.execute(
                            """
                            SELECT prescription_medicine_id, medicine_id, dosage, frequency, duration
                            FROM prescription_medicine
                            WHERE prescription_id = %s
                            """,
                            (rx_id,),
                        )
                        for pm in cur.fetchall():
                            days = DosageScheduleParser.parse_duration_days(pm.get("duration"))
                            cur.execute(
                                """
                                INSERT INTO current_medication (
                                    patient_id, prescription_medicine_id, medicine_id,
                                    dosage, frequency, start_date, end_date, status
                                ) VALUES (
                                    %s, %s, %s, %s, %s,
                                    COALESCE(%s::date, CURRENT_DATE),
                                    CASE WHEN %s > 0 THEN COALESCE(%s::date, CURRENT_DATE) + %s ELSE NULL END,
                                    'ACTIVE'
                                )
                                ON CONFLICT DO NOTHING
                                """,
                                (
                                    patient_id,
                                    pm["prescription_medicine_id"],
                                    pm["medicine_id"],
                                    pm.get("dosage"),
                                    pm.get("frequency"),
                                    issue_d,
                                    days,
                                    issue_d,
                                    days,
                                ),
                            )
                        conn.commit()
            except Exception as exc:
                logger.debug("Skipped backfill for rx #%s: %s", row["prescription_id"], exc)

    def get_patient_medication_timeline(self, patient_user_id: int) -> Dict[str, Any]:
        """Build chronological flowchart timeline of active, continued, and stopped medications."""
        patient_id = self._repo.get_patient_id_by_user_id(patient_user_id)
        if not patient_id:
            return {
                "patient_id": None,
                "milestones": [],
                "flowchart_links": [],
                "active_now": [],
                "summary": {
                    "total_prescriptions": 0,
                    "active_now_count": 0,
                    "discontinued_count": 0,
                    "completed_count": 0,
                },
            }

        # Backfill any missing current_medication entries
        self.backfill_patient_current_medications(patient_id)
        today = _dt.date.today()

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        cm.current_medication_id,
                        cm.patient_id,
                        cm.prescription_medicine_id,
                        cm.medicine_id,
                        COALESCE(m.brand_name, m.generic_name, pm.name, 'Unknown Medication') AS display_name,
                        m.generic_name,
                        m.brand_name,
                        m.strength,
                        m.form::TEXT AS form,
                        m.category,
                        COALESCE(cm.dosage, pm.dosage) AS dosage,
                        COALESCE(cm.frequency, pm.frequency) AS frequency,
                        pm.duration,
                        pm.instructions,
                        cm.start_date,
                        cm.end_date,
                        cm.status,
                        cm.notes,
                        rx.prescription_id,
                        rx.issue_date AS rx_issue_date,
                        COALESCE(doc_u.full_name, 'Prescribing Doctor') AS doctor_name,
                        rx.diagnosis,
                        cm.created_at
                    FROM current_medication cm
                    LEFT JOIN prescription_medicine pm ON pm.prescription_medicine_id = cm.prescription_medicine_id
                    LEFT JOIN prescription rx ON rx.prescription_id = pm.prescription_id
                    LEFT JOIN medicine m ON m.medicine_id = COALESCE(cm.medicine_id, pm.medicine_id)
                    LEFT JOIN doctor doc ON doc.doctor_id = rx.doctor_id
                    LEFT JOIN users doc_u ON doc_u.user_id = doc.user_id
                    WHERE cm.patient_id = %s
                    ORDER BY
                        COALESCE(cm.start_date, rx.issue_date, cm.created_at::date) ASC,
                        cm.current_medication_id ASC
                    """,
                    (patient_id,),
                )
                raw_rows = cur.fetchall()

        if not raw_rows:
            return {
                "patient_id": patient_id,
                "milestones": [],
                "flowchart_links": [],
                "active_now": [],
                "summary": {
                    "total_prescriptions": 0,
                    "active_now_count": 0,
                    "discontinued_count": 0,
                    "completed_count": 0,
                },
            }

        def _to_date(val: Any) -> Optional[_dt.date]:
            if val is None:
                return None
            if isinstance(val, _dt.datetime):
                return val.date()
            if isinstance(val, _dt.date):
                return val
            if isinstance(val, str):
                try:
                    return _dt.date.fromisoformat(val.strip().split("T")[0])
                except ValueError:
                    return None
            return None

        all_meds = []
        seen_prescriptions = set()
        for r in raw_rows:
            raw_start = r["start_date"] or r["rx_issue_date"] or (r["created_at"].date() if r["created_at"] else today)
            start_d = _to_date(raw_start) or today
            end_d = _to_date(r["end_date"])
            status = r["status"]

            is_past_end = bool(end_d and end_d < today)
            effective_status = status
            if status == "ACTIVE" and is_past_end:
                effective_status = "COMPLETED"

            rx_id = r["prescription_id"]
            if rx_id:
                seen_prescriptions.add(rx_id)

            all_meds.append({
                "current_medication_id": r["current_medication_id"],
                "prescription_medicine_id": r["prescription_medicine_id"],
                "medicine_id": r["medicine_id"],
                "name": r["display_name"],
                "generic_name": r["generic_name"],
                "brand_name": r["brand_name"],
                "strength": r["strength"],
                "form": r["form"],
                "category": r["category"],
                "dosage": r["dosage"],
                "frequency": r["frequency"],
                "duration": r["duration"],
                "instructions": r["instructions"],
                "start_date": str(start_d) if start_d else None,
                "start_date_obj": start_d,
                "end_date": str(end_d) if end_d else None,
                "end_date_obj": end_d,
                "status": status,
                "effective_status": effective_status,
                "notes": r["notes"],
                "prescription_id": rx_id,
                "doctor_name": r["doctor_name"],
                "diagnosis": r["diagnosis"],
            })

        milestone_dates = sorted(list({m["start_date_obj"] for m in all_meds if m["start_date_obj"]}))
        milestones = []
        flowchart_links = []
        med_last_seen_node: Dict[str, Dict[str, Any]] = {}

        for idx, m_date in enumerate(milestone_dates):
            date_str = str(m_date)
            display_date = m_date.strftime("%d %b %Y") if hasattr(m_date, "strftime") else str(m_date)

            rx_ids_on_date = sorted(list({
                m["prescription_id"] for m in all_meds
                if m["start_date_obj"] == m_date and m["prescription_id"]
            }))
            doctors_on_date = list(dict.fromkeys([
                m["doctor_name"] for m in all_meds
                if m["start_date_obj"] == m_date and m["doctor_name"]
            ]))
            diagnoses_on_date = list(dict.fromkeys([
                m["diagnosis"] for m in all_meds
                if m["start_date_obj"] == m_date and m["diagnosis"]
            ]))

            items_at_milestone = []
            for med in all_meds:
                s_obj = med["start_date_obj"]
                e_obj = med["end_date_obj"]
                if not s_obj:
                    continue

                is_new = (s_obj == m_date)
                is_carried_over = (
                    s_obj < m_date
                    and (e_obj is None or e_obj >= m_date)
                    and med["status"] != "DISCONTINUED"
                )
                is_stopped_here = (
                    s_obj < m_date
                    and (
                        med["status"] == "DISCONTINUED"
                        or (e_obj and e_obj < m_date and e_obj >= (milestone_dates[idx - 1] if idx > 0 else s_obj))
                    )
                )

                if is_new or is_carried_over or is_stopped_here:
                    clean_name = (med["name"] or "").strip().lower()
                    node_item_id = f"node-{idx}-{med['current_medication_id']}"

                    transition = "STARTED"
                    if is_carried_over:
                        transition = "CONTINUED"
                    elif is_stopped_here:
                        transition = "DISCONTINUED" if med["status"] == "DISCONTINUED" else "COMPLETED"

                    link_source = None
                    if clean_name in med_last_seen_node:
                        prev_info = med_last_seen_node[clean_name]
                        link_source = prev_info["node_item_id"]
                        flowchart_links.append({
                            "id": f"link-{prev_info['node_item_id']}->{node_item_id}",
                            "source": prev_info["node_item_id"],
                            "target": node_item_id,
                            "source_milestone": prev_info["milestone_idx"],
                            "target_milestone": idx,
                            "medicine_name": med["name"],
                            "type": transition,
                        })

                    med_last_seen_node[clean_name] = {
                        "node_item_id": node_item_id,
                        "milestone_idx": idx,
                        "date": date_str,
                    }

                    item_data = dict(med)
                    item_data.pop("start_date_obj", None)
                    item_data.pop("end_date_obj", None)
                    item_data["node_item_id"] = node_item_id
                    item_data["transition"] = transition
                    item_data["connected_from"] = link_source
                    items_at_milestone.append(item_data)

            active_in_milestone = [it for it in items_at_milestone if it["transition"] in ("STARTED", "CONTINUED")]
            milestones.append({
                "index": idx,
                "date": date_str,
                "display_date": display_date,
                "title": f"Prescription Record #{rx_ids_on_date[0]}" if rx_ids_on_date else f"Health Milestone ({display_date})",
                "prescription_ids": rx_ids_on_date,
                "doctors": doctors_on_date,
                "diagnoses": diagnoses_on_date,
                "total_active_meds": len(active_in_milestone),
                "medications": items_at_milestone,
            })

        active_now = []
        discontinued_count = 0
        completed_count = 0
        for med in all_meds:
            s = dict(med)
            s.pop("start_date_obj", None)
            s.pop("end_date_obj", None)
            if med["status"] == "DISCONTINUED":
                discontinued_count += 1
            elif med["effective_status"] == "COMPLETED":
                completed_count += 1
            elif med["status"] == "ACTIVE":
                active_now.append(s)

        return {
            "patient_id": patient_id,
            "milestones": milestones,
            "flowchart_links": flowchart_links,
            "active_now": active_now,
            "summary": {
                "total_prescriptions": len(seen_prescriptions),
                "total_tracked_medications": len(all_meds),
                "active_now_count": len(active_now),
                "discontinued_count": discontinued_count,
                "completed_count": completed_count,
                "timeline_nodes_count": len(milestones),
            },
        }

    def get_patient_timeline_prescriptions(self, patient_user_id: int) -> List[Dict[str, Any]]:
        """Return chronological timeline of prescriptions with formatted metadata and medications."""
        patient_id = self._repo.get_patient_id_by_user_id(patient_user_id)
        if not patient_id:
            return []

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        rx.prescription_id AS id,
                        rx.issue_date,
                        rx.created_at,
                        rx.diagnosis,
                        rx.notes,
                        ch.name AS clinic_name,
                        u_doc.full_name AS doctor_user_name,
                        d.specialization AS doctor_specialty
                    FROM prescription rx
                    LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
                    LEFT JOIN doctor d ON d.doctor_id = rx.doctor_id
                    LEFT JOIN users u_doc ON u_doc.user_id = d.user_id
                    WHERE rx.patient_id = %s
                      AND EXISTS (
                          SELECT 1 FROM prescription_medicine pm WHERE pm.prescription_id = rx.prescription_id
                      )
                    ORDER BY COALESCE(rx.issue_date, rx.created_at) ASC, rx.prescription_id ASC
                    """,
                    (patient_id,),
                )
                rx_rows = cur.fetchall()
                if not rx_rows:
                    return []

                total = len(rx_rows)
                result = []

                for idx, r in enumerate(rx_rows):
                    rx_id = r["id"]
                    raw_date = r["issue_date"] or r["created_at"]
                    display_date = raw_date.strftime("%b %d, %Y") if raw_date else "Undated"

                    notes = r["notes"] or ""
                    doc_name = r["doctor_user_name"]
                    if not doc_name:
                        m_doc = re.search(r"Doctor:\s*([^|\n]+)", notes)
                        doc_name = m_doc.group(1).strip() if m_doc else "Attending Physician"
                    if doc_name and not doc_name.startswith("Dr.") and not doc_name.startswith("डॉ."):
                        doc_name = f"Dr. {doc_name}"

                    clinic = r["clinic_name"]
                    if not clinic:
                        m_cln = re.search(r"Clinic:\s*([^|\n]+)", notes)
                        clinic = m_cln.group(1).strip() if m_cln else "Medical Clinic"

                    is_latest = (idx == total - 1)

                    cur.execute(
                        """
                        SELECT
                            pm.prescription_medicine_id,
                            pm.name AS raw_name,
                            pm.match_status,
                            COALESCE(pm.patient_resolved, FALSE) AS patient_resolved,
                            pm.medicine_id,
                            m.generic_name,
                            m.brand_name,
                            m.strength,
                            m.form::TEXT,
                            m.category,
                            COALESCE(m.brand_name, m.generic_name, pm.name) AS name,
                            pm.dosage,
                            pm.frequency,
                            pm.duration,
                            pm.instructions,
                            mc.status AS course_status,
                            mc.confirmation_status AS course_confirmation
                        FROM prescription_medicine pm
                        LEFT JOIN medicine m ON m.medicine_id = pm.medicine_id
                        LEFT JOIN medication_course_prescription mcp ON mcp.prescription_medicine_id = pm.prescription_medicine_id
                        LEFT JOIN medication_course mc ON mc.course_id = mcp.course_id
                        WHERE pm.prescription_id = %s
                        ORDER BY pm.prescription_medicine_id ASC
                        """,
                        (rx_id,),
                    )
                    med_rows = cur.fetchall()

                    medications = []
                    for med in med_rows:
                        c_status = med["course_status"]
                        c_conf = med["course_confirmation"]

                        if c_status == "ACTIVE" and c_conf == "CONFIRMED_TAKING":
                            status_display = "Taking"
                        elif c_status == "ACTIVE" and c_conf == "NEEDS_CONFIRMATION":
                            status_display = "Needs confirmation"
                        elif c_status == "ON_HOLD":
                            status_display = "Paused"
                        elif c_status in ("COMPLETED", "DISCONTINUED"):
                            status_display = "Completed"
                        else:
                            status_display = "Taking" if is_latest else "Completed"

                        medications.append({
                            "prescription_medicine_id": med["prescription_medicine_id"],
                            "name": med["name"],
                            "raw_name": med["raw_name"],
                            "match_status": med["match_status"],
                            "patient_resolved": med["patient_resolved"],
                            "medicine_id": med["medicine_id"],
                            "generic_name": med["generic_name"],
                            "brand_name": med["brand_name"],
                            "strength": med["strength"],
                            "form": med["form"],
                            "category": med["category"],
                            "dosage": med["dosage"],
                            "frequency": med["frequency"],
                            "duration": med["duration"],
                            "instructions": med["instructions"],
                            "status_display": status_display,
                        })

                    result.append({
                        "id": rx_id,
                        "prescription_code": f"RX-{rx_id:04d}",
                        "display_date": display_date,
                        "issue_date": raw_date.isoformat() if raw_date else None,
                        "diagnosis": r["diagnosis"],
                        "doctor_name": doc_name,
                        "doctor_specialty": r["doctor_specialty"],
                        "clinic_name": clinic,
                        "doctor_notes": notes,
                        "is_latest": is_latest,
                        "medications": medications,
                    })

                return result


default_timeline_service = MedicationTimelineService()

