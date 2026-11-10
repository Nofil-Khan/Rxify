"""Medication Reconciliation Facade Layer (Backwards-Compatible Interface).

Delegates clinical course synthesis to MedicationReconciliationService under services.patient_care.
"""

from __future__ import annotations
from typing import Any, Dict, Optional

from services.patient_care.reconciliation_service import (
    ACUTE_CATEGORIES,
    ACUTE_STEMS,
    default_reconciliation_service,
)

__all__ = [
    "ACUTE_CATEGORIES",
    "ACUTE_STEMS",
    "is_acute_medication",
    "reconcile_prescription_item",
    "reconcile_patient_prescriptions",
    "enforce_newest_prescription_active_status",
    "migrate_legacy_current_medications",
]


def is_acute_medication(
    generic_name: Optional[str],
    category: Optional[str],
    duration_days: Optional[int],
) -> bool:
    return default_reconciliation_service.is_acute_medication(generic_name, category, duration_days)


def reconcile_prescription_item(
    prescription_id: int,
    pm: Dict[str, Any],
    patient_id: int,
    issue_date: Any,
    doctor_id: Optional[int],
    cur: Any,
) -> int:
    return default_reconciliation_service.reconcile_prescription_item(
        prescription_id=prescription_id,
        pm=pm,
        patient_id=patient_id,
        issue_date=issue_date,
        doctor_id=doctor_id,
        cur=cur,
    )


def reconcile_patient_prescriptions(patient_id: int) -> None:
    default_reconciliation_service.reconcile_patient_prescriptions(patient_id)


def enforce_newest_prescription_active_status(patient_id: int, cur: Optional[Any] = None) -> None:
    default_reconciliation_service.enforce_newest_prescription_active_status(patient_id, cur)


def migrate_legacy_current_medications(patient_id: Optional[int] = None) -> int:
    return default_reconciliation_service.migrate_legacy_current_medications(patient_id)
