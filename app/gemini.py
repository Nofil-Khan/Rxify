"""Wrapper for calling Google Gemini Vision (via google-genai).

Exposes `extract_prescription_data(image_bytes, ...)` which calls Gemini's
vision model and returns structured, validated, and normalised prescription
data as a plain dict (same shape as before – backward-compatible).

Architecture
------------
1. Gemini Vision  ->  raw JSON (enforced via response_schema)
2. Pydantic       ->  strict validation + type coercion
3. Normaliser     ->  clean whitespace, expand form abbreviations, unify
                      dosage units, split raw_name from form prefix
4. Result dict    ->  forwarded to caller unchanged

Medicine matching happens in a separate service.
The AI NEVER guesses RxNorm / RxCUI / generic names.

Install:
    pip install google-genai pydantic

Set one of:
    GOOGLE_API_KEY / GEMINI_API_KEY
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)

API_ENV_VARS = ("GEMINI_API_KEY", "GOOGLE_API_KEY")
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
FALLBACK_MODELS = [
    DEFAULT_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
]

# Retry settings (only for transient API errors, not validation failures)
_MAX_RETRIES = 2
_RETRY_DELAY_S = 1.5

# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

# Dosage-form abbreviation -> canonical display name
_FORM_ALIASES: Dict[str, str] = {
    "tab": "tablet",
    "tablet": "tablet",
    "cap": "capsule",
    "capsule": "capsule",
    "caps": "capsule",
    "inj": "injection",
    "injection": "injection",
    "syr": "syrup",
    "syrup": "syrup",
    "susp": "suspension",
    "suspension": "suspension",
    "oint": "ointment",
    "ointment": "ointment",
    "cre": "cream",
    "cream": "cream",
    "gel": "gel",
    "drp": "drops",
    "drops": "drops",
    "inh": "inhaler",
    "inhaler": "inhaler",
    "patch": "patch",
    "sachet": "sachet",
    "loz": "lozenge",
    "lozenge": "lozenge",
    "supp": "suppository",
    "suppository": "suppository",
    "sol": "solution",
    "solution": "solution",
    "pwd": "powder",
    "powder": "powder",
}

# Dosage unit aliases -> canonical unit
_UNIT_ALIASES: Dict[str, str] = {
    "mcg": "mcg",
    "\u00b5g": "mcg",
    "ug": "mcg",
    "microgram": "mcg",
    "micrograms": "mcg",
    "mg": "mg",
    "milligram": "mg",
    "milligrams": "mg",
    "g": "g",
    "gram": "g",
    "grams": "g",
    "ml": "mL",
    "ml.": "mL",
    "milliliter": "mL",
    "millilitre": "mL",
    "iu": "IU",
    "i.u.": "IU",
    "meq": "mEq",
    "mmol": "mmol",
    "unit": "units",
    "units": "units",
    "u": "units",
}

# Regex: capture leading form prefix from a raw_name string
# e.g. "Tab Paracetamol" -> ("Tab", "Paracetamol")
_FORM_PREFIX_RE = re.compile(
    r"^(tab(?:let)?s?|cap(?:sule)?s?|caps?|inj(?:ection)?|syr(?:up)?|"
    r"susp(?:ension)?|oint(?:ment)?|cre(?:am)?|gel|drp|drops?|inh(?:aler)?|"
    r"patch|sachet|loz(?:enge)?|supp(?:ository)?|sol(?:ution)?|pwd|powder)"
    r"[\s./\-]+(.+)",
    re.IGNORECASE,
)

# Normalise dosage: "500mg" -> "500 mg", "400 Mcg" -> "400 mcg"
_DOSAGE_TOKEN_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*"
    r"(mcg|\u00b5g|ug|micrograms?|mg|milligrams?|g(?:ram)?s?|ml\.?|"
    r"millilitres?|milliliters?|IU|i\.u\.|mEq|mmol|units?|u)",
    re.IGNORECASE,
)


def _normalise_whitespace(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return re.sub(r"\s+", " ", value).strip() or None


def _normalise_form(raw: Optional[str]) -> Optional[str]:
    """Return canonical form name or the original string."""
    if raw is None:
        return None
    key = raw.strip().lower()
    return _FORM_ALIASES.get(key, raw.strip())


def _normalise_dosage(raw: Optional[str]) -> Optional[str]:
    """Ensure a space between number and unit; canonicalise unit case."""
    if raw is None:
        return None

    def _replace(m: re.Match) -> str:
        number = m.group(1).replace(",", ".")
        unit_raw = m.group(2).lower().rstrip(".")
        unit = _UNIT_ALIASES.get(unit_raw, unit_raw)
        return f"{number} {unit}"

    normalised = _DOSAGE_TOKEN_RE.sub(_replace, raw.strip())
    return _normalise_whitespace(normalised)


def _split_form_from_name(
    raw_name: str,
) -> tuple:
    """
    If raw_name begins with a form prefix (e.g. "Tab Paracetamol"),
    return (clean_name, form_string).  Otherwise return (raw_name, None).

    raw_name is always preserved unchanged in the output model.
    """
    m = _FORM_PREFIX_RE.match(raw_name.strip())
    if m:
        prefix = m.group(1)
        name_part = m.group(2).strip()
        form = _normalise_form(prefix)
        return name_part, form
    return raw_name.strip(), None


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

ConfidenceLevel = Literal["high", "medium", "low"]


class MedicationItem(BaseModel):
    """A single medication entry extracted from the prescription."""

    raw_name: str = Field(..., description="Medicine name exactly as read from the image.")
    dosage: Optional[str] = Field(None, description="Dose/strength as written (e.g. 500 mg, 625 mg, 0.5%).")
    frequency: Optional[str] = Field(None, description="How often, converted to plain English (e.g. twice daily).")
    frequency_raw: Optional[str] = Field(None, description="Literal shorthand written (e.g. 1-0-1, BD, TDS, SOS).")
    duration: Optional[str] = Field(None, description="Duration of therapy (e.g. 5 days, 2 weeks, ongoing).")
    quantity: Optional[str] = Field(None, description="Total dispense quantity if written (e.g. #10 tabs, 1 bottle).")
    instructions: Optional[str] = Field(None, description="Timing/food administration instructions (e.g. after food).")
    form: Optional[str] = Field(None, description="Dosage form (tablet, capsule, syrup, ointment, etc.).")
    route: Optional[str] = Field(None, description="Route of administration (oral, topical, inhalation, etc.).")
    extraction_confidence: ConfidenceLevel = Field(
        "medium",
        description="Readability confidence: high | medium | low.",
    )

    # Derived at normalisation time (not from AI)
    normalised_name: Optional[str] = Field(
        None,
        description="Name after stripping leading form prefix; null if no prefix detected.",
    )

    @field_validator("raw_name")
    @classmethod
    def raw_name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("raw_name must not be empty")
        return v

    @field_validator(
        "dosage", "frequency", "frequency_raw", "duration", "quantity",
        "instructions", "form", "route",
        mode="before",
    )
    @classmethod
    def coerce_empty_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    def normalise_in_place(self) -> None:
        """Apply normalisation rules to mutable fields after validation."""
        self.dosage = _normalise_dosage(self.dosage)
        self.frequency = _normalise_whitespace(self.frequency)
        self.frequency_raw = _normalise_whitespace(self.frequency_raw)
        self.duration = _normalise_whitespace(self.duration)
        self.quantity = _normalise_whitespace(self.quantity)
        self.instructions = _normalise_whitespace(self.instructions)
        self.form = _normalise_form(self.form)
        self.route = _normalise_whitespace(self.route)

        # If no explicit form was provided, attempt to detect it from raw_name
        if self.form is None:
            clean, detected_form = _split_form_from_name(self.raw_name)
            if detected_form:
                self.form = detected_form
                self.normalised_name = clean
            else:
                self.normalised_name = None
        else:
            # Still strip a redundant prefix if present
            clean, _ = _split_form_from_name(self.raw_name)
            self.normalised_name = clean if clean != self.raw_name.strip() else None


class PrescriptionData(BaseModel):
    """Top-level prescription extracted from the image."""

    doctor_name: Optional[str] = None
    doctor_degree: Optional[str] = None
    doctor_reg_number: Optional[str] = None
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[str] = None
    patient_gender: Optional[str] = None
    patient_weight: Optional[str] = None
    vitals: Optional[str] = None
    chief_complaints: Optional[str] = None
    issue_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    diagnosis: Optional[str] = None
    investigations_advised: Optional[List[str]] = Field(default_factory=list)
    dietary_lifestyle_advice: Optional[str] = None
    medications: List[MedicationItem] = Field(default_factory=list)
    notes: Optional[str] = None
    raw_text: Optional[str] = None

    @field_validator(
        "doctor_name", "doctor_degree", "doctor_reg_number", "clinic_name", "clinic_address",
        "patient_name", "patient_age", "patient_gender", "patient_weight",
        "vitals", "chief_complaints", "issue_date", "follow_up_date", "diagnosis",
        "dietary_lifestyle_advice", "notes", "raw_text",
        mode="before",
    )
    @classmethod
    def coerce_empty_strings(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @model_validator(mode="after")
    def normalise_all_medications(self) -> "PrescriptionData":
        for med in self.medications:
            med.normalise_in_place()
        return self


# ---------------------------------------------------------------------------
# Gemini response_schema (JSON Schema dict for SDK)
# ---------------------------------------------------------------------------

_GEMINI_RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "doctor_name":              {"type": "string", "nullable": True},
        "doctor_degree":            {"type": "string", "nullable": True},
        "doctor_reg_number":        {"type": "string", "nullable": True},
        "clinic_name":              {"type": "string", "nullable": True},
        "clinic_address":           {"type": "string", "nullable": True},
        "patient_name":             {"type": "string", "nullable": True},
        "patient_age":              {"type": "string", "nullable": True},
        "patient_gender":           {"type": "string", "nullable": True},
        "patient_weight":           {"type": "string", "nullable": True},
        "vitals":                   {"type": "string", "nullable": True},
        "chief_complaints":         {"type": "string", "nullable": True},
        "issue_date":               {"type": "string", "nullable": True},
        "follow_up_date":           {"type": "string", "nullable": True},
        "diagnosis":                {"type": "string", "nullable": True},
        "investigations_advised":   {
            "type": "array",
            "items": {"type": "string"},
        },
        "dietary_lifestyle_advice": {"type": "string", "nullable": True},
        "notes":                    {"type": "string", "nullable": True},
        "raw_text":                 {"type": "string", "nullable": True},
        "medications": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "raw_name":              {"type": "string"},
                    "dosage":                {"type": "string", "nullable": True},
                    "frequency":             {"type": "string", "nullable": True},
                    "frequency_raw":         {"type": "string", "nullable": True},
                    "duration":              {"type": "string", "nullable": True},
                    "quantity":              {"type": "string", "nullable": True},
                    "instructions":          {"type": "string", "nullable": True},
                    "form":                  {"type": "string", "nullable": True},
                    "route":                 {"type": "string", "nullable": True},
                    "extraction_confidence": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                    },
                },
                "required": ["raw_name", "extraction_confidence"],
            },
        },
    },
    "required": ["medications", "raw_text"],
}

# ---------------------------------------------------------------------------
# Extraction prompt
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """\
You are an expert clinical pharmacist and senior medical transcription specialist.
Your task is to transcribe and extract ALL medical information from this prescription image with extreme clinical fidelity.

