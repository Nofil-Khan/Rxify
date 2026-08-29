"""Wrapper for calling Google Gemini Vision (via google-genai).

Exposes `extract_prescription_data(image_bytes)` which calls Gemini's
vision model and returns structured prescription data as a dict.

Install:
    pip install google-genai

Set one of:
    GOOGLE_API_KEY / GEMINI_API_KEY
"""

from __future__ import annotations

import os
import json
import re
from typing import Any, Dict

API_ENV_VARS = ("GEMINI_API_KEY", "GOOGLE_API_KEY")
DEFAULT_MODEL = "gemini-3-flash-preview"

EXTRACTION_PROMPT = """
You are a medical prescription OCR system. Extract all data from this prescription image.
AND DO IT FAST

Return ONLY a valid JSON object (no markdown, no explanation) with these fields:
{
  "doctor_name": "string or null",
  "clinic_name": "string or null",
  "patient_name": "string or null",
  "patient_age": "string or null",
  "patient_gender": "string or null",
  "issue_date": "string or null",
  "follow_up_date": "string or null",
  "diagnosis": "string or null",
  "medications": [
    {
      "name": "string",
      "dosage": "string or null",
      "frequency": "string or null(give it in normal english)",
      "duration": "string or null (e.g. '5 days', '1 month' - try to infer from quantity/dosage if not explicit)",
      "instructions": "string or null"
    }
  ],
  "notes": "string or null",
  "raw_text": "full raw text extracted from image"
}

If a field is not present in the image, set it to null.
"""


def _get_api_key() -> str:
    for name in API_ENV_VARS:
        val = os.getenv(name)
        if val:
            return val
    raise EnvironmentError(f"No API key found. Set one of: {', '.join(API_ENV_VARS)}")


def _parse_json_from_response(text: str) -> Dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def extract_prescription_data(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    model: str | None = None,
) -> Dict[str, Any]:
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ImportError("Run: pip install google-genai")

    api_key = _get_api_key()
    client = genai.Client(api_key=api_key)
    model_name = model or DEFAULT_MODEL

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[image_part, EXTRACTION_PROMPT],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=65536,  # increased to handle very large responses
                response_mime_type="application/json",
            ),
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini API call failed: {exc}") from exc

    raw_text = response.text

    try:
        return _parse_json_from_response(raw_text)
    except json.JSONDecodeError as exc:
        # Attempt to recover a partial JSON object
        salvaged = _salvage_partial_json(raw_text)
        if salvaged:
            salvaged["parse_warning"] = "Response was truncated; some fields may be missing"
            return salvaged

        return {
            "parse_error": str(exc),
            "raw_text": raw_text,
            "doctor_name": None,
            "patient_name": None,
            "medications": [],
        }


def _salvage_partial_json(text: str) -> Dict[str, Any] | None:
    """Best-effort recovery from a truncated JSON response.

    Extracts whatever complete key-value pairs are present before the
    truncation point by progressively closing the broken JSON.
    """
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # Try closing the object with progressively fewer chars trimmed
    # (handles mid-string or mid-array truncation)
    for trim in range(len(text), 0, -1):
        candidate = text[:trim]
        # Close any open string, then close array+object
        for suffix in ['"}}\n', '"}\n', ']\n}', '\n}', '}']:
            try:
                return json.loads(candidate + suffix)
            except json.JSONDecodeError:
                continue

    return None
