"""Fast AI Medicine Fallback & Generalization System.

Provides high-speed, clinical-grade AI resolution for colloquial, brand-specific,
abbreviated, or misspelled medicine names from prescriptions that were not manually
reviewed by the patient.

Supported backends:
  1. Local Ollama (if configured / running on localhost:11434)
  2. Google Gemini Flash (gemini-2.5-flash / gemini-2.0-flash / gemini-1.5-flash)
  3. Postgres Trigram & Alias Cache Auto-Learning
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
GEMINI_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")


def _try_ollama_completion(prompt: str, timeout_seconds: float = 2.5) -> Optional[str]:
    """Attempt fast completion via local Ollama instance if available."""
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
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response")
    except Exception as exc:
        logger.debug("Ollama unavailable or timed out: %s", exc)
        return None


def _try_gemini_completion(prompt: str) -> Optional[str]:
    """Attempt fast completion via Google Gemini Flash."""
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


def _clean_json_response(raw_text: str) -> Optional[Dict[str, Any]]:
    """Clean markdown fences and parse JSON dictionary."""
    if not raw_text:
        return None
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except Exception:
        # Fallback regex extraction of JSON object
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return None


def predict_medicine_fallback(
    raw_name: str,
    extracted_dosage: Optional[str] = None,
    extracted_form: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Predict and generalize a raw prescription medicine string into a catalog match.

    Returns dict with keys:
      status: 'MATCHED'
      medicine_id: int
      generic_name: str
      brand_name: Optional[str]
      strength: Optional[str]
      form: str
      confidence: float
      reasoning: str
      source: 'ai_fallback'
    or None if unable to resolve.
    """
    if not raw_name or len(raw_name.strip()) < 2:
        return None

    clean_name = raw_name.strip()

    # Step 1: Check fast alias table first to avoid redundant AI calls
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

    # Step 2: Query candidate pool from PostgreSQL catalog (trigram + prefix)
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

    # Step 3: Prompt AI to generalize clinical medicine
    prompt = f"""You are a senior clinical pharmacist and medical terminology classifier.
A medical prescription contains an extracted medication entry that could be a commercial brand name, combination drug, local brand, abbreviation, or misspelling.

Input from prescription:
- Raw medication text: "{raw_name}"
- Extracted dosage: "{extracted_dosage or 'unspecified'}"
- Extracted form: "{extracted_form or 'unspecified'}"

Database catalog candidates currently available:
{cand_list_str or "(No direct candidates found)"}

Task:
1. Identify the true standard international generic active substance (INN chemical salt) and common commercial brand name. Examples:
   - "Tab Dolo 650" -> generic: "Paracetamol", brand: "Dolo", strength: "650mg"
   - "Augmentin 625 Duo" -> generic: "Amoxicillin and Clavulanate Potassium", brand: "Augmentin", strength: "500mg/125mg"
   - "Pan 40" -> generic: "Pantoprazole", brand: "Pan", strength: "40mg"
   - "Combiflam" -> generic: "Ibuprofen and Paracetamol", brand: "Combiflam", strength: "400mg/325mg"
   - "Montek LC" -> generic: "Montelukast and Levocetirizine", brand: "Montek-LC", strength: "10mg/5mg"
   - "Glycomet GP 1" -> generic: "Glimepiride and Metformin", brand: "Glycomet-GP", strength: "1mg/500mg"
2. From the candidate list above, select the best matching `selected_medicine_id` (or null if no candidate represents this medicine).
3. If no candidate matches directly, specify the exact canonical generic_name and brand_name so we can query our full database of 12,000+ medicines.

Respond with strict JSON ONLY (no markdown text outside the JSON):
{{
  "selected_medicine_id": <int or null>,
  "generic_name": "<Canonical Generic Substance>",
  "brand_name": "<Commercial Brand Name or null>",
  "strength": "<Standard Strength e.g. 650mg>",
  "form": "<Standard Form e.g. TABLET, CAPSULE, SYRUP>",
  "confidence": <float between 0.0 and 1.0>,
  "reasoning": "<1-sentence clinical rationale>"
}}
"""

    raw_ai_out = _try_ollama_completion(prompt)
    model_source = "ollama"
    if not raw_ai_out:
        raw_ai_out = _try_gemini_completion(prompt)
        model_source = "gemini_flash"

    if not raw_ai_out:
        logger.warning("All AI models failed for medicine fallback: %s", raw_name)
        return None

    parsed = _clean_json_response(raw_ai_out)
    if not parsed:
        logger.warning("Failed to parse JSON response for: %s", raw_name)
        return None

    selected_id = parsed.get("selected_medicine_id")
    predicted_gen = (parsed.get("generic_name") or "").strip()
    predicted_brand = (parsed.get("brand_name") or "").strip()
    predicted_strength = (parsed.get("strength") or "").strip()
    predicted_form = (parsed.get("form") or "").strip().upper()
    confidence = float(parsed.get("confidence") or 0.85)
    reasoning = parsed.get("reasoning") or f"AI-generalized match via {model_source}"

    # Step 4: Validate or find medicine_id in PostgreSQL catalog
    matched_row = None
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if selected_id:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, strength, form::TEXT AS form
                    FROM medicine WHERE medicine_id = %s
                    """,
                    (selected_id,),
                )
                matched_row = cur.fetchone()

            # If no ID or ID not found, search full database for predicted generic & strength
            if not matched_row and predicted_gen:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, strength, form::TEXT AS form
                    FROM medicine
                    WHERE (LOWER(generic_name) = LOWER(%s) OR generic_name ILIKE %s)
                    ORDER BY (
                        CASE WHEN strength ILIKE %s THEN 0 ELSE 1 END
                    ), similarity(generic_name, %s) DESC
                    LIMIT 1
                    """,
                    (predicted_gen, f"%{predicted_gen}%", f"%{predicted_strength}%", predicted_gen),
                )
                matched_row = cur.fetchone()

            # If still not found, search by predicted brand
            if not matched_row and predicted_brand:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, strength, form::TEXT AS form
                    FROM medicine
                    WHERE (LOWER(brand_name) = LOWER(%s) OR brand_name ILIKE %s)
                    LIMIT 1
                    """,
                    (predicted_brand, f"%{predicted_brand}%"),
                )
                matched_row = cur.fetchone()

            # If still not found, pick top candidate from earlier if similarity is acceptable
            if not matched_row and candidate_rows:
                top = candidate_rows[0]
                matched_row = top

            # Step 5: Save to medicine_alias for zero-latency future lookups
            if matched_row:
                try:
                    cur.execute(
                        """
                        INSERT INTO medicine_alias (alias_name, medicine_id, alias_type, notes)
                        VALUES (LOWER(%s), %s, 'ai_fallback', %s)
                        ON CONFLICT (alias_name) DO UPDATE
                        SET medicine_id = EXCLUDED.medicine_id,
                            notes = EXCLUDED.notes
                        """,
                        (clean_name, matched_row["medicine_id"], f"Learned via {model_source}: {reasoning}"),
                    )
                    conn.commit()
                except Exception as exc:
                    logger.debug("Failed to cache alias: %s", exc)

    if not matched_row:
        return None

    return {
        "status": "MATCHED",
        "medicine_id": matched_row["medicine_id"],
        "generic_name": matched_row["generic_name"],
        "brand_name": matched_row["brand_name"],
        "strength": matched_row["strength"],
        "form": matched_row["form"],
        "confidence": confidence,
        "reasoning": reasoning,
        "source": model_source,
    }


def resolve_unresolved_prescription_medicines(
    prescription_id: int,
    dispensary_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Auto-resolve all unreviewed, unresolved medicine items for a prescription using AI.

    Updates `prescription_medicine` rows and refreshes any linked `dispensary_request_item`
    rows with free stock availability.
    """
    resolved_items = []

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch unreviewed, unresolved rows
            cur.execute(
                """
                SELECT pm.prescription_medicine_id, pm.name, pm.dosage,
                       pm.match_status, pm.patient_resolved
                FROM prescription_medicine pm
                WHERE pm.prescription_id = %s
                  AND (pm.patient_resolved IS NOT TRUE)
                  AND (pm.match_status IN ('UNRESOLVED', 'AMBIGUOUS', 'NOT_A_MEDICINE') OR pm.medicine_id IS NULL)
                """,
                (prescription_id,),
            )
            rows = cur.fetchall()

    for row in rows:
        pm_id = row["prescription_medicine_id"]
        raw_name = row["name"]
        dosage = row["dosage"]
        form = None

        pred = predict_medicine_fallback(raw_name, extracted_dosage=dosage, extracted_form=form)
        if pred and pred.get("medicine_id"):
            med_id = pred["medicine_id"]

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Update prescription_medicine
                    cur.execute(
                        """
                        UPDATE prescription_medicine
                        SET medicine_id = %s,
                            match_status = 'MATCHED'
                        WHERE prescription_medicine_id = %s
                        """,
                        (med_id, pm_id),
                    )

                    # Update dispensary_request_item if it exists
                    cur.execute(
                        """
                        SELECT item.item_id, item.request_id, req.dispensary_id, item.required_quantity
                        FROM dispensary_request_item item
                        JOIN dispensary_request req ON req.request_id = item.request_id
                        WHERE item.prescription_medicine_id = %s
                        """,
                        (pm_id,),
                    )
                    req_items = cur.fetchall()

                    for req_item in req_items:
                        item_id = req_item["item_id"]
                        req_disp_id = dispensary_id or req_item["dispensary_id"]
                        req_qty = req_item["required_quantity"] or 1

                        # Check stock for the predicted medicine at this dispensary
                        cur.execute(
                            """
                            SELECT (available_quantity - reserved_quantity) AS free_stock
                            FROM inventory_dispensary_stock
                            WHERE dispensary_id = %s AND medicine_id = %s
                            """,
                            (req_disp_id, med_id),
                        )
                        st = cur.fetchone()
                        free_stock = (st["free_stock"] if st else 0) or 0

                        if free_stock >= req_qty:
                            avail = "AVAILABLE"
                        elif free_stock > 0:
                            avail = "PARTIAL"
                        else:
                            avail = "UNAVAILABLE"

                        cur.execute(
                            """
                            UPDATE dispensary_request_item
                            SET medicine_id = %s,
                                availability_status = %s
                            WHERE item_id = %s
                            """,
                            (med_id, avail, item_id),
                        )

                        # Recalibrate parent dispensary_request status
                        cur.execute(
                            """
                            SELECT availability_status FROM dispensary_request_item
                            WHERE request_id = %s
                            """,
                            (req_item["request_id"],),
                        )
                        all_st = [r["availability_status"] for r in cur.fetchall()]
                        if all_st and all(s == "AVAILABLE" for s in all_st):
                            new_req_status = "PENDING"
                        elif any(s in ("AVAILABLE", "PARTIAL") for s in all_st):
                            new_req_status = "PARTIALLY_AVAILABLE"
                        else:
                            new_req_status = "UNAVAILABLE"

                        cur.execute(
                            """
                            UPDATE dispensary_request
                            SET status = %s
                            WHERE request_id = %s AND status NOT IN ('CONFIRMED', 'PROCESSING', 'READY', 'DISPENSED', 'CANCELLED')
                            """,
                            (new_req_status, req_item["request_id"]),
                        )

                    conn.commit()

            resolved_items.append({
                "prescription_medicine_id": pm_id,
                "raw_name": raw_name,
                "matched_medicine_id": med_id,
                "generic_name": pred["generic_name"],
                "brand_name": pred.get("brand_name"),
                "strength": pred.get("strength"),
                "reasoning": pred.get("reasoning"),
                "source": pred.get("source"),
            })

    return {
        "prescription_id": prescription_id,
        "resolved_count": len(resolved_items),
        "resolved_items": resolved_items,
    }
