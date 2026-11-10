"""Medication Reconciliation Service — Clinical Course Synthesis.

Tracks longitudinal medication courses, merges continuous therapies, isolates
acute short-course therapies, and syncs course pointers with current_medication.
"""

from __future__ import annotations
import datetime as _dt
import logging
from typing import Any, Dict, List, Optional
import psycopg2.extras

from database.db import get_conn

logger = logging.getLogger(__name__)

ACUTE_CATEGORIES = {
    "antibiotic", "antibacterial", "antiviral", "antifungal",
    "analgesic", "nsaid", "antipyretic", "cough", "cold", "allergy"
}

ACUTE_STEMS = (
    "cillin", "cef", "ceph", "penem", "floxacin", "mycin",
    "paracetamol", "acetaminophen", "ibuprofen", "diclofenac",
    "azithromycin", "amoxicillin", "clavulanate", "doxycycline",
    "pantoprazole", "omeprazole", "ranitidine"
)


class MedicationReconciliationService:
    """Manages clinical medication courses and longitudinal therapy reconciliation."""

    def is_acute_medication(
        self,
        generic_name: Optional[str],
        category: Optional[str],
        duration_days: Optional[int],
    ) -> bool:
        cat_lower = (category or "").lower()
        if any(c in cat_lower for c in ACUTE_CATEGORIES):
            return True

        gen_lower = (generic_name or "").lower()
        if any(stem in gen_lower for stem in ACUTE_STEMS):
            if duration_days is not None and duration_days <= 14:
                return True
            if any(stem in gen_lower for stem in ("cillin", "cef", "ceph", "penem", "floxacin", "mycin")):
                return True
        return False

    def _to_date(self, val: Any) -> Optional[_dt.date]:
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
        self,
        prescription_id: int,
        pm: Dict[str, Any],
        patient_id: int,
        issue_date: Optional[_dt.date],
        doctor_id: Optional[int],
        cur: Any,
    ) -> int:
        pm_id = pm["prescription_medicine_id"]

        cur.execute(
            "SELECT course_id FROM medication_course_prescription WHERE prescription_medicine_id = %s",
            (pm_id,),
        )
        existing_link = cur.fetchone()
        if existing_link:
            course_id = existing_link["course_id"]
            cur.execute(
                """
                UPDATE current_medication
                SET course_id = %s
                WHERE patient_id = %s AND prescription_medicine_id = %s AND course_id IS NULL
                """,
                (course_id, patient_id, pm_id),
            )
            return course_id

        med_id = pm.get("medicine_id")
        duration_days = 30
        if pm.get("duration"):
            from services.prescription.parsers import DosageScheduleParser
            duration_days = DosageScheduleParser.parse_duration_days(pm.get("duration"))

        start_d = issue_date or _dt.date.today()
        end_d = start_d + _dt.timedelta(days=duration_days)

        generic_name = pm.get("generic_name")
        brand_name = pm.get("brand_name")
        dosage = pm.get("dosage")
        frequency = pm.get("frequency")
        instructions = pm.get("instructions")
        form = pm.get("form") or "TABLET"

        # Check existing active course for this medicine
        matched_course_id = None
        if med_id:
            cur.execute(
                """
                SELECT course_id, effective_status, end_date
                FROM medication_course
                WHERE patient_id = %s AND medicine_id = %s AND effective_status = 'ACTIVE'
                ORDER BY course_id DESC LIMIT 1
                """,
                (patient_id, med_id),
            )
            c_row = cur.fetchone()
            if c_row:
                matched_course_id = c_row["course_id"]
                # Extend end_date
                cur.execute(
                    """
                    UPDATE medication_course
                    SET end_date = GREATEST(end_date, %s),
                        dosage = COALESCE(%s, dosage),
                        frequency = COALESCE(%s, frequency),
                        updated_at = NOW()
                    WHERE course_id = %s
                    """,
                    (end_d, dosage, frequency, matched_course_id),
                )

        if not matched_course_id:
            cur.execute(
                """
                INSERT INTO medication_course (
                    patient_id, medicine_id, generic_name, brand_name,
                    dosage, frequency, instructions, form,
                    start_date, end_date, effective_status, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ACTIVE', NOW(), NOW())
                RETURNING course_id
                """,
                (patient_id, med_id, generic_name, brand_name, dosage, frequency, instructions, form, start_d, end_d),
            )
            matched_course_id = cur.fetchone()["course_id"]

        cur.execute(
            """
            INSERT INTO medication_course_prescription (course_id, prescription_id, prescription_medicine_id)
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (matched_course_id, prescription_id, pm_id),
        )

        cur.execute(
            """
            UPDATE current_medication
            SET course_id = %s
            WHERE patient_id = %s AND prescription_medicine_id = %s
            """,
            (matched_course_id, patient_id, pm_id),
        )

        return matched_course_id

    def reconcile_patient_prescriptions(self, patient_id: int) -> None:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT rx.prescription_id, rx.issue_date, rx.doctor_id
                    FROM prescription rx
                    WHERE rx.patient_id = %s
                    ORDER BY rx.issue_date ASC NULLS FIRST, rx.prescription_id ASC
                    """,
                    (patient_id,),
                )
                rx_list = cur.fetchall()

                for rx in rx_list:
                    rx_id = rx["prescription_id"]
                    issue_d = self._to_date(rx["issue_date"])
                    doc_id = rx.get("doctor_id")

                    cur.execute(
                        """
                        SELECT pm.prescription_medicine_id, pm.medicine_id, pm.dosage,
                               pm.frequency, pm.duration, pm.instructions,
                               m.generic_name, m.brand_name, m.form, m.category
                        FROM prescription_medicine pm
                        LEFT JOIN medicine m ON m.medicine_id = pm.medicine_id
                        WHERE pm.prescription_id = %s
                        """,
                        (rx_id,),
                    )
                    pm_rows = cur.fetchall()

                    for pm in pm_rows:
                        self.reconcile_prescription_item(
                            prescription_id=rx_id,
                            pm=pm,
                            patient_id=patient_id,
                            issue_date=issue_d,
                            doctor_id=doc_id,
                            cur=cur,
                        )
                conn.commit()

    def enforce_newest_prescription_active_status(
        self, patient_id: int, cur: Optional[Any] = None
    ) -> None:
        pass  # Preserved interface for compatibility

    def migrate_legacy_current_medications(self, patient_id: Optional[int] = None) -> int:
        return 0


default_reconciliation_service = MedicationReconciliationService()

