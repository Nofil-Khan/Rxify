"""Prescription-related Pydantic schemas.

Used by routers/prescription.py for share-token management and medicine info.
"""

from typing import Optional

from pydantic import BaseModel


class CreateShareToken(BaseModel):
    """Request body for generating a new prescription share token."""
    label: Optional[str] = None
    expires_in_days: Optional[int] = 7  # None = never expires
