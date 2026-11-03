"""Medication Reconciliation Service for Rxify.

Handles evidence-based, conservative reconciliation of prescribed medicines
into longitudinal patient medication courses.

Key design principles:
1. Conservative linking: Never auto-merge without sufficient clinical evidence.
   Unresolved medicines (medicine_id IS NULL) and acute drug episodes (antibiotics,
   short analgesics) are preserved as distinct, separate courses.
2. Idempotency: Running reconciliation repeatedly will not duplicate courses,
   prescription links, or audit records.
3. Immutability: Original prescription records and instructions are never altered.
4. Compatibility: Synchronizes legacy current_medication.course_id.
"""

from __future__ import annotations

import datetime as _dt
import re
from typing import Any, Dict, List, Optional, Tuple

import psycopg2.extras

from database.db import get_conn
from services.prescription import parse_duration_to_days

# Common antibiotic, antiviral, antifungal, and short-course analgesic stems
ACUTE_STEMS = (
    "cillin", "mycin", "cycline", "floxacin", "cef", "ceph", "penem",
    "azole", "clavir", "vir", "paracetamol", "acetaminophen", "ibuprofen",
    "diclofenac", "ketorolac", "tramadol", "azithromycin", "clavulanate",
    "metronidazole", "nitrofurantoin", "doxycycline", "amoxicillin"
)

ACUTE_CATEGORIES = (
    "antibiotics", "anti-infective", "analgesics", "nsaid", "antifungal", "antiviral"
)


def is_acute_medication(
    generic_name: Optional[str],
    category: Optional[str],
    duration_days: Optional[int],
) -> bool:
    """Determine whether a drug is likely an acute, short-course therapy.
    
    Acute medications should not be automatically merged into previous courses
    if prescribed in separate clinical episodes.
    """
    cat_lower = (category or "").lower()
    if any(c in cat_lower for c in ACUTE_CATEGORIES):
        return True

    gen_lower = (generic_name or "").lower()
    if any(stem in gen_lower for stem in ACUTE_STEMS):
        # If it's a known acute stem and has a short fixed duration (<= 14 days), it's acute
        if duration_days is not None and duration_days <= 14:
            return True
        # Antibiotics are almost always acute regardless of duration
        if any(stem in gen_lower for stem in ("cillin", "cef", "ceph", "penem", "floxacin", "mycin")):
            return True

    return False


def _to_date(val: Any) -> Optional[_dt.date]:
    """Safely convert string, datetime, or date to datetime.date."""
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


