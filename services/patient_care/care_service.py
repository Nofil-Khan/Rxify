"""Patient Care Service — Clinical records, doctor connections, and medication status."""

from __future__ import annotations
import datetime as _dt
import logging
from typing import Any, Dict, List, Optional

import psycopg2.extras
from database.db import get_conn
from services.patient_care.repository import PatientRepository, default_patient_repo
from services.clinical.matcher_service import default_matcher_service
from services.clinical.normalizer import ClinicalNormalizer

logger = logging.getLogger(__name__)


class PatientCareService:
    """Orchestrates patient dashboard queries, doctor requests, and medication status updates."""

    def __init__(self, repository: Optional[PatientRepository] = None):
        self._repo = repository or default_patient_repo

    def get_my_prescriptions(self, patient_user_id: int) -> List[Dict[str, Any]]:
        """Return all prescriptions for patient, newest first."""
        return self._repo.get_prescriptions_by_user(patient_user_id)

    def get_my_prescription_detail(self, patient_user_id: int, prescription_id: int) -> Optional[Dict[str, Any]]:
        """Return complete prescription detail with medicines and match statuses."""
        return self._repo.get_prescription_detail(patient_user_id, prescription_id)

    def get_patient_stats(self, patient_user_id: int) -> Dict[str, Any]:
        """Return dashboard metrics (rx counts, pending requests, shares)."""
        return self._repo.get_patient_stats(patient_user_id)

    def lookup_doctor(self, doctor_id: int) -> Optional[Dict[str, Any]]:
        """Fetch doctor public profile by ID."""
        return self._repo.lookup_doctor(doctor_id)

    def send_doctor_request(self, patient_user_id: int, doctor_id: int) -> Dict[str, Any]:
        """Send connection request to a doctor."""
        return self._repo.send_doctor_request(patient_user_id, doctor_id)

    def get_my_requests(self, patient_user_id: int) -> List[Dict[str, Any]]:
        """List doctor requests sent by patient."""
        return self._repo.get_my_requests(patient_user_id)

    def get_assigned_doctor(self, patient_user_id: int) -> Optional[Dict[str, Any]]:
        """Return the active doctor currently assigned to patient."""
        return self._repo.get_assigned_doctor(patient_user_id)

    def get_medicine_candidates(self, pm_id: int, patient_user_id: int) -> Optional[Dict[str, Any]]:
        """Surface ranked catalog candidates for ambiguous or unresolved prescription medicines."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT pm.prescription_medicine_id, pm.name AS raw_name,
                           pm.dosage, pm.frequency, pm.match_status, pm.patient_resolved
                    FROM prescription_medicine pm
                    JOIN prescription rx ON rx.prescription_id = pm.prescription_id
                    JOIN patient pt       ON pt.patient_id      = rx.patient_id
                    WHERE pm.prescription_medicine_id = %s AND pt.user_id = %s
                    """,
                    (pm_id, patient_user_id),
                )
                row = cur.fetchone()
                if not row:
                    return None

        pm = dict(row)
        raw_name = pm["raw_name"]
        match_status = pm["match_status"]

        match_res = default_matcher_service.resolve(
            raw_name=raw_name,
            extracted_dosage=pm.get("dosage"),
        )

        candidates: List[Dict[str, Any]] = []
        if match_res.is_matched:
            candidates = [{
                "medicine_id": match_res.medicine_id,
                "generic_name": match_res.matched_name,
                "brand_name": None,
                "strength": match_res.strength,
                "form": match_res.form,
                "category": None,
                "match_confidence": match_res.confidence,
                "match_method": match_res.method,
            }]
        elif match_res.status.value == "AMBIGUOUS" and match_res.candidates:
            candidates = match_res.candidates
        else:
            clean_term = ClinicalNormalizer.clean_name(raw_name) or raw_name
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT
                            medicine_id, generic_name, brand_name, strength, form::TEXT AS form, category,
                            GREATEST(
                                similarity(LOWER(generic_name), LOWER(%s)),
                                similarity(LOWER(COALESCE(brand_name, '')), LOWER(%s))
                            ) AS sim_score
                        FROM medicine
                        WHERE similarity(LOWER(generic_name), LOWER(%s)) > 0.15
                           OR similarity(LOWER(COALESCE(brand_name,'')), LOWER(%s)) > 0.15
                           OR LOWER(generic_name) ILIKE %s
                           OR LOWER(COALESCE(brand_name, '')) ILIKE %s
                        ORDER BY sim_score DESC
                        LIMIT 8
                        """,
                        (clean_term, clean_term, clean_term, clean_term, f"%{clean_term}%", f"%{clean_term}%"),
                    )
                    rows = cur.fetchall()
            candidates = [
                {
                    "medicine_id": r["medicine_id"],
                    "generic_name": r["generic_name"],
                    "brand_name": r["brand_name"],
                    "strength": r["strength"],
                    "form": r["form"],
                    "category": r["category"],
                    "match_confidence": float(r["sim_score"] or 0),
                    "match_method": "fallback_trgm",
                }
                for r in rows
            ]

        return {
            "pm_id": pm_id,
            "raw_name": raw_name,
            "match_status": match_status,
            "candidates": candidates,
        }

    def resolve_prescription_medicine(
        self,
        pm_id: int,
        medicine_id: int,
        patient_user_id: int,
    ) -> Optional[Dict[str, Any]]:
        """Commit user-confirmed medicine match, update aliases, and refresh dispensary requests."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT pm.prescription_medicine_id, pm.prescription_id, pm.name, pm.patient_resolved
                    FROM prescription_medicine pm
                    JOIN prescription rx ON rx.prescription_id = pm.prescription_id
                    JOIN patient pt       ON pt.patient_id      = rx.patient_id
                    WHERE pm.prescription_medicine_id = %s AND pt.user_id = %s
                    """,
                    (pm_id, patient_user_id),
                )
                pm_row = cur.fetchone()
                if not pm_row:
                    return None

                prescription_id = pm_row["prescription_id"]

                cur.execute(
                    "SELECT medicine_id, generic_name, brand_name, strength, form::TEXT AS form, category FROM medicine WHERE medicine_id = %s",
                    (medicine_id,),
                )
                med_row = cur.fetchone()
                if not med_row:
                    raise ValueError(f"Medicine ID {medicine_id} does not exist in central catalog.")

                cur.execute(
                    """
                    UPDATE prescription_medicine
                    SET medicine_id = %s, match_status = 'MATCHED', patient_resolved = TRUE
                    WHERE prescription_medicine_id = %s
                    """,
                    (medicine_id, pm_id),
                )

                # Self-learning alias storage
                raw_text = pm_row.get("name")
                if raw_text:
                    alias_clean = ClinicalNormalizer.clean_name(raw_text)
                    if alias_clean and len(alias_clean) >= 2:
                        try:
                            cur.execute(
                                """
                                INSERT INTO medicine_alias (alias_name, medicine_id, alias_type, notes)
                                VALUES (LOWER(%s), %s, 'user_learned', 'Learned from patient confirmation')
                                ON CONFLICT (alias_name) DO UPDATE SET medicine_id = EXCLUDED.medicine_id
                                """,
                                (alias_clean, medicine_id),
                            )
                        except Exception as exc:
                            logger.debug("Could not persist learned alias: %s", exc)

                conn.commit()

        # Trigger dispensary fulfillment queue re-evaluation with updated medicine_id
        try:
            from services.dispensary import default_fulfillment_service
            default_fulfillment_service.create_dispensary_request_for_prescription(prescription_id)
        except Exception as exc:
            logger.debug("Dispensary auto re-evaluation notice: %s", exc)

        return {
            "pm_id": pm_id,
            "prescription_id": prescription_id,
            "medicine_id": med_row["medicine_id"],
            "generic_name": med_row["generic_name"],
            "brand_name": med_row["brand_name"],
            "strength": med_row["strength"],
            "form": med_row["form"],
            "category": med_row["category"],
            "patient_resolved": True,
        }

    def update_patient_medication_status(
        self,
        patient_user_id: int,
        current_medication_id: int,
        status: str,
        end_date: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update active medication status (ACTIVE, DISCONTINUED, COMPLETED)."""
        valid_statuses = {"ACTIVE", "DISCONTINUED", "COMPLETED"}
        norm_status = status.strip().upper()
        if norm_status not in valid_statuses:
            raise ValueError(f"Invalid medication status: '{status}'. Must be one of {valid_statuses}")

        parsed_end = None
        if end_date:
            try:
                parsed_end = _dt.date.fromisoformat(end_date)
            except ValueError:
                raise ValueError(f"Invalid end_date format: '{end_date}'. Expected YYYY-MM-DD.")
        elif norm_status in ("DISCONTINUED", "COMPLETED"):
            parsed_end = _dt.date.today()

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT cm.current_medication_id, cm.patient_id, cm.status, cm.end_date
                    FROM current_medication cm
                    JOIN patient pt ON pt.patient_id = cm.patient_id
                    WHERE cm.current_medication_id = %s AND pt.user_id = %s
                    """,
                    (current_medication_id, patient_user_id),
                )
                if not cur.fetchone():
                    raise ValueError("Medication record not found or access denied.")

                cur.execute(
                    """
                    UPDATE current_medication
                    SET status = %s,
                        end_date = COALESCE(%s, end_date),
                        notes = COALESCE(%s, notes),
                        updated_at = NOW()
                    WHERE current_medication_id = %s
                    RETURNING current_medication_id, status, start_date, end_date, notes
                    """,
                    (norm_status, parsed_end.isoformat() if parsed_end else None, notes, current_medication_id),
                )
                updated = cur.fetchone()

        return {
            "success": True,
            "message": f"Medication marked as {norm_status}.",
            "medication": dict(updated),
        }


default_care_service = PatientCareService()

