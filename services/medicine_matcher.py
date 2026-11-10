"""Clinical Medicine Matcher Facade Layer (Backwards-Compatible Interface).

Delegates clinical drug resolution and canonical catalog normalization to
MedicineMatcherService under services.clinical.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.clinical import (
    MatchStatus,
    MatchCandidate,
    MatchResult,
    default_matcher_service,
)

__all__ = [
    "MatchStatus",
    "MatchCandidate",
    "MatchResult",
    "resolve_medicine",
    "resolve_prescription_medications",
]


def resolve_medicine(
    raw_name: str,
    extracted_dosage: Optional[str] = None,
    extracted_form: Optional[str] = None,
) -> Dict[str, Any]:
    """Resolve a raw medication string against the canonical catalog using the 5-tier pipeline."""
    result = default_matcher_service.resolve(
        raw_name=raw_name,
        extracted_dosage=extracted_dosage,
        extracted_form=extracted_form,
    )
    return result.to_dict()


def resolve_prescription_medications(
    medications: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Batch-resolve multiple extracted medication rows."""
    return default_matcher_service.resolve_batch(medications)