def reconcile_prescription_item(
    prescription_id: int,
    pm: Dict[str, Any],
    patient_id: int,
    issue_date: Optional[_dt.date],
    doctor_id: Optional[int],
    cur: Any,
) -> int:
    """Reconcile a single prescription_medicine row into a medication_course.
    
    Strictly idempotent: if prescription_medicine_id is already linked,
    returns the existing course_id immediately.
    """
    pm_id = pm["prescription_medicine_id"]

    # 1. Idempotency Check: already linked?
    cur.execute(
        """
        SELECT course_id FROM medication_course_prescription
        WHERE prescription_medicine_id = %s
        """,
        (pm_id,),
    )
    existing_link = cur.fetchone()
    if existing_link:
        course_id = existing_link["course_id"]
        # Ensure current_medication pointer is synced
        cur.execute(
            """
            UPDATE current_medication
            SET course_id = %s
            WHERE patient_id = %s AND prescription_medicine_id = %s AND course_id IS NULL
            """,
            (course_id, patient_id, pm_id),
        )
        return course_id

    # 2. Extract item metadata and canonical identity
    med_id = pm.get("medicine_id")
    prescribed_name = (pm.get("name") or "Unknown Medication").strip()
    dosage = (pm.get("dosage") or "").strip() or None
    frequency = (pm.get("frequency") or "").strip() or None
    duration = (pm.get("duration") or "").strip() or None
    instructions = (pm.get("instructions") or "").strip() or None

    duration_days = parse_duration_to_days(duration) if duration else None
    start_d = issue_date or _dt.date.today()
    expected_end_d = (start_d + _dt.timedelta(days=duration_days)) if (start_d and duration_days) else None

    # Fetch canonical medicine catalog details if resolved
    canonical_row = None
    if med_id:
        cur.execute(
            """
            SELECT medicine_id, generic_name, brand_name, category, strength,
                   form::TEXT AS form, rxcui, rxnorm_name
            FROM medicine
            WHERE medicine_id = %s
            """,
            (med_id,),
        )
        canonical_row = cur.fetchone()

    generic_name = canonical_row["generic_name"] if canonical_row else None
    brand_name = canonical_row["brand_name"] if canonical_row else None
    rxcui = canonical_row["rxcui"] if canonical_row else None
    category = canonical_row["category"] if canonical_row else None
    strength = canonical_row["strength"] if canonical_row else None
    form = canonical_row["form"] if canonical_row else None

    display_name = brand_name or generic_name or prescribed_name
    is_acute = is_acute_medication(generic_name or prescribed_name, category, duration_days)

    # 3. Decision Matrix: Search for existing candidate course
    # Rule A: Unresolved medicines (med_id IS NULL) are NEVER merged automatically.
    # Rule B: Acute medicines are NEVER merged unless explicitly a contiguous refill.
    matched_candidate = None
    link_event_type = "NEW_COURSE"

    if med_id:
        # Search for active or recently active courses for this patient with the same drug identity
        cur.execute(
            """
            SELECT course_id, canonical_medicine_id, display_name, generic_name,
                   active_strength, active_dosage, active_frequency,
                   start_date, end_date, expected_end_date, status, confirmation_status,
                   status_source, is_chronic
            FROM medication_course
            WHERE patient_id = %s
              AND (
                  canonical_medicine_id = %s
                  OR (rxcui IS NOT NULL AND rxcui = %s)
                  OR (generic_name IS NOT NULL AND LOWER(generic_name) = LOWER(%s))
              )
            ORDER BY COALESCE(end_date, expected_end_date, start_date) DESC
            LIMIT 5
            """,
            (patient_id, med_id, rxcui or "", generic_name or ""),
        )
        candidates = cur.fetchall()

        for cand in candidates:
            cand_status = cand["status"]
            cand_end = _to_date(cand["end_date"]) or _to_date(cand["expected_end_date"])

            # If acute, can only link if current prescription starts within 7 days of previous end
            if is_acute:
                if cand_status in ("ACTIVE", "ON_HOLD") and cand_end:
                    gap = (start_d - cand_end).days
                    if -3 <= gap <= 7:
                        matched_candidate = cand
                        link_event_type = "CONTINUATION"
                        break
                # Acute episodes outside this contiguous window are separate courses
                continue

            # Chronic / maintenance medications:
            # If candidate was explicitly DISCONTINUED > 30 days ago, do not silently merge
            if cand_status == "DISCONTINUED":
                if cand_end and (start_d - cand_end).days > 30:
                    continue  # Keep distinct past discontinued course

            # If candidate is ACTIVE or ON_HOLD, or ended within the refill window (<= 45 days)
            if cand_status in ("ACTIVE", "ON_HOLD") or (cand_end and (start_d - cand_end).days <= 45):
                matched_candidate = cand

                # Compare strength and frequency for dose changes
                cand_str = (cand["active_dosage"] or cand["active_strength"] or "").strip().lower()
                new_str = (dosage or strength or "").strip().lower()
                cand_freq = (cand["active_frequency"] or "").strip().lower()
                new_freq = (frequency or "").strip().lower()

                strength_changed = bool(cand_str and new_str and cand_str != new_str)
                freq_changed = bool(cand_freq and new_freq and cand_freq != new_freq)

                if strength_changed or freq_changed:
                    link_event_type = "DOSE_CHANGED"
                else:
                    link_event_type = "CONTINUATION"
                break

    # 4. Action: Link to candidate or create new course
    if matched_candidate:
        course_id = matched_candidate["course_id"]

        # Extend expected_end_date if new duration extends beyond current course end
        updated_end = expected_end_d
        cand_curr_end = _to_date(matched_candidate["expected_end_date"])
        if cand_curr_end and expected_end_d and expected_end_d < cand_curr_end:
            updated_end = cand_curr_end

        # Update course with active titration / strength if dose changed
        if link_event_type == "DOSE_CHANGED":
            cur.execute(
                """
                UPDATE medication_course
                SET active_strength  = COALESCE(%s, active_strength),
                    active_dosage    = COALESCE(%s, active_dosage),
                    active_frequency = COALESCE(%s, active_frequency),
                    expected_end_date = COALESCE(%s, expected_end_date),
                    updated_at       = NOW()
                WHERE course_id = %s
                """,
                (dosage or strength, dosage, frequency, updated_end, course_id),
            )
        else:
            cur.execute(
                """
                UPDATE medication_course
                SET expected_end_date = COALESCE(%s, expected_end_date),
                    updated_at       = NOW()
                WHERE course_id = %s
                """,
                (updated_end, course_id),
            )
    else:
        # Create a new independent medication_course
        # Initial status: if course duration already naturally ended in the past, status is COMPLETED
        initial_status = "ACTIVE"
        initial_conf = "NEEDS_CONFIRMATION"
        initial_source = "SYSTEM_INFERRED"

        if expected_end_d and expected_end_d < _dt.date.today():
            initial_status = "COMPLETED"
            initial_conf = "CONFIRMED_STOPPED"

        cur.execute(
            """
            INSERT INTO medication_course (
                patient_id, canonical_medicine_id, display_name, generic_name,
                brand_name, rxcui, active_strength, active_dosage,
                active_frequency, active_form, start_date, end_date,
                expected_end_date, status, confirmation_status,
                status_source, is_chronic, notes
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s
            ) RETURNING course_id
            """,
            (
                patient_id, med_id, display_name, generic_name,
                brand_name, rxcui, dosage or strength, dosage,
                frequency, form, start_d, None,
                expected_end_d, initial_status, initial_conf,
                initial_source, not is_acute, instructions,
            ),
        )
        course_id = cur.fetchone()["course_id"]
        link_event_type = "NEW_COURSE"

    # 5. Insert the course_prescription link (enforces uq_course_prescription_pm)
    cur.execute(
        """
        INSERT INTO medication_course_prescription (
            course_id, prescription_id, prescription_medicine_id,
            prescribed_name, prescribed_strength, prescribed_dosage,
            prescribed_frequency, prescribed_duration, prescribed_instructions,
            event_type, event_date, doctor_id
        ) VALUES (
            %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s
        ) ON CONFLICT (prescription_medicine_id) DO NOTHING
        """,
        (
            course_id, prescription_id, pm_id,
            prescribed_name, strength or dosage, dosage,
            frequency, duration, instructions,
            link_event_type, start_d, doctor_id,
        ),
    )

    # 6. Synchronize legacy current_medication pointer
    cur.execute(
        """
        UPDATE current_medication
        SET course_id = %s
        WHERE patient_id = %s AND prescription_medicine_id = %s
        """,
        (course_id, patient_id, pm_id),
    )

    return course_id