STEP 1: CLINICAL CONTEXT & VERBATIM TRANSCRIPTION
First, identify the clinical environment from the letterhead/header to guide your handwriting interpretation:
- Clinic Specialty (e.g. Chest & TB / Pulmonology, Cardiology, Gastroenterology, Orthopedics, ENT, Pediatrics, Gynecology, General Medicine).
- Doctor credentials and registration number (e.g. MD Pulmonary Medicine, MBBS, DGO).
- Clinical Vitals & Notes (BP, Pulse, SpO2, Weight, chief complaints, provisional diagnosis).
Transcribe every legible line verbatim into the `raw_text` field.

STEP 2: CLINICAL STRUCTURED EXTRACTION & CO-OCCURRENCE REASONING
Use medical knowledge and clinical context to decipher difficult cursive doctor handwriting:
- In a CHEST & TB / PULMONOLOGY clinic (with Sputum, Asthma, Cough, SpO2):
  Expect bronchodilators (Doxolin / Doxofylline, Deriphyllin, Asthalin), inhaled corticosteroids/LABA (Budecort, Budetrol, Foracort, Duolin), leukotriene antagonists (Montek-LC, Montair-LC, Montas-L), mucolytics (Pulmoclear / Acebrophylline, Mucinac), and gastro-protective PPIs (Razo-D, Pan-D).
