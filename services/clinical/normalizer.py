"""Clinical text normalization, form stripping, and strength extraction."""

from __future__ import annotations
import re
from typing import Optional, Set


class ClinicalNormalizer:
    """Encapsulates clinical text parsing, strength extraction, and medical string cleaning."""

    FORM_PREFIXES: Set[str] = frozenset({
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

    NON_MEDICINE_PATTERNS = [
        re.compile(r"\b(naan|paratha|roti|paneer|chicken|mutton|biryani|pizza|burger|fries)\b", re.IGNORECASE),
        re.compile(r"\b(milk|tea|coffee|juice|water|food)\b", re.IGNORECASE),
    ]

    STRENGTH_RE = re.compile(
        r"(\d+(?:[.,]\d+)?)\s*(mcg|ug|mg|g|ml|iu|meq|mmol|units?|%)",
        re.IGNORECASE,
    )

    @classmethod
    def is_obviously_not_medicine(cls, text: str) -> bool:
        """Check if string matches obvious non-medicine patterns (e.g. food items)."""
        if not text or len(text.strip()) < 2:
            return True
        for pattern in cls.NON_MEDICINE_PATTERNS:
            if pattern.search(text):
                return True
        return False

    @classmethod
    def strip_form_prefix(cls, name: str) -> str:
        """Strip leading form indicators like 'Tab', 'Cap', 'Inj'."""
        parts = name.strip().split()
        if len(parts) > 1 and parts[0].lower() in cls.FORM_PREFIXES:
            return " ".join(parts[1:])
        return name

    @classmethod
    def extract_strength(cls, text: str) -> Optional[str]:
        """Extract strength tokens like '500mg', '50/500 mg'."""
        if not text:
            return None
        matches = list(cls.STRENGTH_RE.finditer(text))
        if not matches:
            return None
        return " ".join(m.group(0).replace(" ", "") for m in matches)

    @classmethod
    def clean_name(cls, raw: str) -> str:
        """Clean raw prescription medicine text into a standard lookup string."""
        if not raw:
            return ""
        # 1. Strip form prefixes
        cleaned = cls.strip_form_prefix(raw)
        # 2. Normalize separators like + or &
        cleaned = re.sub(r"\s*[+&]\s*", " / ", cleaned)
        # 3. Strip trailing dosage/strength from the name
        cleaned = cls.STRENGTH_RE.sub("", cleaned)
        # 4. Remove special noise chars
        cleaned = re.sub(r"[^\w\s\-\/]", " ", cleaned)
        return " ".join(cleaned.split()).strip()

    @classmethod
    def strengths_match(cls, input_strength: Optional[str], db_strength: Optional[str]) -> bool:
        """Evaluate if two strength specifications represent the same dosage."""
        if not input_strength or not db_strength:
            return True  # If not specified, do not disqualify
        s1 = "".join(input_strength.lower().split())
        s2 = "".join(db_strength.lower().split())
        return s1 == s2

