"""Prescription Sharing Service Facade (Backwards-Compatible Interface).

Delegates patient token generation, validation, and shared prescription access
to PrescriptionSharingService under services.sharing.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.sharing import (
    PrescriptionSharingService,
    default_sharing_service,
)

__all__ = [
    "PrescriptionSharingService",
    "default_sharing_service",
    "generate_token",
    "list_tokens",
    "revoke_token",
    "get_token_info",
    "get_prescriptions_by_token",
]


def generate_token(
    patient_user_id: int,
    label: Optional[str] = None,
    expires_in_days: Optional[int] = 7,
) -> Dict[str, Any]:
    return default_sharing_service.generate_token(
        patient_user_id=patient_user_id,
        label=label,
        expires_in_days=expires_in_days,
    )


def list_tokens(patient_user_id: int) -> List[Dict[str, Any]]:
    return default_sharing_service.list_tokens(patient_user_id)


def revoke_token(patient_user_id: int, token_id: int) -> bool:
    return default_sharing_service.revoke_token(patient_user_id, token_id)


def get_token_info(token: str) -> Optional[Dict[str, Any]]:
    return default_sharing_service.get_token_info(token)


def get_prescriptions_by_token(token: str) -> Optional[List[Dict[str, Any]]]:
    return default_sharing_service.get_prescriptions_by_token(token)
