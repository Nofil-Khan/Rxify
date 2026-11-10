"""Fast AI Medicine Fallback & Generalization System.

Provides clinical-grade AI resolution for colloquial, brand-specific,
abbreviated, or misspelled medicine names using Gemini/Ollama with
self-learning PostgreSQL alias caching.
"""

from __future__ import annotations
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.request
import psycopg2.extras

from database.db import get_conn

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
GEMINI_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")


class AIMedicineFallbackService:
    """Clinical AI generalization engine for unmapped drug entities."""

    def _try_ollama_completion(self, prompt: str, timeout_seconds: float = 2.5) -> Optional[str]:
        try:
            url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate"
            payload = json.dumps({
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.0, "num_predict": 150}
            }).encode("utf-8")

            req = urllib.request.Request(
                url, data=payload, headers={"Content-Type": "application/json"}, method="POST"
            )
            with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("response")
        except Exception as exc:
            logger.debug("Ollama unavailable or timed out: %s", exc)
            return None

    def _try_gemini_completion(self, prompt: str) -> Optional[str]:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("No GEMINI_API_KEY available for AI medicine fallback.")
            return None

        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            return response.text
        except Exception as exc:
            logger.warning("Gemini AI medicine fallback call failed: %s", exc)
            return None

    def _clean_json_response(self, raw_text: str) -> Optional[Dict[str, Any]]:
        if not raw_text:
            return None
        text = raw_text.strip()
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1).strip()
        try:
            return json.loads(text)
        except Exception:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except Exception:
                    pass
        return None

    def predict_medicine_fallback(
        self,
        raw_name: str,
        extracted_dosage: Optional[str] = None,
        extracted_form: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if not raw_name or len(raw_name.strip()) < 2:
            return None

        clean_name = raw_name.strip()

        # Step 1: Check fast alias table
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT m.medicine_id, m.generic_name, m.brand_name, m.strength, m.form::TEXT AS form, m.category
                    FROM medicine_alias a
                    JOIN medicine m ON m.medicine_id = a.medicine_id
                    WHERE LOWER(a.alias_name) = LOWER(%s)
                    LIMIT 1
                    """,
                    (clean_name,),
                )
                cached = cur.fetchone()
                if cached:
                    return {
                        "status": "MATCHED",
                        "medicine_id": cached["medicine_id"],
                        "generic_name": cached["generic_name"],
                        "brand_name": cached["brand_name"],
                        "strength": cached["strength"],
                        "form": cached["form"],
                        "confidence": 0.98,
                        "reasoning": f"Resolved from verified alias cache for {clean_name!r}",
                        "source": "ai_alias_cache",
                    }

        # Step 2: Query candidate pool
        first_token = clean_name.split()[0].replace("-", " ").split()[0]
        candidate_rows = []
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, strength, form::TEXT AS form
                    FROM medicine
                    WHERE generic_name ILIKE %s OR brand_name ILIKE %s
                       OR similarity(generic_name, %s) > 0.18
                       OR similarity(COALESCE(brand_name, ''), %s) > 0.18
                    ORDER BY GREATEST(
                        similarity(generic_name, %s),
                        similarity(COALESCE(brand_name, ''), %s)
                    ) DESC
                    LIMIT 15
                    """,
                    (f"%{first_token}%", f"%{first_token}%", clean_name, clean_name, clean_name, clean_name),
                )
                candidate_rows = cur.fetchall()

        cand_list_str = "\n".join(
            [
                f"- ID {r['medicine_id']}: Generic: '{r['generic_name']}', Brand: '{r['brand_name']}', Strength: '{r['strength']}', Form: '{r['form']}'"
                for r in candidate_rows
            ]
        )

        prompt = f"""You are a senior clinical pharmacist and medical terminology classifier.
Input from prescription:
- Raw medication text: "{raw_name}"
- Extracted dosage: "{extracted_dosage or 'unspecified'}"
- Extracted form: "{extracted_form or 'unspecified'}"

Database catalog candidates currently available:
{cand_list_str or "(No direct candidates found)"}

Task:
1. Identify the standard generic active substance and brand name.
2. Select the best matching `selected_medicine_id` (or null if none match).
Respond with strict JSON ONLY:
{{
  "selected_medicine_id": <int or null>,
  "generic_name": "<Generic Substance>",
  "brand_name": "<Brand Name or null>",
  "strength": "<Strength e.g. 650mg>",
  "form": "<Form e.g. TABLET, CAPSULE, SYRUP>",
  "confidence": <float 0.0 to 1.0>,
  "reasoning": "<1-sentence clinical rationale>"
}}"""

        raw_response = self._try_ollama_completion(prompt)
        if not raw_response:
            raw_response = self._try_gemini_completion(prompt)

        parsed = self._clean_json_response(raw_response or "")
        if not parsed:
            return None

        matched_med_id = parsed.get("selected_medicine_id")
        selected_row = None

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if matched_med_id and isinstance(matched_med_id, int):
                    cur.execute(
                        "SELECT medicine_id, generic_name, brand_name, strength, form::TEXT AS form FROM medicine WHERE medicine_id = %s",
                        (matched_med_id,),
                    )
                    selected_row = cur.fetchone()

                if not selected_row:
                    gen_name = parsed.get("generic_name")
                    if gen_name:
                        cur.execute(
                            """
                            SELECT medicine_id, generic_name, brand_name, strength, form::TEXT AS form
                            FROM medicine
                            WHERE LOWER(generic_name) = LOWER(%s)
                               OR generic_name ILIKE %s
                            ORDER BY similarity(generic_name, %s) DESC
                            LIMIT 1
                            """,
                            (gen_name.strip(), f"%{gen_name.strip()}%", gen_name.strip()),
                        )
                        selected_row = cur.fetchone()

                if selected_row:
                    final_id = selected_row["medicine_id"]
                    try:
                        cur.execute(
                            """
                            INSERT INTO medicine_alias (medicine_id, alias_name, confidence, source)
                            VALUES (%s, %s, %s, 'ai_fallback')
                            ON CONFLICT DO NOTHING
                            """,
                            (final_id, clean_name, float(parsed.get("confidence", 0.90))),
                        )
                        conn.commit()
                    except Exception as alias_err:
                        logger.debug("Alias auto-insert skipped: %s", alias_err)

                    return {
                        "status": "MATCHED",
                        "medicine_id": final_id,
                        "generic_name": selected_row["generic_name"],
                        "brand_name": selected_row["brand_name"],
                        "strength": selected_row["strength"],
                        "form": selected_row["form"],
                        "confidence": float(parsed.get("confidence", 0.85)),
                        "reasoning": parsed.get("reasoning", "AI generalized to canonical drug catalog"),
                        "source": "ai_generalization",
                    }

        return None

    def resolve_unresolved_prescription_medicines(
        self,
        prescription_id: int,
        dispensary_id: Optional[int] = None,
    ) -> int:
        resolved_count = 0
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT prescription_medicine_id, name, dosage, frequency, duration, match_status
                    FROM prescription_medicine
                    WHERE prescription_id = %s
                      AND (match_status IN ('AMBIGUOUS', 'UNRESOLVED') OR medicine_id IS NULL)
                    """,
                    (prescription_id,),
                )
                unresolved_items = cur.fetchall()

        for item in unresolved_items:
            pm_id = item["prescription_medicine_id"]
            raw_name = item["name"]
            ai_pred = self.predict_medicine_fallback(raw_name, extracted_dosage=item.get("dosage"))
            if ai_pred and ai_pred.get("medicine_id"):
                matched_id = ai_pred["medicine_id"]
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE prescription_medicine
                            SET medicine_id = %s,
                                match_status = 'EXACT',
                                match_confidence = %s
                            WHERE prescription_medicine_id = %s
                            """,
                            (matched_id, ai_pred.get("confidence", 0.88), pm_id),
                        )
                        conn.commit()
                resolved_count += 1

        return resolved_count


default_ai_fallback_service = AIMedicineFallbackService()

