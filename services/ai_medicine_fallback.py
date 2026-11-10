"""AI Medicine Fallback Facade Layer (Backwards-Compatible Interface).

Delegates clinical AI drug resolution to AIMedicineFallbackService under services.clinical.
"""

from __future__ import annotations
from typing import Any, Dict, Optional

from services.clinical.ai_fallback_service import (
    AIMedicineFallbackService,
    default_ai_fallback_service,
)

__all__ = [
    "predict_medicine_fallback",
    "resolve_unresolved_prescription_medicines",
]


def predict_medicine_fallback(
    raw_name: str,
    extracted_dosage: Optional[str] = None,
    extracted_form: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    return default_ai_fallback_service.predict_medicine_fallback(
        raw_name=raw_name,
        extracted_dosage=extracted_dosage,
        extracted_form=extracted_form,
    )


def resolve_unresolved_prescription_medicines(
    prescription_id: int,
    dispensary_id: Optional[int] = None,
) -> int:
    return default_ai_fallback_service.resolve_unresolved_prescription_medicines(
        prescription_id=prescription_id,
        dispensary_id=dispensary_id,
    )
