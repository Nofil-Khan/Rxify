"""Medicine Matching / Resolution service.

Takes a raw extracted medicine name (from Gemini OCR) and resolves it against
the ``medicine`` catalog table using a deterministic, layered strategy:

  1. Alias table  — exact manual mappings (brand names, OCR variants)
  2. Exact match  — case-insensitive equality on generic_name or brand_name
  3. Strength-aware exact match — name + normalised strength
  4. pg_trgm fuzzy match — similarity() on generic_name / brand_name
  5. Non-medicine guard — reject obvious non-medicine strings

Status values returned:
  MATCHED       — a single confident candidate was found
  AMBIGUOUS     — multiple plausible candidates; caller must decide
  UNRESOLVED    — no match found; medicine may exist but we cannot confirm it
  NOT_A_MEDICINE — input is clearly not a medicine

No LLM calls are made here.  Matching is entirely SQL + Python logic.

Usage (from prescription service or any other caller)::

    from services.medicine_matcher import resolve_medicine
    result = resolve_medicine("Tab Janumet 50/500mg")
"""

from __future__ import annotations

from enum import Enum
import logging
import re
from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn

logger = logging.getLogger(__name__)

# =============================================================================
# Constants & tunables
# =============================================================================

# Minimum trgm similarity to even consider a candidate
_TRGM_MIN_SIMILARITY: float = 0.30

# Above this → MATCHED (single result wins outright)
_TRGM_HIGH_CONFIDENCE: float = 0.70

# Between min and high with a clear winner → MATCHED (lower confidence)
_TRGM_MEDIUM_CONFIDENCE: float = 0.45

# Gap between top-1 and top-2 similarity; below this → AMBIGUOUS
_TRGM_AMBIGUITY_GAP: float = 0.10

# Maximum candidates to return for AMBIGUOUS status
_MAX_AMBIGUOUS_CANDIDATES: int = 5

# Form prefix words that should be stripped before matching
_FORM_PREFIXES = frozenset({
    "tab", "tablet", "tablets",
    "cap", "caps", "capsule", "capsules",
    "inj", "injection",
    "syr", "syrup",
    "susp", "suspension",
    "oint", "ointment",
    "cre", "cream",
    "gel",
    "drp", "drops",
    "inh", "inhaler",
    "patch",
    "sachet",
    "sol", "solution",
    "pwd", "powder",
    "supp", "suppository",
})

# Strings that are definitive non-medicines (short-circuit before any DB call)
_OBVIOUS_NON_MEDICINE_PATTERNS = [
    re.compile(r"\b(naan|paratha|roti|paneer|chicken|mutton|biryani|pizza|burger|fries)\b", re.IGNORECASE),
    re.compile(r"\b(milk|tea|coffee|juice|water|food)\b", re.IGNORECASE),
]

# Strength normalisation: strip spaces around / and between number+unit
_STRENGTH_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(mcg|ug|mg|g|ml|iu|meq|mmol|units?|%)",
    re.IGNORECASE,
)


# =============================================================================
# Public types
# =============================================================================

MatchStatus = str  # "MATCHED" | "AMBIGUOUS" | "UNRESOLVED" | "NOT_A_MEDICINE"


def _make_matched(
    medicine_id: int,
    matched_name: str,
    rxcui: Optional[str],
    confidence: float,
    method: str,
    form: Optional[str] = None,
    strength: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "status": "MATCHED",
        "medicine_id": medicine_id,
        "rxcui": rxcui,
        "matched_name": matched_name,
        "match_confidence": round(confidence, 3),
        "match_method": method,
        "form": form,
        "strength": strength,
    }


def _make_ambiguous(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "status": "AMBIGUOUS",
        "candidates": candidates,
    }


def _make_unresolved(reason: str = "") -> Dict[str, Any]:
    return {
        "status": "UNRESOLVED",
        "reason": reason,
    }


def _make_not_a_medicine(reason: str = "") -> Dict[str, Any]:
    return {
        "status": "NOT_A_MEDICINE",
        "reason": reason,
    }


# =============================================================================
# Pre-processing helpers
# =============================================================================

def _strip_form_prefix(name: str) -> str:
    """Remove a leading dosage-form word (Tab, Cap, Inj, etc.) from the name."""
    parts = name.strip().split(None, 1)
    if len(parts) == 2 and parts[0].lower().rstrip(".") in _FORM_PREFIXES:
        return parts[1].strip()
    return name.strip()


