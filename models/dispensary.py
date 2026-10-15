"""Dispensary-related Pydantic schemas.

Used by routers/dispensary.py for registration, login, stock management,
request queue handling, and dispensing operations.
"""

from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Auth & Profile ─────────────────────────────────────────────────────────────

class DispensaryRegister(BaseModel):
    hospital_id: Optional[int] = Field(None, description="Optional ID of associated hospital (None for independent dispensary)")
    name: str = Field(..., description="Dispensary name (e.g. Main Hospital Pharmacy)")
    email: EmailStr = Field(..., description="Unique login email for this dispensary")
    password: str = Field(..., min_length=6, description="Login password")
    phone: Optional[str] = None
    location: Optional[str] = Field(None, description="Physical location (e.g. Ground Floor, Wing B)")
    operating_hours: Optional[str] = Field(None, description="Operating hours (e.g. 08:00 - 20:00 Daily)")
    avg_prep_minutes: int = Field(15, ge=1, description="Average preparation time per order in minutes")


class DispensaryLocationUpdate(BaseModel):
    """Body for PATCH /api/dispensary/location — update GPS coordinates and address."""
    latitude: float = Field(..., ge=-90, le=90, description="GPS latitude of the dispensary (-90 to 90)")
    longitude: float = Field(..., ge=-180, le=180, description="GPS longitude of the dispensary (-180 to 180)")
    address: Optional[str] = Field(
        None,
        max_length=500,
        description="Human-readable address from reverse geocoding (optional)",
    )

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        if not (-90.0 <= v <= 90.0):
            raise ValueError(f"latitude must be between -90 and 90, got {v}")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        if not (-180.0 <= v <= 180.0):
            raise ValueError(f"longitude must be between -180 and 180, got {v}")
        return v


class DispensaryLogin(BaseModel):
    email: EmailStr
    password: str


# ── Inventory Stock ────────────────────────────────────────────────────────────

class StockAddOrUpdateRequest(BaseModel):
    medicine_id: int = Field(..., description="Catalog medicine ID")
    available_quantity: int = Field(..., ge=0, description="Total available physical stock quantity")
    reorder_level: int = Field(10, ge=0, description="Minimum quantity threshold before low-stock alert")
    unit: Optional[str] = Field("units", description="Unit label (e.g. tablets, capsules, bottles)")


class StockPartialUpdate(BaseModel):
    available_quantity: Optional[int] = Field(None, ge=0)
    reorder_level: Optional[int] = Field(None, ge=0)
    unit: Optional[str] = None


# ── Dispensing & Fulfill ────────────────────────────────────────────────────────

class DispenseItemInput(BaseModel):
    item_id: int = Field(..., description="dispensary_request_item ID")
    dispensed_quantity: Optional[int] = Field(None, ge=0, description="Quantity dispensed (defaults to required_quantity if null)")


class DispenseRequestBody(BaseModel):
    items: Optional[List[DispenseItemInput]] = Field(None, description="List of item quantities dispensed")
    notes: Optional[str] = Field(None, description="Pharmacist notes or instructions")


# ── Inventory Availability (read-only, no reservation) ───────────────────────

class AvailabilityMedicineInput(BaseModel):
    """One resolved medicine entry for a prescription-level availability check."""
    medicine_id: int = Field(..., gt=0, description="Resolved medicine ID from the medicine matcher")
    requested_quantity: int = Field(1, ge=1, description="Quantity required (informational; stock is NOT decremented)")


class PrescriptionAvailabilityRequest(BaseModel):
    """Body for POST /api/dispensary/{dispensary_id}/availability."""
    medicines: List[AvailabilityMedicineInput] = Field(
        ...,
        min_length=1,
        description="List of resolved medicines to check",
    )