- In a GASTROENTEROLOGY clinic:
  Expect PPIs with prokinetics (Pan-D, Razo-D, Omez-D), antacids (Sucrafil-O), antispasmodics, antiemetics (Emeset).
- In an ORTHOPEDIC / PAIN clinic:
  Expect NSAIDs (Zerodol-P, Zerodol-SP, Hifenac), enzymes (Chymoral Forte), muscle relaxants (Thiocolchicoside), Calcium (Shelcal).

--- CRITICAL RULES FOR HANDWRITING & PHARMACOLOGICAL SHORTHAND ---

1. ZERO-DROP MANDATE (DO NOT SKIP ANY MEDICATIONS):
   Every numbered item, bullet point, or row under "Rx" or "Treatment" represents a medication.
   Even if the handwriting is messy, cursive, or abbreviated:
   - Extract the best visible reading into `raw_name`.
   - Set `extraction_confidence` to "low" or "medium".
   - NEVER drop or omit a medication line from the `medications` array!

2. STRENGTH VS INTAKE AMOUNT (CRITICAL):
   - `dosage`: Put the manufactured chemical product strength here if specified (e.g. "400 mg", "100 mg", "20/30 mg", "625 mg").
     If the prescription has a trailing number after the brand (e.g. "Doxolin 400" -> 400 mg; "Indocap 100" -> 100 mg; "Pan 40" -> 40 mg), record that strength in `dosage`.
   - `instructions`: Put the intake quantity/directions here (e.g. "take 1/2 tablet", "10 mL", "2 puffs", "after meals").
     DO NOT put intake instructions like "1/2" or "10 mL" into the `dosage` field!