def _normalise_combo_separators(text: str) -> str:
    """Normalise dash-separated combo strengths to slash form.

    e.g. "Janumet 50-500" -> "Janumet 50/500"
         "Amox 500-125mg" -> "Amox 500/125mg"

    Only converts dashes that are sandwiched between two numbers (with optional
    spaces), so regular hyphenated names like "co-amoxiclav" are unaffected.
    """
    return re.sub(
        r"(?<=\d)\s*-\s*(?=\d)",
        "/",
        text,
    )


def _extract_strength(text: str) -> Optional[str]:
    """Pull the first strength token (e.g. '500mg', '50/500mg') from a string."""
    text = _normalise_combo_separators(text)
    # Handle multi-ingredient combination strengths like 50/500mg or 50/500
    combo = re.search(
        r"\d+(?:[.,]\d+)?\s*/\s*\d+(?:[.,]\d+)?(?:\s*/\s*\d+(?:[.,]\d+)?)?\s*(?:mg|mcg|ug|g|ml|iu|meq|mmol|units?|%)?",
        text,
        re.IGNORECASE,
    )
    if combo:
        return combo.group(0).strip()
    m = _STRENGTH_RE.search(text)
    if m:
        return m.group(0).strip()
    return None


def _clean_name(raw: str) -> str:
    """
    Return the medicine name with form prefix/suffix and trailing strength tokens removed.
    Lowercased and stripped.

    e.g. "Tab Janumet 50/500mg" -> "janumet"
         "Glimepiride 2mg"      -> "glimepiride"
         "Budetrol M cap"       -> "budetrol m"
         "Janumet 50-500"       -> "janumet"
    """
    name = raw.strip()
    # Normalise dash-separated combo strengths before stripping (e.g. 50-500 -> 50/500)
    name = _normalise_combo_separators(name)
    # Leading form prefix (Tab, Cap, Inj, etc.)
    parts = name.split(None, 1)
    if len(parts) == 2 and parts[0].lower().rstrip(".") in _FORM_PREFIXES:
        name = parts[1].strip()

    # 1. Multi-ingredient / combination strength tokens first (e.g. 50/500mg, 50/500, 10/20)
    name = re.sub(
        r"\d+(?:[.,]\d+)?\s*/\s*\d+(?:[.,]\d+)?(?:\s*/\s*\d+(?:[.,]\d+)?)?\s*(?:mg|mcg|ug|g|ml|iu|meq|mmol|units?|%)?",
        "",
        name,
        flags=re.IGNORECASE,
    )
    # 2. Single strength tokens (e.g. 500mg, 20 mg)
    name = _STRENGTH_RE.sub("", name)

    # 3. Release modifier tokens (e.g. SR, ER, XR, 24 HR, extended release)
    name = re.sub(
        r"\b(24\s*hr|12\s*hr|8\s*hr|extended[\s\-]?release|sustained[\s\-]?release|controlled[\s\-]?release|modified[\s\-]?release|osmotic|\bsr\b|\bxr\b|\ber\b|\bxl\b|\bcr\b|\bla\b|\bcd\b|\bdr\b)",
        "",
        name,
        flags=re.IGNORECASE,
    )

    # 4. Trailing form suffix (e.g. "Budetrol M cap" -> "budetrol m")
    words = name.split()
    if len(words) > 1 and words[-1].lower().rstrip(".") in _FORM_PREFIXES:
        name = " ".join(words[:-1])

    # 5. Trailing slashes, dashes, commas
    name = re.sub(r"[/,\-–\s]+$", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name.lower()


class ReleaseType(str, Enum):
    """Release formulation characteristics derived from rxnorm_name."""
    IR = "IR"
    ER = "ER"
    MODIFIED = "MODIFIED"
    OSMOTIC = "OSMOTIC"
    DR = "DR"


class InputRelease(str, Enum):
    """Explicit release modifiers detected in user/prescription input."""
    NONE = "NONE"
    EXTENDED = "EXTENDED"  # SR, ER, XR, 24 HR, extended release
    MODIFIED = "MODIFIED"
    OSMOTIC = "OSMOTIC"
    DELAYED = "DELAYED"


_UNIT_FACTORS = {
    'g': 1000.0,
    'gm': 1000.0,
    'gram': 1000.0,
    'grams': 1000.0,
    'mg': 1.0,
    'milligram': 1.0,
    'mcg': 0.001,
    'ug': 0.001,
    'microgram': 0.001,
}


def _parse_strength_tokens(text: str):
    """Extract and normalise numeric strength tokens and units."""
    if not text:
        return []
    clean = re.sub(r"\(expressed as [^)]+\)", "", text, flags=re.IGNORECASE).strip()
    parts = [p.strip() for p in clean.split("/") if p.strip()]
    if len(parts) > 1 and not re.search(r"\b(ml|l|actuation|dose)\b", clean, re.IGNORECASE):
        trailing_unit_match = re.search(r"[a-zA-Z%]+$", parts[-1])
        inherited_unit = trailing_unit_match.group(0) if trailing_unit_match else ""
        tokens = []
        for p in parts:
            if inherited_unit and not re.search(r"[a-zA-Z%]", p):
                p = f"{p}{inherited_unit}"
            tokens.extend(_parse_strength_tokens(p))
        return tokens

    matches = list(re.finditer(r"(\d+(?:\.\d+)?)\s*([a-zA-Z%]+(?:\s*/\s*[a-zA-Z%]+)?)?", clean))
    tokens = []
    for m in matches:
        val_str = m.group(1)
        unit_str = (m.group(2) or '').lower().strip()
        val = float(val_str)
        if "/" in unit_str or unit_str in ("%", "unt/ml", "iu/ml", "meq/ml"):
            tokens.append(('conc', val, unit_str.replace(" ", "")))
        elif unit_str in _UNIT_FACTORS:
            tokens.append(('mass', val * _UNIT_FACTORS[unit_str]))
        else:
            tokens.append(('num', val, unit_str))
    return tokens


def _normalise_strength(s: Optional[str]) -> Optional[str]:
    """Normalise a strength string for comparison: lowercase, no spaces."""
    if not s:
        return None
    return re.sub(r"\s+", "", s.lower())


def _strengths_match(input_strength: Optional[str], db_strength: Optional[str]) -> bool:
    """Compare an input strength against a DB strength string.

    Handles:
    - Direct equality ignoring spaces/case: "500mg" == "500 MG"
    - Metric unit conversions: "1g" == "1000 MG", "1000mcg" == "1 MG"
    - Parenthetical descriptors: "10mg" == "10 MG (expressed as cetirizine hydrochloride)"
    - Multi-ingredient permutations: "50/500mg" matches "500 MG / 50 MG"
    - Multi-ingredient sums: "625mg" matches "500 MG / 125 MG" (Augmentin 625)
    - Concentration safety: "10mg" does NOT match "10 MG/ML"
    """
    if not input_strength or not db_strength:
        return False
    n1 = re.sub(r"\s+", "", input_strength.lower())
    n2 = re.sub(r"\s+", "", db_strength.lower())
    if n1 == n2:
        return True

    t1 = _parse_strength_tokens(input_strength)
    t2 = _parse_strength_tokens(db_strength)
    if not t1 or not t2:
        return False

    if len(t1) == len(t2):
        s_t1 = sorted(t1, key=lambda tok: tok[1])
        s_t2 = sorted(t2, key=lambda tok: tok[1])
        match = True
        for a, b in zip(s_t1, s_t2):
            if a[0] == 'mass' and b[0] == 'mass':
                if abs(a[1] - b[1]) > 0.001:
                    match = False
                    break
            elif (a[0] in ('num', 'mass')) and (b[0] in ('num', 'mass')):
                if abs(a[1] - b[1]) > 0.001:
                    match = False
                    break
            elif a[0] == b[0] and a[0] == 'conc':
                if abs(a[1] - b[1]) > 0.001 or a[2] != b[2]:
                    match = False
                    break
            elif a[0] == b[0] and a[0] == 'num':
                if abs(a[1] - b[1]) > 0.001:
                    match = False
                    break
            else:
                match = False
                break
        if match:
            return True

    if len(t1) == 1 and len(t2) > 1:
        if t1[0][0] in ('mass', 'num'):
            sum_t2 = sum(tok[1] for tok in t2 if tok[0] in ('mass', 'num'))
            if abs(t1[0][1] - sum_t2) < 0.01:
                return True
    if len(t2) == 1 and len(t1) > 1:
        if t2[0][0] in ('mass', 'num'):
            sum_t1 = sum(tok[1] for tok in t1 if tok[0] in ('mass', 'num'))
            if abs(t2[0][1] - sum_t1) < 0.01:
                return True

    return False


def _is_obviously_not_medicine(text: str) -> bool:
    """Return True if the string is clearly a food item or non-medicine phrase."""
    for pat in _OBVIOUS_NON_MEDICINE_PATTERNS:
        if pat.search(text):
            return True
    if len(text.split()) > 8:
        return True
    return False


def _extract_input_release_modifier(raw_name: str) -> InputRelease:
    """Detect release modifiers in raw input text."""
    text = raw_name.lower()
    if re.search(r"\b(osmotic|oros)\b", text):
        return InputRelease.OSMOTIC
    if re.search(r"\b(modified[\s\-]?release|modified)\b", text):
        return InputRelease.MODIFIED
    if re.search(r"\b(delayed[\s\-]?release|\bdr\b)", text):
        return InputRelease.DELAYED
    if re.search(
        r"\b(24\s*hr|24\s*hour|12\s*hr|8\s*hr|extended[\s\-]?release|sustained[\s\-]?release|controlled[\s\-]?release|\bsr\b|\bxr\b|\ber\b|\bxl\b|\bcr\b|\bla\b)\b",
        text,
    ):
        return InputRelease.EXTENDED
    return InputRelease.NONE


def _get_candidate_release_type(rxnorm_name: str) -> ReleaseType:
    """Classify candidate release formulation from rxnorm_name."""
    name = (rxnorm_name or "").lower()
    if re.search(r"\bosmotic\b", name):
        return ReleaseType.OSMOTIC
    if re.search(r"\bmodified\b", name):
        return ReleaseType.MODIFIED
    if re.search(r"\bdelayed[\s\-]?release\b", name):
        return ReleaseType.DR
    if re.search(
        r"\b(24\s*hr|12\s*hr|8\s*hr|extended[\s\-]?release|sustained[\s\-]?release|controlled[\s\-]?release|\bsr\b|\bxr\b|\ber\b|\bxl\b|\bcr\b|\bla\b)\b",
        name,
    ):
        return ReleaseType.ER
    return ReleaseType.IR


def _extract_route(rxnorm_name: str, form: Optional[str]) -> str:
    """Extract clinical administration route from rxnorm_name and form."""
    name = (rxnorm_name or "").lower()
    if any(k in name for k in ("oral", "chewable", "disintegrating", "swallow")):
        return "ORAL"
    if any(k in name for k in ("inject", "infusion", "intravenous", "subcutaneous", "intramuscular", "prefilled syringe")):
        return "INJECTION"
    if any(k in name for k in ("nasal",)):
        return "NASAL"
    if any(k in name for k in ("inhal",)):
        return "INHALATION"
    if any(k in name for k in ("ophthalmic", "eye")):
        return "OPHTHALMIC"
    if any(k in name for k in ("rectal", "suppository")):
        return "RECTAL"
    if any(k in name for k in ("topical", "transdermal", "skin", "cream", "ointment", "gel")):
        return "TOPICAL"
    if form in ("TABLET", "CAPSULE"):
        return "ORAL"
    if form == "INJECTION":
        return "INJECTION"
    return "OTHER"


# =============================================================================
# Database query helpers
# =============================================================================

def _row_to_candidate(row: dict, confidence: float, method: str) -> Dict[str, Any]:
    display_name = row.get("brand_name") or row.get("generic_name") or row.get("rxnorm_name") or ""
    return {
        "medicine_id": row["medicine_id"],
        "rxcui": row.get("rxcui"),
        "matched_name": display_name,
        "generic_name": row.get("generic_name"),
        "brand_name": row.get("brand_name"),
        "strength": row.get("strength"),
        "form": row.get("form"),
        "match_confidence": round(confidence, 3),
        "match_method": method,
    }


def _lookup_alias(cur: psycopg2.extras.RealDictCursor, name: str) -> Optional[dict]:
    """Check the medicine_alias table for an exact case-insensitive match."""
    cur.execute(
        """
        SELECT m.medicine_id, m.generic_name, m.brand_name, m.strength,
               m.form::TEXT AS form, m.rxcui, m.rxnorm_name
        FROM medicine_alias a
        JOIN medicine m ON m.medicine_id = a.medicine_id
        WHERE LOWER(a.alias_name) = LOWER(%s)
        LIMIT 1
        """,
        (name,),
    )
    return cur.fetchone()


def _lookup_exact(cur: psycopg2.extras.RealDictCursor, name: str) -> List[dict]:
    """Case-insensitive exact match on generic_name or brand_name."""
    cur.execute(
        """
        SELECT medicine_id, generic_name, brand_name, strength, form::TEXT AS form,
               rxcui, rxnorm_name
        FROM medicine
        WHERE LOWER(generic_name) = LOWER(%s)
           OR LOWER(brand_name)   = LOWER(%s)
        LIMIT 20
        """,
        (name, name),
    )
    return cur.fetchall()


def _lookup_trgm(
    cur: psycopg2.extras.RealDictCursor,
    name: str,
    min_similarity: float = _TRGM_MIN_SIMILARITY,
) -> List[dict]:
    """
    Fuzzy trigram similarity search on generic_name, brand_name, and rxnorm_name.
    Returns rows sorted by best similarity score descending.

    NOTE: form is cast to TEXT to prevent psycopg2 from registering a custom ENUM
    OID typecaster (from a previously executed query on the same cursor) which
    corrupts subsequent %s parameter binding and causes IndexError: tuple index out
    of range. The param tuple must have exactly 10 values matching the 10 %s tokens.
    """
    # 10 %s tokens: 3 in SELECT GREATEST + 3 pairs (name, threshold) in WHERE + 1 LIMIT
    cur.execute(
        """
        SELECT
            medicine_id,
            generic_name,
            brand_name,
            strength,
            form::TEXT AS form,
            rxcui,
            rxnorm_name,
            GREATEST(
                similarity(LOWER(generic_name), LOWER(%s)),
                similarity(LOWER(COALESCE(brand_name, '')), LOWER(%s)),
                similarity(LOWER(COALESCE(rxnorm_name, '')), LOWER(%s))
            ) AS sim_score
        FROM medicine
        WHERE similarity(LOWER(generic_name), LOWER(%s)) > %s
           OR similarity(LOWER(COALESCE(brand_name, '')), LOWER(%s)) > %s
           OR similarity(LOWER(COALESCE(rxnorm_name, '')), LOWER(%s)) > %s
        ORDER BY sim_score DESC
        LIMIT %s
        """,
        (
            name, name, name,           # 3 for SELECT GREATEST
            name, min_similarity,       # 2 for WHERE generic_name
            name, min_similarity,       # 2 for WHERE brand_name
            name, min_similarity,       # 2 for WHERE rxnorm_name
            _MAX_AMBIGUOUS_CANDIDATES + 2,  # 1 for LIMIT
        ),
    )
    return cur.fetchall()


# =============================================================================
# Core resolution logic
# =============================================================================

def resolve_medicine(
    raw_name: str,
    extracted_dosage: Optional[str] = None,
    extracted_form: Optional[str] = None,
) -> Dict[str, Any]:
    """Resolve a raw extracted medicine name to a catalog entry.

    Parameters
    ----------
    raw_name : str
        Medicine name as extracted by Gemini (may include form prefix and strength).
    extracted_dosage : str | None
        Dosage string from the OCR output, e.g. "500 mg" or "50/500 mg".
    extracted_form : str | None
        Dosage form from the OCR output, e.g. "tablet", "capsule".

    Returns
    -------
    dict
        One of:
        - ``{"status": "MATCHED", "medicine_id": ..., "rxcui": ..., ...}``
        - ``{"status": "AMBIGUOUS", "candidates": [...]}``
        - ``{"status": "UNRESOLVED", "reason": "..."}``
        - ``{"status": "NOT_A_MEDICINE", "reason": "..."}``
    """
    if not raw_name or not raw_name.strip():
        return _make_unresolved("Empty medicine name")

    raw_name = raw_name.strip()
    # Normalise dash-separated combo strengths (e.g. "Janumet 50-500" -> "Janumet 50/500")
    # so alias lookup, clean name extraction, and strength parsing all see a consistent form.
    raw_name = _normalise_combo_separators(raw_name)

    # ── Guard: obvious non-medicine ────────────────────────────────────────────
    if _is_obviously_not_medicine(raw_name):
        return _make_not_a_medicine(f"Input does not appear to be a medicine: {raw_name!r}")

    # ── Pre-process the input ──────────────────────────────────────────────────
    clean = _clean_name(raw_name)

    # Strength: prefer extracted_dosage; fall back to detecting it in raw_name
    strength_raw = extracted_dosage or _extract_strength(raw_name)
    strength_norm = _normalise_strength(strength_raw)

    if not clean:
        return _make_unresolved(f"Could not extract a usable name from: {raw_name!r}")

    logger.debug(
        "resolve_medicine: raw=%r  clean=%r  strength=%r  form=%r",
        raw_name, clean, strength_raw, extracted_form,
    )

    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                return _resolve_with_cursor(cur, raw_name, clean, strength_raw, strength_norm, extracted_form)
    except Exception as exc:
        logger.error("Medicine matching DB error for %r: %s", raw_name, exc)
        return _make_unresolved(f"Database error during matching: {exc}")


def _resolve_with_cursor(
    cur: psycopg2.extras.RealDictCursor,
    raw_name: str,
    clean: str,
    strength_raw: Optional[str],
    strength_norm: Optional[str],
    extracted_form: Optional[str],
) -> Dict[str, Any]:
    """Inner resolution — called with an open cursor."""

def _make_matched_from_row(
    row: dict,
    confidence: float,
    method: str,
) -> Dict[str, Any]:
    matched_name = row.get("brand_name") or row.get("generic_name") or row.get("rxnorm_name") or ""
    return _make_matched(
        medicine_id=row["medicine_id"],
        matched_name=matched_name,
        rxcui=row.get("rxcui"),
        confidence=confidence,
        method=method,
        form=row.get("form"),
        strength=row.get("strength"),
    )


def _resolve_candidate_rows(
    candidates: List[dict],
    raw_name: str,
    clean: str,
    strength_raw: Optional[str],
    extracted_form: Optional[str],
    base_confidence: float = 0.95,
    method_prefix: str = "exact",
) -> Dict[str, Any]:
    """Release-aware, form-aware, and equivalence-aware candidate resolution."""
    if not candidates:
        return _make_unresolved(f"No candidates found for {clean!r}")

    input_release = _extract_input_release_modifier(raw_name)

    # 1. Strength Filtering (Requirement 6)
    if strength_raw:
        matching_strength = [c for c in candidates if _strengths_match(strength_raw, c.get("strength"))]
        if matching_strength:
            candidates = matching_strength
            method_prefix = f"{method_prefix}_strength"
        else:
            return _make_unresolved(f"No candidate matching strength {strength_raw!r} found for {clean!r}")

    # 2. Form Filtering (Requirement 6)
    if extracted_form:
        ef = extracted_form.strip().upper()
        matching_form = []
        for c in candidates:
            c_form = (c.get("form") or "").upper()
            c_rx = (c.get("rxnorm_name") or "").upper()
            if c_form == ef or ef in c_rx:
                matching_form.append(c)
            elif ef in ("SYRUP", "SUSPENSION", "SOLUTION") and c_form in ("SYRUP", "OTHER") and any(w in c_rx for w in ("SYRUP", "SUSPENSION", "SOLUTION", "ORAL")):
                matching_form.append(c)
            elif ef == "INJECTION" and (c_form == "INJECTION" or "INJECT" in c_rx):
                matching_form.append(c)
        if matching_form:
            candidates = matching_form
            method_prefix = f"{method_prefix}+form"

    # 3. Check cardinality after strength & form
    if len(candidates) == 1:
        c = candidates[0]
        c_rel = _get_candidate_release_type(c.get("rxnorm_name") or "")
        if input_release != InputRelease.NONE and c_rel == ReleaseType.IR:
            return _make_unresolved(f"Explicit {input_release.value} release requested, but only IR candidate exists")
        return _make_matched_from_row(c, base_confidence, method_prefix)

    # If distinct forms exist among candidates and no form was requested:
    # They do NOT match form, so do not collapse across different forms! (Requirement 7 - Omeprazole 20mg None)
    distinct_forms = {(c.get("form") or "").upper() for c in candidates}
    if len(distinct_forms) > 1:
        return _make_ambiguous([_row_to_candidate(c, base_confidence, method_prefix) for c in candidates[:_MAX_AMBIGUOUS_CANDIDATES]])

    # 4. Release-Aware Resolution (Requirements 1, 2, 3)
    if input_release == InputRelease.NONE:
        # Prescription has NO release modifier:
        # Prefer IR candidate
        ir_cands = [c for c in candidates if _get_candidate_release_type(c.get("rxnorm_name") or "") == ReleaseType.IR]
        er_cands = [c for c in candidates if _get_candidate_release_type(c.get("rxnorm_name") or "") != ReleaseType.IR]
        if ir_cands:
            # If exactly one IR candidate exists and all remaining candidates are release-modified variants:
            # resolve to the IR candidate! (Requirement 2: Metformin 500mg -> 861007)
            if len(ir_cands) == 1 and er_cands:
                return _make_matched_from_row(ir_cands[0], base_confidence, f"{method_prefix}+ir")
            elif len(ir_cands) == 1 and not er_cands:
                return _make_matched_from_row(ir_cands[0], base_confidence, method_prefix)
            else:
                # Multiple IR candidates exist (e.g. Cetirizine 10mg)
                candidates = ir_cands
        # If no IR candidate exists (e.g. Omeprazole Delayed Release Capsule / Tablet), keep candidates
    else:
        # Prescription explicitly specifies release modifier (SR/ER/XR/24HR / OSMOTIC / MODIFIED)
        # NEVER select an IR candidate!
        non_ir_cands = [c for c in candidates if _get_candidate_release_type(c.get("rxnorm_name") or "") != ReleaseType.IR]
        if not non_ir_cands:
            return _make_unresolved(f"No release-modified formulation found for {raw_name!r}")

        if input_release == InputRelease.OSMOTIC:
            osm_cands = [c for c in non_ir_cands if _get_candidate_release_type(c.get("rxnorm_name") or "") == ReleaseType.OSMOTIC]
            if osm_cands:
                non_ir_cands = osm_cands
        elif input_release == InputRelease.MODIFIED:
            mod_cands = [c for c in non_ir_cands if _get_candidate_release_type(c.get("rxnorm_name") or "") == ReleaseType.MODIFIED]
            if mod_cands:
                non_ir_cands = mod_cands

        # Check if multiple clinically distinct release concepts remain:
        distinct_releases = {_get_candidate_release_type(c.get("rxnorm_name") or "") for c in non_ir_cands}
        if len(distinct_releases) > 1 and input_release == InputRelease.EXTENDED:
            # Cannot distinguish -> return AMBIGUOUS (Do NOT arbitrarily select lowest medicine_id 860975)
            return _make_ambiguous([_row_to_candidate(c, base_confidence, method_prefix) for c in non_ir_cands[:_MAX_AMBIGUOUS_CANDIDATES]])

        candidates = non_ir_cands

    # 5. Check cardinality
    if len(candidates) == 1:
        return _make_matched_from_row(candidates[0], base_confidence, method_prefix)

    # 6. Equivalence Canonicalization (Requirement 4)
    first = candidates[0]
    first_equiv = (
        (first.get("generic_name") or "").lower(),
        (first.get("form") or "").upper(),
        _extract_route(first.get("rxnorm_name") or "", first.get("form")),
        _get_candidate_release_type(first.get("rxnorm_name") or ""),
    )
    all_equiv = True
    for c in candidates[1:]:
        equiv = (
            (c.get("generic_name") or "").lower(),
            (c.get("form") or "").upper(),
            _extract_route(c.get("rxnorm_name") or "", c.get("form")),
            _get_candidate_release_type(c.get("rxnorm_name") or ""),
        )
        if equiv != first_equiv or not _strengths_match(first.get("strength"), c.get("strength")):
            all_equiv = False
            break

    if all_equiv:
        best = min(candidates, key=lambda c: c["medicine_id"])
        return _make_matched_from_row(best, base_confidence, f"{method_prefix}+canonical")

    return _make_ambiguous([_row_to_candidate(c, base_confidence, method_prefix) for c in candidates[:_MAX_AMBIGUOUS_CANDIDATES]])


def _resolve_with_cursor(
    cur: psycopg2.extras.RealDictCursor,
    raw_name: str,
    clean: str,
    strength_raw: Optional[str],
    strength_norm: Optional[str],
    extracted_form: Optional[str],
) -> Dict[str, Any]:
    """Inner resolution — called with an open cursor."""

    # ── Step 1: Alias table lookup ─────────────────────────────────────────────
    # Try: full raw_name, clean name (no form prefix), raw_name stripped of form
    input_release = _extract_input_release_modifier(raw_name)
    has_explicit_constraint = bool(strength_raw or extracted_form or (input_release != InputRelease.NONE))

    for attempt in (raw_name, clean, _strip_form_prefix(raw_name)):
        if not attempt:
            continue
        alias_row = _lookup_alias(cur, attempt)
        if alias_row:
            row = dict(alias_row)
            # Aliases must NEVER override explicit strength, form, or release information.
            if has_explicit_constraint:
                sister_rows = _lookup_exact(cur, row.get("generic_name") or "")
                if sister_rows:
                    res = _resolve_candidate_rows(
                        [dict(s) for s in sister_rows],
                        raw_name,
                        clean,
                        strength_raw,
                        extracted_form,
                        base_confidence=1.0,
                        method_prefix="alias",
                    )
                    if res.get("status") in ("MATCHED", "AMBIGUOUS"):
                        return res
                    # If UNRESOLVED, the alias's generic medicine does NOT satisfy the explicit constraints!
                    # Do NOT fall back to row with wrong strength/form/release.
                    continue
                else:
                    st_ok = not strength_raw or _strengths_match(strength_raw, row.get("strength"))
                    fm_ok = not extracted_form or (row.get("form") or "").upper() == extracted_form.strip().upper()
                    if not (st_ok and fm_ok):
                        continue

            return _make_matched(
                medicine_id=row["medicine_id"],
                matched_name=row.get("brand_name") or row.get("generic_name") or attempt,
                rxcui=row.get("rxcui"),
                confidence=1.0,
                method="alias",
                form=row.get("form"),
                strength=row.get("strength"),
            )

    # ── Step 2: Exact name match on generic_name or brand_name ────────────────
    rows = _lookup_exact(cur, clean)
    if rows:
        cand_dicts = [dict(r) for r in rows]
        res = _resolve_candidate_rows(
            cand_dicts,
            raw_name,
            clean,
            strength_raw,
            extracted_form,
            base_confidence=0.95 if strength_raw else 0.85,
            method_prefix="exact_name",
        )
        if res.get("status") in ("MATCHED", "AMBIGUOUS"):
            return res
        if strength_raw:
            return res

    # ── Step 3: Fuzzy trigram search ──────────────────────────────────────────
    trgm_rows = _lookup_trgm(cur, clean)
    if not trgm_rows:
        return _make_unresolved(f"No similar medicine found for {clean!r}")

    candidates: List[Dict[str, Any]] = []
    for r in trgm_rows:
        row = dict(r)
        sim = float(row.pop("sim_score", 0.0))
        candidates.append({**row, "_sim": sim})

    top = candidates[0]
    top_sim = top["_sim"]

    if top_sim < _TRGM_MIN_SIMILARITY:
        return _make_unresolved(f"Best similarity {top_sim:.2f} is below threshold for {clean!r}")

    # If strength was provided, boost/filter candidates matching that strength
    if strength_raw:
        matching_strength_cands = [c for c in candidates if _strengths_match(strength_raw, c.get("strength"))]
        if matching_strength_cands:
            best_sim = matching_strength_cands[0]["_sim"]
            if best_sim >= _TRGM_MEDIUM_CONFIDENCE:
                res = _resolve_candidate_rows(
                    matching_strength_cands,
                    raw_name,
                    clean,
                    strength_raw,
                    extracted_form,
                    base_confidence=best_sim,
                    method_prefix="trgm_strength_match",
                )
                if res.get("status") in ("MATCHED", "AMBIGUOUS"):
                    return res
        else:
            return _make_unresolved(f"No similar medicine matching strength {strength_raw!r} found for {clean!r}")

    # Single result or clear winner by gap
    if len(candidates) == 1 or (
        len(candidates) > 1
        and (top["_sim"] - candidates[1]["_sim"]) >= _TRGM_AMBIGUITY_GAP
    ):
        if top_sim >= _TRGM_MEDIUM_CONFIDENCE:
            method = "trgm_high" if top_sim >= _TRGM_HIGH_CONFIDENCE else "trgm_medium"
            return _resolve_candidate_rows(
                [top],
                raw_name,
                clean,
                strength_raw,
                extracted_form,
                base_confidence=top_sim,
                method_prefix=method,
            )

    # Multiple close candidates
    return _resolve_candidate_rows(
        candidates[:_MAX_AMBIGUOUS_CANDIDATES],
        raw_name,
        clean,
        strength_raw,
        extracted_form,
        base_confidence=top_sim,
        method_prefix="trgm",
    )


# =============================================================================
# Batch helper — resolve a full medications list from the OCR output
# =============================================================================

def resolve_prescription_medications(
    medications: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Resolve each medication in an extracted medications list.

    Attaches a ``match`` key to each medication dict (does NOT mutate in-place;
    returns new dicts). Designed to be called from upload.py or prescription.py.

    Parameters
    ----------
    medications : list of dict
        Each dict must have at least ``raw_name``.  Optional ``dosage``,
        ``form`` are used as signals.

    Returns
    -------
    list of dict
        Same order as input; each item has a ``match`` key containing the
        resolution result.
    """
    results = []
    for med in medications:
        raw_name = med.get("raw_name") or med.get("name") or ""
        dosage = med.get("dosage")
        form = med.get("form")

        match = resolve_medicine(raw_name, extracted_dosage=dosage, extracted_form=form)
        results.append({**med, "match": match})

    return results
