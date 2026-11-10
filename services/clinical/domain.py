"""Domain models for clinical ontology normalization and matching."""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class MatchStatus(str, Enum):
    """Resolution status of a clinical medicine matching operation."""
    MATCHED = "MATCHED"
    AMBIGUOUS = "AMBIGUOUS"
    UNRESOLVED = "UNRESOLVED"
    NOT_A_MEDICINE = "NOT_A_MEDICINE"


@dataclass(frozen=True)
class MatchCandidate:
    """A plausible candidate medicine matched from the catalog."""
    medicine_id: int
    matched_name: str
    rxcui: Optional[str]
    confidence: float
    method: str
    form: Optional[str] = None
    strength: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "medicine_id": self.medicine_id,
            "matched_name": self.matched_name,
            "rxcui": self.rxcui,
            "confidence": round(self.confidence, 3),
            "method": self.method,
            "form": self.form,
            "strength": self.strength,
        }


@dataclass(frozen=True)
class MatchResult:
    """Outcome of a medicine resolution operation."""
    status: MatchStatus
    medicine_id: Optional[int] = None
    matched_name: Optional[str] = None
    rxcui: Optional[str] = None
    confidence: float = 0.0
    method: str = "none"
    form: Optional[str] = None
    strength: Optional[str] = None
    candidates: List[Dict[str, Any]] = field(default_factory=list)
    reason: str = ""

    @property
    def is_matched(self) -> bool:
        return self.status == MatchStatus.MATCHED

    def to_dict(self) -> Dict[str, Any]:
        """Convert to standard legacy dict format for full backwards compatibility."""
        if self.status == MatchStatus.MATCHED:
            return {
                "status": "MATCHED",
                "medicine_id": self.medicine_id,
                "rxcui": self.rxcui,
                "matched_name": self.matched_name,
                "match_confidence": round(self.confidence, 3),
                "match_method": self.method,
                "form": self.form,
                "strength": self.strength,
            }
        elif self.status == MatchStatus.AMBIGUOUS:
            return {
                "status": "AMBIGUOUS",
                "candidates": self.candidates,
            }
        elif self.status == MatchStatus.NOT_A_MEDICINE:
            return {
                "status": "NOT_A_MEDICINE",
                "reason": self.reason,
            }
        else:
            return {
                "status": "UNRESOLVED",
                "reason": self.reason,
            }


@dataclass(frozen=True)
class ParsedMedication:
    """Structured medication line extracted from OCR or electronic prescription."""
    raw_name: str
    cleaned_name: str
    extracted_dosage: Optional[str] = None
    extracted_form: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None

