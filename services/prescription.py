"""Prescription Ingestion Facade Layer (Backwards-Compatible Interface).

Delegates OCR prescription ingestion, date parsing, frequency parsing, and
active medication population to PrescriptionService under services.prescription.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.prescription import (
    PrescriptionDateParser,
    DosageScheduleParser,
    default_prescription_service,
)

__all__ = [
    "parse_date_string",
    "parse_duration_to_days",
    "parse_frequency",
    "insert_prescription",
    "get_medicine_info",
]


def parse_date_string(val: Any) -> Optional[str]:
    return PrescriptionDateParser.parse_date_string(val)


def parse_duration_to_days(duration: str) -> Optional[int]:
    return DosageScheduleParser.parse_duration_days(duration)


def parse_frequency(freq: str) -> List[str]:
    return DosageScheduleParser.parse_frequency_slots(freq)


def insert_prescription(extracted: Dict[str, Any], user_id: int) -> int:
    return default_prescription_service.ingest_extracted_prescription(extracted, user_id)


def get_medicine_info(prescription_id: int, user_id: int) -> List[Dict[str, Any]]:
    return default_prescription_service.get_prescription_medications(prescription_id, user_id)
