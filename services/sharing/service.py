"""Prescription sharing service domain logic."""

from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import uuid

from services.sharing.models import ShareTokenItem, ShareTokenPreview
from services.sharing.repository import SharingRepository, default_sharing_repo


class PrescriptionSharingService:
    """Manages secure prescription share tokens and public-facing token resolution."""

    def __init__(self, repo: Optional[SharingRepository] = None) -> None:
        self.repo = repo or default_sharing_repo

    def resolve_patient_id(self, user_id: int) -> Optional[int]:
        """Return patient_id for a given users.user_id, or None if not found."""
        return self.repo.resolve_patient_id(user_id)

    def generate_token(
        self,
        patient_user_id: int,
        label: Optional[str] = None,
        expires_in_days: Optional[int] = 7,
    ) -> Dict[str, Any]:
        """Create a new share token for a patient and persist it."""
        patient_id = self.resolve_patient_id(patient_user_id)
        if patient_id is None:
            raise ValueError(f"No patient profile found for user_id={patient_user_id}")

        token_value = str(uuid.uuid4())
        expires_at: Optional[datetime] = None
        if expires_in_days is not None:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

        return self.repo.create_token(
            patient_id=patient_id,
            token_value=token_value,
            label=label,
            expires_at=expires_at,
        )

    def list_tokens(self, patient_user_id: int) -> List[Dict[str, Any]]:
        """Return all share tokens belonging to a patient (active, expired, and revoked)."""
        patient_id = self.resolve_patient_id(patient_user_id)
        if patient_id is None:
            return []

        rows = self.repo.list_patient_tokens(patient_id)
        now = datetime.now(timezone.utc)
        tokens: List[Dict[str, Any]] = []

        for row in rows:
            record = dict(row)
            if not record["is_active"]:
                record["status"] = "revoked"
            elif record["expires_at"] and record["expires_at"] < now:
                record["status"] = "expired"
            else:
                record["status"] = "active"

            item = ShareTokenItem(
                id=record["id"],
                token=record["token"],
                label=record.get("label"),
                expires_at=record.get("expires_at"),
                is_active=record["is_active"],
                created_at=record["created_at"],
                status=record["status"],
            )
            tokens.append(item.to_dict())

        return tokens

    def revoke_token(self, patient_user_id: int, token_id: int) -> bool:
        """Deactivate a share token."""
        patient_id = self.resolve_patient_id(patient_user_id)
        if patient_id is None:
            return False
        return self.repo.deactivate_token(patient_id, token_id)

    def resolve_token(self, token: str) -> Optional[int]:
        """Validate a share token and return its patient_id, or None if invalid/expired."""
        row = self.repo.get_token_record(token)
        if row is None or not row["is_active"]:
            return None
        if row["expires_at"] and row["expires_at"] < datetime.now(timezone.utc):
            return None
        return row["patient_id"]

    def get_token_info(self, token: str) -> Optional[Dict[str, Any]]:
        """Return basic public metadata about a valid token."""
        patient_id = self.resolve_token(token)
        if patient_id is None:
            return None

        token_row = self.repo.get_token_record(token)
        display_name = self.repo.get_patient_public_name(patient_id)

        preview = ShareTokenPreview(
            patient_display_name=display_name or "Anonymous Patient",
            label=token_row.get("label") if token_row else None,
            expires_at=token_row.get("expires_at") if token_row else None,
            valid=True,
        )
        return preview.to_dict()

    def get_prescriptions_by_token(self, token: str) -> Optional[List[Dict[str, Any]]]:
        """Return prescription history for the patient linked to this token."""
        patient_id = self.resolve_token(token)
        if patient_id is None:
            return None
        return self.repo.get_shared_prescriptions(patient_id)


default_sharing_service = PrescriptionSharingService()

