"""Clinical Ontology and Medicine Matching Package."""

from services.clinical.domain import MatchStatus, MatchCandidate, MatchResult, ParsedMedication
from services.clinical.normalizer import ClinicalNormalizer
from services.clinical.synonyms import SynonymBridge
from services.clinical.repository import MedicineCatalogRepository
from services.clinical.matcher_service import MedicineMatcherService, default_matcher_service
from services.clinical.ai_fallback_service import AIMedicineFallbackService, default_ai_fallback_service

__all__ = [
    "MatchStatus",
    "MatchCandidate",
    "MatchResult",
    "ParsedMedication",
    "ClinicalNormalizer",
    "SynonymBridge",
    "MedicineCatalogRepository",
    "MedicineMatcherService",
    "default_matcher_service",
    "AIMedicineFallbackService",
    "default_ai_fallback_service",
]