def reconcile_patient_prescriptions(patient_id: int) -> None:
    """Reconcile all unlinked prescriptions for a patient in chronological order."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    rx.prescription_id,
                    rx.issue_date,
                    rx.created_at,
                    rx.doctor_id,
                    pm.prescription_medicine_id,
                    pm.medicine_id,
                    pm.name,
                    pm.dosage,
                    pm.frequency,
                    pm.duration,
                    pm.instructions
                FROM prescription rx
                JOIN prescription_medicine pm ON pm.prescription_id = rx.prescription_id
                WHERE rx.patient_id = %s
                  AND NOT EXISTS (
                      SELECT 1 FROM medication_course_prescription mcp
                      WHERE mcp.prescription_medicine_id = pm.prescription_medicine_id
                  )
                ORDER BY COALESCE(rx.issue_date, rx.created_at::date) ASC, pm.prescription_medicine_id ASC
                """,
                (patient_id,),
            )
            unlinked_items = cur.fetchall()

            for item in unlinked_items:
                rx_date = _to_date(item["issue_date"]) or _to_date(item["created_at"]) or _dt.date.today()
                reconcile_prescription_item(
                    prescription_id=item["prescription_id"],
                    pm=dict(item),
                    patient_id=patient_id,
                    issue_date=rx_date,
                    doctor_id=item["doctor_id"],
                    cur=cur,
                )

            # Enforce rule: only medicines in newest prescription are ACTIVE
            enforce_newest_prescription_active_status(patient_id, cur=cur)