3. COMMON INDIAN FIXED-DOSE COMBINATION (FDC) BRAND PATTERNS:
   Indian doctors frequently prescribe combination brands with standard suffixes:
   - Suffix "-D" or "-DSR": Drug + Domperidone (e.g. Radyle-D, Razo-D, Pan-D, Rablet-D).
   - Suffix "-LC" or "-L": Drug + Levocetirizine (e.g. Montek-LC, Montair-LC, Montas-L).
   - Suffix "-AM": Drug + Amlodipine (e.g. Telma-AM, Amlong-A).
   - Suffix "-H": Drug + Hydrochlorothiazide (e.g. Telma-H).
   - Suffix "-SP": NSAID + Paracetamol + Serratiopeptidase (e.g. Zerodol-SP, Hifenac-SP).
   - Suffix "-CV": Drug + Clavulanic acid (e.g. Moxikind-CV, Augmentin).

4. MEDICAL FREQUENCY DECODING:
   - "OD" / "1-0-0" / "0-1-0" -> "once daily" (specify morning/afternoon/night if indicated)
   - "BD" / "1-0-1" / "1-1-0" / "0-1-1" -> "twice daily"
   - "TDS" / "1-1-1" -> "three times daily"
   - "QID" / "1-1-1-1" -> "four times daily"
   - "HS" / "0-0-1" -> "once daily at bedtime / night"
   - "SOS" / "PRN" -> "as needed / when required"
   - "STAT" -> "immediately (single dose)"
   Also record the literal shorthand in `frequency_raw` (e.g. "1-0-1", "BD", "1/2 BD M").

5. FOOD & TIMING:
   - "AC" / "BBF" -> "before food / empty stomach"
   - "PC" / "AF" -> "after food / after meals"

6. DURATION:
   - "x 5d" / "5 days" / "5/7" -> "5 days"
   - "x 1w" / "1 week" / "1/52" -> "7 days"
   - "x 1m" / "1 month" / "1/12" -> "30 days"

7. PRESERVE ORIGINAL BRAND SPELLING:
   Do NOT convert brand names to generic names. Preserve the brand name (e.g. "Doxolin 400", "Budecort", "Radyle D", "Augmentin") as written on the prescription.
