"""High-level Prescription Service for ingestion, clinical matching, and timeline syncing."""

from __future__ import annotations
import datetime
import logging
from typing import Any, Dict, List, Optional

from services.prescription.domain import PrescriptionData, PrescriptionItem
from services.prescription.parsers import PrescriptionDateParser, DosageScheduleParser
from services.prescription.repository import PrescriptionRepository
from services.clinical.matcher_service import MedicineMatcherService, default_matcher_service
from database.db import get_conn

logger = logging.getLogger(__name__)


class PrescriptionService:
    """Orchestrates prescription processing, clinical ontology mapping, and active adherence sync."""

    def __init__(
        self,
        repository: Optional[PrescriptionRepository] = None,
        matcher: Optional[MedicineMatcherService] = None,
    ):
        self._repo = repository or PrescriptionRepository()
        self._matcher = matcher or default_matcher_service

    def ingest_extracted_prescription(self, extracted: Dict[str, Any], user_id: int) -> int:
        """Parse raw OCR dictionary, resolve canonical medicine IDs, and commit to database."""
        patient_id = self._repo.get_or_create_patient_id(user_id)

        issue_date = PrescriptionDateParser.parse_date_string(extracted.get("issue_date"))
        follow_up_date = PrescriptionDateParser.parse_date_string(extracted.get("follow_up_date"))

        # Build combined metadata notes
        notes_parts = []
        if extracted.get("doctor_name"):
            notes_parts.append(f"Doctor: {extracted['doctor_name']}")
        if extracted.get("clinic_name"):
            notes_parts.append(f"Clinic: {extracted['clinic_name']}")
        if extracted.get("notes"):
            notes_parts.append(str(extracted["notes"]))
        full_notes = " · ".join(notes_parts) if notes_parts else None

        diagnosis = extracted.get("diagnosis") or "Prescribed Medication"

        rx_id = self._repo.create_prescription(
            patient_id=patient_id,
            issue_date=issue_date,
            follow_up_date=follow_up_date,
            diagnosis=diagnosis,
            notes=full_notes,
        )

        medications = extracted.get("medications") or []
        for med in medications:
            name = med.get("name") or med.get("raw_name")
            if not name or not str(name).strip():
                continue

            pm_id = self._repo.insert_prescription_item(
                prescription_id=rx_id,
                name=str(name).strip(),
                dosage=med.get("dosage"),
                frequency=med.get("frequency"),
                duration=med.get("duration"),
                instructions=med.get("instructions"),
            )

            # Match against clinical drug catalog
            try:
                match = self._matcher.resolve(
                    raw_name=str(name),
                    extracted_dosage=med.get("dosage"),
                    extracted_form=med.get("form"),
                )
                self._repo.update_item_resolution(
                    prescription_medicine_id=pm_id,
                    medicine_id=match.medicine_id if match.is_matched else None,
                    match_status=match.status.value,
                )
            except Exception as exc:
                logger.warning("Clinical matcher failed for %r: %s", name, exc)
                self._repo.update_item_resolution(pm_id, None, "UNRESOLVED")

        # Sync active medication timeline
        self._populate_current_medications(rx_id, patient_id, issue_date)

        # Notify dispensary queue
        try:
            from services import dispensary as dispensary_service
            dispensary_service.create_dispensary_request_for_prescription(rx_id)
        except Exception as exc:
            logger.debug("Dispensary auto-create request notice: %s", exc)

        return rx_id

    def get_medicine_info(self, prescription_id: int, user_id: int) -> List[Dict[str, Any]]:
        """Fetch prescribed medicines with dosage instructions for patient timeline."""
        return self._repo.get_medicine_info(prescription_id, user_id)

    def _populate_current_medications(self, rx_id: int, patient_id: int, issue_date_str: Optional[str]) -> None:
        """Insert active records into current_medication for daily adherence tracking."""
        base_date = datetime.date.today()
        if issue_date_str:
            try:
                base_date = datetime.date.fromisoformat(issue_date_str)
            except ValueError:
                pass

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT prescription_medicine_id, medicine_id, dosage, frequency, duration
                    FROM prescription_medicine
                    WHERE prescription_id = %s
                    """,
                    (rx_id,),
                )
                items = cur.fetchall()
                for pm_id, med_id, dosage, frequency, duration in items:
                    days = DosageScheduleParser.parse_duration_to_days(duration) or 7
                    end_date = base_date + datetime.timedelta(days=days)
                    cur.execute(
                        """
                        INSERT INTO current_medication
                            (patient_id, prescription_medicine_id, medicine_id, dosage, frequency, start_date, end_date)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        (patient_id, pm_id, med_id, dosage, frequency, base_date, end_date),
                    )
                conn.commit()


# Default singleton instance
default_prescription_service = PrescriptionService()

