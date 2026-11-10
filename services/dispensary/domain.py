"""Dispensary domain models and value objects."""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class RequestStatus(str, Enum):
    """Lifecycle status of a dispensary fulfillment order ticket."""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    DISPENSED = "DISPENSED"
    CANCELLED = "CANCELLED"
    RECONSULTATION_NEEDED = "RECONSULTATION_NEEDED"
    PARTIALLY_AVAILABLE = "PARTIALLY_AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"


class AvailabilityStatus(str, Enum):
    """Item-level stock availability and pharmacist resolution status."""
    AVAILABLE = "AVAILABLE"
    PARTIAL = "PARTIAL"
    UNAVAILABLE = "UNAVAILABLE"
    SUBSTITUTED = "SUBSTITUTED"
    RECONSULTATION_NEEDED = "RECONSULTATION_NEEDED"
    MATCHED = "MATCHED"
    AMBIGUOUS = "AMBIGUOUS"
    UNRESOLVED = "UNRESOLVED"
    NOT_A_MEDICINE = "NOT_A_MEDICINE"


class StockStatus(str, Enum):
    """Inventory quantity threshold categorization."""
    NORMAL = "NORMAL"
    LOW_STOCK = "LOW_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"


@dataclass(frozen=True)
class DispensaryProfile:
    """Dispensary organization account and location entity."""
    dispensary_id: int
    hospital_id: Optional[int]
    name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    operating_hours: Optional[str] = None
    avg_prep_minutes: int = 15
    status: str = "ACTIVE"
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dispensary_id": self.dispensary_id,
            "hospital_id": self.hospital_id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "location": self.location,
            "address": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "operating_hours": self.operating_hours,
            "avg_prep_minutes": self.avg_prep_minutes,
            "status": self.status,
            "created_at": self.created_at,
        }


@dataclass(frozen=True)
class StockItem:
    """Dispensary inventory record with dynamic free-stock calculation."""
    inventory_id: int
    dispensary_id: int
    medicine_id: int
    generic_name: str
    brand_name: Optional[str]
    category: Optional[str]
    strength: Optional[str]
    form: Optional[str]
    available_quantity: int
    reserved_quantity: int
    reorder_level: int
    unit: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @property
    def free_stock(self) -> int:
        return max(0, self.available_quantity - self.reserved_quantity)

    @property
    def stock_status(self) -> StockStatus:
        if self.free_stock <= 0:
            return StockStatus.OUT_OF_STOCK
        elif self.free_stock <= self.reorder_level:
            return StockStatus.LOW_STOCK
        return StockStatus.NORMAL

    def to_dict(self) -> Dict[str, Any]:
        return {
            "inventory_id": self.inventory_id,
            "dispensary_id": self.dispensary_id,
            "medicine_id": self.medicine_id,
            "generic_name": self.generic_name,
            "brand_name": self.brand_name,
            "category": self.category,
            "strength": self.strength,
            "form": self.form,
            "available_quantity": self.available_quantity,
            "reserved_quantity": self.reserved_quantity,
            "free_stock": self.free_stock,
            "reorder_level": self.reorder_level,
            "unit": self.unit,
            "status": self.stock_status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class DispensaryRequestItem:
    """Line item in a dispensary order ticket."""
    item_id: int
    request_id: int
    prescription_medicine_id: int
    medicine_id: Optional[int]
    generic_name: Optional[str]
    brand_name: Optional[str]
    strength: Optional[str]
    form: Optional[str]
    dosage: Optional[str]
    frequency: Optional[str]
    duration: Optional[str]
    instructions: Optional[str]
    required_quantity: int
    dispensed_quantity: Optional[int] = None
    availability_status: str = "AVAILABLE"
    reserved: bool = False
    reconsultation_needed: bool = False
    reconsultation_notes: Optional[str] = None
    suggested_substitute_id: Optional[int] = None
    substitute_name: Optional[str] = None
    substitute_brand: Optional[str] = None
    substitute_strength: Optional[str] = None
    substitute_form: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class DispensaryOrder:
    """Aggregate root for a dispensary order fulfillment ticket."""
    request_id: int
    prescription_id: int
    dispensary_id: int
    patient_id: int
    patient_name: str
    patient_phone: Optional[str]
    patient_email: Optional[str]
    status: RequestStatus
    estimated_ready_at: Optional[str] = None
    ready_at: Optional[str] = None
    dispensed_at: Optional[str] = None
    pickup_code: Optional[str] = None
    pharmacist_notes: Optional[str] = None
    reconsultation_reason: Optional[str] = None
    verified_at: Optional[str] = None
    verified_by_user_id: Optional[int] = None
    verification_signature: Optional[str] = None
    created_at: Optional[str] = None
    items: List[DispensaryRequestItem] = field(default_factory=list)