"""

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_api_key() -> str:
    for name in API_ENV_VARS:
        val = os.getenv(name)
        if val:
            return val
    raise EnvironmentError(f"No API key found. Set one of: {', '.join(API_ENV_VARS)}")


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _parse_and_validate(raw_text: str) -> PrescriptionData:
    """Parse the Gemini JSON response and validate it through Pydantic."""
    cleaned = _strip_markdown_fences(raw_text)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON decode failed: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object, got {type(data).__name__}")

    return PrescriptionData.model_validate(data)


def _is_transient_error(exc: Exception) -> bool:
    """Return True for errors worth retrying (rate-limit, timeout, 5xx)."""
    msg = str(exc).lower()
    transient_keywords = ("429", "503", "timeout", "resource exhausted", "unavailable", "deadline")
    return any(kw in msg for kw in transient_keywords)


def _error_response(message: str, raw_text: str = "") -> Dict[str, Any]:
    """Return a safe, schema-compatible error dict."""
    return {
        "error": message,
        "doctor_name": None,
        "clinic_name": None,
        "patient_name": None,
        "patient_age": None,
        "patient_gender": None,
        "issue_date": None,
        "follow_up_date": None,
        "diagnosis": None,
        "medications": [],
        "notes": None,
        "raw_text": raw_text or None,
    }


# ---------------------------------------------------------------------------
# Public API  (backward-compatible)
# ---------------------------------------------------------------------------


def extract_prescription_data(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    model: str | None = None,
) -> Dict[str, Any]:
    """Extract structured prescription data from an image using Gemini Vision.

    Parameters
    ----------
    image_bytes : bytes
        Raw bytes of the prescription image.
    mime_type : str
        MIME type of the image (default ``"image/jpeg"``).
    model : str | None
        Override the Gemini model name.  Defaults to ``DEFAULT_MODEL``.

    Returns
    -------
    dict
        Validated, normalised prescription data.  On failure the dict contains
        an ``"error"`` key describing what went wrong, plus safe null defaults.

    Notes
    -----
    * Medicine matching (RxNorm, pg_trgm, brand aliases) must be done in a
      separate service; this function never guesses medicine identities.
    * Retries are only attempted for transient API errors (rate-limit / 5xx).
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ImportError("Run: pip install google-genai pydantic")

    api_key = _get_api_key()
    client = genai.Client(api_key=api_key)

    candidate_models = []
    if model:
        candidate_models.append(model)
    for m in FALLBACK_MODELS:
        if m not in candidate_models:
            candidate_models.append(m)

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    # Build generation config with optional schema enforcement.
    gen_config_kwargs: Dict[str, Any] = dict(
        temperature=0.1,
        max_output_tokens=65536,
        response_mime_type="application/json",
        response_schema=_GEMINI_RESPONSE_SCHEMA,
    )

    response = None
    last_exc = None

    # ── Try candidate models in priority order ─────────────────────────────
    for model_name in candidate_models:
        for attempt in range(1, _MAX_RETRIES + 2):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[image_part, EXTRACTION_PROMPT],
                    config=types.GenerateContentConfig(**gen_config_kwargs),
                )
                break  # success with this model
            except Exception as exc:
                last_exc = exc
                if _is_transient_error(exc) and attempt <= _MAX_RETRIES:
                    wait = _RETRY_DELAY_S * attempt
                    logger.warning(
                        "Gemini API transient error on model %s (attempt %d/%d): %s — retrying in %.1fs",
                        model_name, attempt, _MAX_RETRIES + 1, exc, wait,
                    )
                    time.sleep(wait)
                    continue
                logger.warning("Gemini model %s call failed: %s", model_name, exc)
                break  # try next model in fallback list

        if response is not None:
            break

    if response is None:
        logger.error("All Gemini candidate models failed. Last error: %s", last_exc)
        return _error_response(f"Gemini extraction failed across models: {last_exc}")

    raw_response_text: str = getattr(response, "text", "") or ""

    # ── Pydantic validation + normalisation ─────────────────────────────────
    try:
        prescription = _parse_and_validate(raw_response_text)
    except Exception as exc:
        logger.error("Prescription validation failed: %s", exc)
        logger.debug("Raw Gemini response: %s", raw_response_text)
        return _error_response(
            f"Validation failed: {exc}",
            raw_text=raw_response_text,
        )

    # ── Serialise to plain dict (backward-compatible shape) ─────────────────
    return prescription.model_dump(mode="python")
