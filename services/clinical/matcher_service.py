"""Clinical Medicine Resolution Service implementing the 5-tier matching pipeline."""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional

from services.clinical.domain import MatchResult, MatchStatus, MatchCandidate
from services.clinical.normalizer import ClinicalNormalizer
from services.clinical.synonyms import SynonymBridge
from services.clinical.repository import MedicineCatalogRepository

logger = logging.getLogger(__name__)


class MedicineMatcherService:
    """Orchestrates multi-tier clinical drug resolution against canonical RxNorm database."""

    def __init__(self, repository: Optional[MedicineCatalogRepository] = None):
        self._repo = repository or MedicineCatalogRepository()

    def resolve(
        self,
        raw_name: str,
        extracted_dosage: Optional[str] = None,
        extracted_form: Optional[str] = None,
    ) -> MatchResult:
        """Execute the 5-tier resolution pipeline for a raw medicine string."""
        if not raw_name or not raw_name.strip():
            return MatchResult(status=MatchStatus.UNRESOLVED, reason="Empty input")

        # ── Tier 0: Non-Medicine Guard ──────────────────────────────────────
        if ClinicalNormalizer.is_obviously_not_medicine(raw_name):
            return MatchResult(
                status=MatchStatus.NOT_A_MEDICINE,
                reason=f"Input {raw_name!r} matches non-medicine vocabulary.",
            )

        clean = ClinicalNormalizer.clean_name(raw_name)
        if not clean:
            return MatchResult(status=MatchStatus.UNRESOLVED, reason="Could not extract valid medicine tokens")

        target_strength = extracted_dosage or ClinicalNormalizer.extract_strength(raw_name)

        # ── Tier 1: Exact Alias Lookup ──────────────────────────────────────
        alias_row = self._repo.lookup_alias(clean)
        if alias_row:
            return self._build_matched_result(alias_row, confidence=1.0, method="alias_table")

        # ── Tier 2: International Synonym Bridge ────────────────────────────
        synonym = SynonymBridge.resolve_synonym(clean)
        if synonym:
            syn_rows = self._repo.lookup_exact(synonym)
            if syn_rows:
                best = self._pick_best_candidate(syn_rows, target_strength)
                return self._build_matched_result(best, confidence=0.98, method="synonym_bridge")

        # ── Tier 3: Exact Catalog Match ─────────────────────────────────────
        exact_rows = self._repo.lookup_exact(clean)
        if exact_rows:
            best = self._pick_best_candidate(exact_rows, target_strength)
            return self._build_matched_result(best, confidence=0.95, method="exact_catalog")

        # ── Tier 4: Trigram Fuzzy Matching (pg_trgm) ────────────────────────
        trgm_rows = self._repo.lookup_trgm(clean, min_similarity=0.35, limit=5)
        if trgm_rows:
            top = trgm_rows[0]
            sim = float(top.get("sim", 0.0))
            if sim >= 0.70:
                best = self._pick_best_candidate([r for r in trgm_rows if float(r.get("sim", 0.0)) >= 0.65], target_strength)
                return self._build_matched_result(best, confidence=sim, method="trgm_high_confidence")
            elif sim >= 0.45:
                # Disambiguate if single clear winner
                if len(trgm_rows) == 1 or (sim - float(trgm_rows[1].get("sim", 0.0))) >= 0.10:
                    return self._build_matched_result(top, confidence=sim, method="trgm_fuzzy")
                else:
                    candidates = [
                        MatchCandidate(
                            medicine_id=r["medicine_id"],
                            matched_name=r["generic_name"],
                            rxcui=r.get("rxcui"),
                            confidence=float(r.get("sim", 0.0)),
                            method="trgm_ambiguous",
                            form=r.get("form"),
                            strength=r.get("strength"),
                        ).to_dict()
                        for r in trgm_rows[:3]
                    ]
                    return MatchResult(status=MatchStatus.AMBIGUOUS, candidates=candidates)

        # ── Tier 5: Fast AI Clinical Fallback ───────────────────────────────
        try:
            from services.ai_medicine_fallback import predict_medicine_fallback
            ai_res = predict_medicine_fallback(raw_name, extracted_dosage=extracted_dosage, extracted_form=extracted_form)
            if ai_res and ai_res.get("status") == "MATCHED":
                return MatchResult(
                    status=MatchStatus.MATCHED,
                    medicine_id=ai_res.get("medicine_id"),
                    matched_name=ai_res.get("matched_name"),
                    rxcui=ai_res.get("rxcui"),
                    confidence=float(ai_res.get("match_confidence", 0.85)),
                    method="ai_clinical_fallback",
                    form=ai_res.get("form"),
                    strength=ai_res.get("strength"),
                )
        except Exception as err:
            logger.debug("AI fallback skipped or encountered exception: %s", err)

        return MatchResult(
            status=MatchStatus.UNRESOLVED,
            reason=f"No matching medicine candidate found for {clean!r}",
        )

    def resolve_batch(self, medications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Resolve a full list of OCR extracted medication dictionaries."""
        results = []
        for med in medications:
            raw_name = med.get("raw_name") or med.get("name") or ""
            dosage = med.get("dosage")
            form = med.get("form")
            match = self.resolve(raw_name, extracted_dosage=dosage, extracted_form=form)
            results.append({**med, "match": match.to_dict()})
        return results

    def _build_matched_result(self, row: dict, confidence: float, method: str) -> MatchResult:
        return MatchResult(
            status=MatchStatus.MATCHED,
            medicine_id=row["medicine_id"],
            matched_name=row.get("generic_name") or row.get("brand_name", ""),
            rxcui=row.get("rxcui"),
            confidence=confidence,
            method=method,
            form=row.get("form"),
            strength=row.get("strength"),
        )

    def _pick_best_candidate(self, rows: List[dict], target_strength: Optional[str]) -> dict:
        if not target_strength or len(rows) == 1:
            return rows[0]
        for r in rows:
            if ClinicalNormalizer.strengths_match(target_strength, r.get("strength")):
                return r
        return rows[0]


# Default singleton instance
default_matcher_service = MedicineMatcherService()