def enforce_newest_prescription_active_status(patient_id: int, cur: Optional[Any] = None) -> None:
    """Enforce the strict clinical rule:
    Only medications in the patient's newest prescription are considered ACTIVE.
    All medications from older prescriptions that are not present in the newest prescription
    are automatically marked COMPLETED (inactive).
    """
    def _run(cursor: Any) -> None:
        cursor.execute(
            """
            SELECT prescription_id, COALESCE(issue_date, created_at::date) AS rx_date
            FROM prescription
            WHERE patient_id = %s
            ORDER BY COALESCE(issue_date, created_at::date) DESC, prescription_id DESC
            LIMIT 1
            """,
            (patient_id,),
        )
        newest_rx = cursor.fetchone()
        if not newest_rx:
            return

        if hasattr(newest_rx, "keys"):
            newest_rx_id = newest_rx["prescription_id"]
            rx_d_val = newest_rx["rx_date"]
        else:
            newest_rx_id = newest_rx[0]
            rx_d_val = newest_rx[1]
        rx_date = str(rx_d_val).split("T")[0] if rx_d_val else str(_dt.date.today())

        cursor.execute(
            """
            SELECT DISTINCT course_id
            FROM medication_course_prescription
            WHERE prescription_id = %s
            """,
            (newest_rx_id,),
        )
        fetched = cursor.fetchall()
        newest_courses = []
        for r in fetched:
            cid = r["course_id"] if hasattr(r, "keys") else r[0]
            if cid:
                newest_courses.append(cid)

        if newest_courses:
            # Mark newest courses ACTIVE (unless explicitly paused or discontinued)
            cursor.execute(
                """
                UPDATE medication_course
                SET status = 'ACTIVE',
                    updated_at = NOW()
                WHERE patient_id = %s
                  AND course_id = ANY(%s)
                  AND status NOT IN ('DISCONTINUED', 'ON_HOLD')
                """,
                (patient_id, newest_courses),
            )

            # Mark all older courses COMPLETED
            cursor.execute(
                """
                UPDATE medication_course
                SET status = 'COMPLETED',
                    confirmation_status = 'CONFIRMED_STOPPED',
                    end_date = COALESCE(end_date, %s::date),
                    updated_at = NOW()
                WHERE patient_id = %s
                  AND course_id != ALL(%s)
                  AND status = 'ACTIVE'
                """,
                (rx_date, patient_id, newest_courses),
            )

            # Sync current_medication table
            cursor.execute(
                """
                UPDATE current_medication cm
                SET status = 'ACTIVE'
                FROM prescription_medicine pm
                WHERE cm.patient_id = %s
                  AND cm.prescription_medicine_id = pm.prescription_medicine_id
                  AND pm.prescription_id = %s
                  AND cm.status NOT IN ('DISCONTINUED', 'ON_HOLD')
                """,
                (patient_id, newest_rx_id),
            )

            cursor.execute(
                """
                UPDATE current_medication cm
                SET status = 'COMPLETED',
                    end_date = COALESCE(cm.end_date, %s::date)
                FROM prescription_medicine pm
                WHERE cm.patient_id = %s
                  AND cm.prescription_medicine_id = pm.prescription_medicine_id
                  AND pm.prescription_id != %s
                  AND cm.status = 'ACTIVE'
                """,
                (rx_date, patient_id, newest_rx_id),
            )

    if cur is not None:
        _run(cur)
    else:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                _run(cursor)


def migrate_legacy_current_medications(patient_id: Optional[int] = None) -> int:
    """Safely migrate legacy current_medication records into medication_course.
    
    Idempotent: skips any row where course_id IS NOT NULL.
    """
    query = """
        SELECT
            cm.current_medication_id,
            cm.patient_id,
            cm.prescription_medicine_id,
            cm.medicine_id,
            cm.dosage,
            cm.frequency,
            cm.start_date,
            cm.end_date,
            cm.status,
            cm.notes,
            pm.name AS pm_name,
            pm.duration,
            pm.instructions,
            rx.prescription_id,
            rx.issue_date,
            rx.doctor_id,
            rx.created_at AS rx_created_at
        FROM current_medication cm
        LEFT JOIN prescription_medicine pm ON pm.prescription_medicine_id = cm.prescription_medicine_id
        LEFT JOIN prescription rx ON rx.prescription_id = pm.prescription_id
        WHERE cm.course_id IS NULL
    """
    params: list = []
    if patient_id is not None:
        query += " AND cm.patient_id = %s"
        params.append(patient_id)

    migrated_count = 0
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, tuple(params))
            legacy_rows = cur.fetchall()

            for row in legacy_rows:
                cm_id = row["current_medication_id"]
                p_id = row["patient_id"]
                pm_id = row["prescription_medicine_id"]

                # If this PM item is already linked in medication_course_prescription, just sync the FK
                cur.execute(
                    "SELECT course_id FROM medication_course_prescription WHERE prescription_medicine_id = %s",
                    (pm_id,),
                )
                existing = cur.fetchone()
                if existing:
                    cur.execute(
                        "UPDATE current_medication SET course_id = %s WHERE current_medication_id = %s",
                        (existing["course_id"], cm_id),
                    )
                    migrated_count += 1
                    continue

                rx_id = row["prescription_id"]
                if rx_id and pm_id:
                    rx_date = _to_date(row["start_date"]) or _to_date(row["issue_date"]) or _to_date(row["rx_created_at"])
                    cid = reconcile_prescription_item(
                        prescription_id=rx_id,
                        pm={
                            "prescription_medicine_id": pm_id,
                            "medicine_id": row["medicine_id"],
                            "name": row["pm_name"] or "Legacy Medication",
                            "dosage": row["dosage"],
                            "frequency": row["frequency"],
                            "duration": row["duration"],
                            "instructions": row["instructions"],
                        },
                        patient_id=p_id,
                        issue_date=rx_date,
                        doctor_id=row["doctor_id"],
                        cur=cur,
                    )
                    # Respect legacy explicit discontinued status
                    if row["status"] == "DISCONTINUED":
                        cur.execute(
                            """
                            UPDATE medication_course
                            SET status = 'DISCONTINUED',
                                confirmation_status = 'CONFIRMED_STOPPED',
                                status_source = 'PATIENT_REPORTED',
                                end_date = COALESCE(%s, end_date)
                            WHERE course_id = %s
                            """,
                            (row["end_date"], cid),
                        )
                    migrated_count += 1

    return migrated_count
