"""Domain models for prescriptions and medication line items."""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class PrescriptionItem:
    """Individual prescribed medicine line item."""
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    medicine_id: Optional[int] = None
    match_status: str = "UNRESOLVED"
    prescription_medicine_id: Optional[int] = None


@dataclass(frozen=True)
class PrescriptionData:
    """Ingested prescription payload from doctor input or OCR extraction."""
    patient_id: int
    user_id: int
    issue_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_reg_number: Optional[str] = None
    clinic_name: Optional[str] = None
    medications: List[PrescriptionItem] = field(default_factory=list)


@dataclass(frozen=True)
class PrescriptionRecord:
    """Persisted database prescription entity."""
    prescription_id: int
    patient_id: int
    issue_date: Optional[date]
    diagnosis: Optional[str]
    notes: Optional[str]
    created_at: str
    items: List[PrescriptionItem] = field(default_factory=list)

