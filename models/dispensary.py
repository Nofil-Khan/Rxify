"""Dispensary-related Pydantic schemas.

Used by routers/dispensary.py for registration, login, stock management,
request queue handling, and dispensing operations.
"""

from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


# ── Auth & Profile ─────────────────────────────────────────────────────────────

class DispensaryRegister(BaseModel):
    hospital_id: int = Field(..., description="ID of the hospital owning this dispensary")
    name: str = Field(..., description="Dispensary name (e.g. Main Hospital Pharmacy)")
    email: EmailStr = Field(..., description="Unique login email for this dispensary")
    password: str = Field(..., min_length=6, description="Login password")
    phone: Optional[str] = None
    location: Optional[str] = Field(None, description="Physical location (e.g. Ground Floor, Wing B)")
    operating_hours: Optional[str] = Field(None, description="Operating hours (e.g. 08:00 - 20:00 Daily)")
    avg_prep_minutes: int = Field(15, ge=1, description="Average preparation time per order in minutes")


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
