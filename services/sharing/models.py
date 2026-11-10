"""Domain models for prescription share token management."""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class ShareTokenItem:
    """Persisted share token item."""
    id: int
    token: str
    label: Optional[str]
    expires_at: Optional[datetime]
    is_active: bool
    created_at: datetime
    status: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "token": self.token,
            "label": self.label,
            "expires_at": self.expires_at,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "status": self.status,
        }


@dataclass(frozen=True)
class ShareTokenPreview:
    """Publicly visible share token preview metadata."""
    patient_display_name: str
    label: Optional[str]
    expires_at: Optional[datetime]
    valid: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient_display_name": self.patient_display_name,
            "label": self.label,
            "expires_at": self.expires_at,
            "valid": self.valid,
        }

