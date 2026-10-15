"""Patient service layer — PostgreSQL.

Consolidates all patient-facing database operations into one module:
  - Prescription queries (own records only)
  - Dashboard statistics
  - Doctor connection requests (lookup, send, list, assigned doctor)

Patients can only see their OWN records — no cross-patient access.
All queries use the ER-diagram schema:
  patient / prescription / prescription_medicine / patient_doctor / patient_share_tokens
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn
from services.medicine_matcher import resolve_medicine


# =============================================================================
# Prescription queries (patient-scoped)
# =============================================================================

def get_my_prescriptions(patient_user_id: int) -> List[Dict[str, Any]]:
    """Return all prescriptions for this patient (by user_id), newest first."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    rx.prescription_id  AS id,
                    rx.diagnosis,
                    rx.issue_date,
                    rx.follow_up_date,
                    rx.notes,
                    ch.name             AS clinic_name
                FROM prescription rx
                JOIN patient pt ON pt.patient_id = rx.patient_id
                LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
                WHERE pt.user_id = %s
                ORDER BY rx.prescription_id DESC
                """,
                (patient_user_id,),
            )
            return [dict(row) for row in cur.fetchall()]


def get_my_prescription_detail(
    patient_user_id: int, prescription_id: int
) -> Optional[Dict[str, Any]]:
    """Return full detail (including medications) for one of the patient's prescriptions.

    Each medication entry now includes:
    - ``raw_name``        — Gemini-extracted text (always present)
    - ``match_status``   — MATCHED | AMBIGUOUS | UNRESOLVED | NOT_A_MEDICINE | NULL
    - ``patient_resolved`` — True when the patient confirmed the catalog match
    - ``medicine_id``    — catalog ID (only when MATCHED)
    - ``generic_name``, ``brand_name``, ``strength``, ``form``, ``category``
                         — catalog fields (NULL when not MATCHED)
    - ``name``           — display name: catalog brand/generic falls back to raw_name
    - Dosage/frequency/duration/instructions always come from prescription_medicine
      (they are the doctor's instructions, not catalog properties).

    Returns None if the prescription does not exist or belongs to someone else.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    rx.prescription_id  AS id,
                    rx.diagnosis,
                    rx.issue_date,
                    rx.follow_up_date,
                    rx.notes,
                    rx.raw_text,
                    ch.name             AS clinic_name,
                    ch.address          AS clinic_address,
                    ch.phone            AS clinic_phone,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'id',               pm.prescription_medicine_id,
                                    'raw_name',         pm.name,
                                    'match_status',     pm.match_status,
                                    'patient_resolved', COALESCE(pm.patient_resolved, FALSE),
                                    'medicine_id',      pm.medicine_id,
                                    'generic_name',     m.generic_name,
                                    'brand_name',       m.brand_name,
                                    'strength',         m.strength,
                                    'form',             m.form::TEXT,
                                    'category',         m.category,
                                    'name',             COALESCE(m.brand_name, m.generic_name, pm.name),
                                    'dosage',           pm.dosage,
                                    'frequency',        pm.frequency,
                                    'duration',         pm.duration,
                                    'instructions',     pm.instructions,
                                    'date',             pm.created_at
                                ) ORDER BY pm.prescription_medicine_id
                            )
                            FROM prescription_medicine pm
                            LEFT JOIN medicine m ON m.medicine_id = pm.medicine_id
                            WHERE pm.prescription_id = rx.prescription_id
                        ),
                        '[]'::json
                    ) AS medications
                FROM prescription rx
                JOIN patient pt ON pt.patient_id = rx.patient_id
                LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
                WHERE rx.prescription_id = %s AND pt.user_id = %s
                """,
                (prescription_id, patient_user_id),
            )
            row = cur.fetchone()
            if not row:
                return None

            prescription = dict(row)
            for k in ("issue_date", "follow_up_date"):
                if prescription.get(k):
                    prescription[k] = str(prescription[k])
            return prescription


def get_patient_stats(patient_user_id: int) -> Dict[str, Any]:
    """Return overview dashboard statistics for a patient (resolved from user_id)."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    pt.patient_id,
                    pt.patient_code,
                    u.full_name,
                    u.email,
                    (SELECT COUNT(*) FROM prescription WHERE patient_id = pt.patient_id) AS rx_count,
                    (SELECT COUNT(*) FROM patient_doctor WHERE patient_id = pt.patient_id AND status = 'pending') AS pending_requests,
                    (SELECT COUNT(*) FROM patient_share_tokens WHERE patient_id = pt.patient_id AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())) AS active_shares
                FROM patient pt
                JOIN users u ON u.user_id = pt.user_id
                WHERE pt.user_id = %s
                """,
                (patient_user_id,),
            )
            row = cur.fetchone()
            if row is None:
                return {"rx_count": 0, "pending_requests": 0, "active_shares": 0, "patient_code": None}
            return {
                "patient_id": row["patient_id"],
                "patient_code": row["patient_code"],
                "full_name": row["full_name"],
                "email": row["email"],
                "rx_count": row["rx_count"] or 0,
                "pending_requests": row["pending_requests"] or 0,
                "active_shares": row["active_shares"] or 0,
            }


# =============================================================================
# Doctor connection requests
# =============================================================================

def lookup_doctor(doctor_id: int) -> Optional[Dict[str, Any]]:
    """Look up a doctor by their doctor_id (numeric primary key).

    Returns user_id, email, full_name, specialization, or None if not found.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT d.doctor_id      AS id,
                       CONCAT('RXF-D-', d.doctor_id) AS doctor_code,
                       u.user_id,
                       u.email          AS username,
                       u.full_name      AS display_name,
                       d.specialization AS specialty,
                       d.license_number,
                       d.experience_years
                FROM doctor d
                JOIN users u ON u.user_id = d.user_id
                WHERE d.doctor_id = %s
                """,
                (doctor_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def send_doctor_request(patient_user_id: int, doctor_id: int) -> Dict[str, Any]:
    """Send a connection request from a patient to a doctor.

    Args:
        patient_user_id: users.user_id of the logged-in patient.
        doctor_id:       doctor.doctor_id of the target doctor.

    Returns:
        Dict with keys ``success`` (bool) and ``message`` (str).
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # Resolve patient_id from user_id
            cur.execute(
                "SELECT patient_id FROM patient WHERE user_id = %s",
                (patient_user_id,),
            )
            row = cur.fetchone()
            if row is None:
                return {"success": False, "message": "Patient profile not found."}
            patient_id = row["patient_id"]

            # Confirm target is a real doctor
            cur.execute(
                "SELECT doctor_id FROM doctor WHERE doctor_id = %s",
                (doctor_id,),
            )
            if cur.fetchone() is None:
                return {"success": False, "message": "No doctor found with that ID."}

            # Check for existing relationship
            cur.execute(
                """
                SELECT patient_doctor_id, status FROM patient_doctor
                WHERE patient_id = %s AND doctor_id = %s
                """,
                (patient_id, doctor_id),
            )
            existing = cur.fetchone()

            if existing:
                if existing["status"] == "pending":
                    return {"success": False, "message": "You already have a pending request with this doctor."}
                if existing["status"] == "active":
                    return {"success": False, "message": "You are already connected to this doctor."}

                # Re-send a previously rejected request
                cur.execute(
                    "UPDATE patient_doctor SET status = 'pending', created_at = NOW() WHERE patient_doctor_id = %s",
                    (existing["patient_doctor_id"],),
                )
                return {"success": True, "message": "Connection request re-sent successfully."}

            # Insert new request
            cur.execute(
                """
                INSERT INTO patient_doctor (patient_id, doctor_id, status)
                VALUES (%s, %s, 'pending')
                """,
                (patient_id, doctor_id),
            )
            return {"success": True, "message": "Connection request sent! Waiting for doctor to accept."}


def get_my_requests(patient_user_id: int) -> List[Dict[str, Any]]:
    """Return all connection requests sent by this patient, with doctor details."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    pd.patient_doctor_id    AS id,
                    d.doctor_id,
                    pd.created_at           AS requested_at,
                    pd.status,
                    u.email                 AS doctor_username,
                    u.full_name             AS doctor_display_name,
                    d.specialization        AS doctor_specialty
                FROM patient_doctor pd
                JOIN patient  pt ON pt.patient_id = pd.patient_id
                JOIN doctor   d  ON d.doctor_id   = pd.doctor_id
                JOIN users    u  ON u.user_id      = d.user_id
                WHERE pt.user_id = %s
                ORDER BY pd.created_at DESC
                """,
                (patient_user_id,),
            )
            return [dict(row) for row in cur.fetchall()]


def get_assigned_doctor(patient_user_id: int) -> Optional[Dict[str, Any]]:
    """Return the active doctor currently assigned to this patient, or None."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    d.doctor_id         AS id,
                    u.email             AS username,
                    u.full_name         AS display_name,
                    d.specialization    AS specialty,
                    pd.created_at       AS assigned_at
                FROM patient_doctor pd
                JOIN patient  pt ON pt.patient_id = pd.patient_id
                JOIN doctor   d  ON d.doctor_id   = pd.doctor_id
                JOIN users    u  ON u.user_id      = d.user_id
                WHERE pt.user_id = %s AND pd.status = 'active'
                ORDER BY pd.created_at DESC
                LIMIT 1
                """,
                (patient_user_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


# =============================================================================
# Medicine Clarification (patient-initiated resolution)
# =============================================================================

def get_medicine_candidates(
    pm_id: int,
    patient_user_id: int,
) -> Optional[Dict[str, Any]]:
    """Return matcher candidates for an AMBIGUOUS or UNRESOLVED prescription medicine.

    Verifies the patient owns the prescription that contains this medicine entry,
    then re-runs the resolution pipeline to surface ranked candidates.

    For AMBIGUOUS entries: returns the full candidates list from the matcher.
    For UNRESOLVED entries: falls back to a lower-threshold trgm search so the
    patient still gets suggestions even when the normal pipeline found nothing.

    Args:
        pm_id:            prescription_medicine.prescription_medicine_id
        patient_user_id:  users.user_id of the logged-in patient

    Returns:
        Dict with keys ``pm_id``, ``raw_name``, ``match_status``, ``candidates``.
        ``candidates`` is a list of catalog dicts (medicine_id, generic_name,
        brand_name, strength, form, category, match_confidence, match_method).
        Returns None if the row doesn't exist or doesn't belong to this patient.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Ownership check: pm → prescription → patient → users
            cur.execute(
                """
                SELECT pm.prescription_medicine_id, pm.name AS raw_name,
                       pm.dosage, pm.frequency, pm.match_status, pm.patient_resolved
                FROM prescription_medicine pm
                JOIN prescription rx ON rx.prescription_id = pm.prescription_id
                JOIN patient pt       ON pt.patient_id      = rx.patient_id
                WHERE pm.prescription_medicine_id = %s AND pt.user_id = %s
                """,
                (pm_id, patient_user_id),
            )
            row = cur.fetchone()
            if not row:
                return None

    pm = dict(row)
    raw_name = pm["raw_name"]
    match_status = pm["match_status"]

    # Re-run the matcher — it's pure SQL and fast (~10ms)
    result = resolve_medicine(
        raw_name=raw_name,
        extracted_dosage=pm.get("dosage"),
    )

    candidates: List[Dict[str, Any]] = []

    if result.get("status") == "MATCHED":
        # Matcher now confident — surface as a single candidate
        candidates = [{
            "medicine_id":      result["medicine_id"],
            "generic_name":     result.get("matched_name"),
            "brand_name":       None,
            "strength":         result.get("strength"),
            "form":             result.get("form"),
            "category":         None,
            "match_confidence": result.get("match_confidence", 1.0),
            "match_method":     result.get("match_method", "auto"),
        }]
    elif result.get("status") == "AMBIGUOUS":
        # Enrich candidate list with category from the medicine table
        raw_candidates = result.get("candidates", [])
        if raw_candidates:
            med_ids = [c["medicine_id"] for c in raw_candidates]
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT medicine_id, generic_name, brand_name,
                               strength, form::TEXT AS form, category
                        FROM medicine
                        WHERE medicine_id = ANY(%s)
                        """,
                        (med_ids,),
                    )
                    db_rows = {r["medicine_id"]: dict(r) for r in cur.fetchall()}
            for c in raw_candidates:
                db = db_rows.get(c["medicine_id"], {})
                candidates.append({
                    "medicine_id":      c["medicine_id"],
                    "generic_name":     db.get("generic_name") or c.get("generic_name"),
                    "brand_name":       db.get("brand_name")   or c.get("brand_name"),
                    "strength":         db.get("strength")     or c.get("strength"),
                    "form":             db.get("form")         or c.get("form"),
                    "category":         db.get("category"),
                    "match_confidence": c.get("match_confidence", 0.5),
                    "match_method":     c.get("match_method", "trgm"),
                })
    else:
        # UNRESOLVED / NOT_A_MEDICINE — do a low-threshold trgm search as fallback
        # Strip common form prefixes and strength tokens for a cleaner search term
        from services.medicine_matcher import _clean_name
        clean_term = _clean_name(raw_name) or raw_name
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        medicine_id,
                        generic_name,
                        brand_name,
                        strength,
                        form::TEXT AS form,
                        category,
                        GREATEST(
                            similarity(LOWER(generic_name), LOWER(%s)),
                            similarity(LOWER(COALESCE(brand_name, '')), LOWER(%s))
                        ) AS sim_score
                    FROM medicine
                    WHERE similarity(LOWER(generic_name),            LOWER(%s)) > 0.15
                       OR similarity(LOWER(COALESCE(brand_name,'')), LOWER(%s)) > 0.15
                       OR LOWER(generic_name) ILIKE %s
                       OR LOWER(COALESCE(brand_name, '')) ILIKE %s
                    ORDER BY sim_score DESC
                    LIMIT 8
                    """,
                    (
                        clean_term, clean_term,
                        clean_term, clean_term,
                        f"%{clean_term}%", f"%{clean_term}%",
                    ),
                )
                rows = cur.fetchall()
            candidates = [
                {
                    "medicine_id":      r["medicine_id"],
                    "generic_name":     r["generic_name"],
                    "brand_name":       r["brand_name"],
                    "strength":         r["strength"],
                    "form":             r["form"],
                    "category":         r["category"],
                    "match_confidence": float(r["sim_score"] or 0),
                    "match_method":     "fallback_trgm",
                }
                for r in rows
            ]

    return {
        "pm_id":        pm_id,
        "raw_name":     raw_name,
        "match_status": match_status,
        "candidates":   candidates,
    }


def resolve_prescription_medicine(
    pm_id: int,
    medicine_id: int,
    patient_user_id: int,
) -> Optional[Dict[str, Any]]:
    """Patient-driven medicine resolution: commit a catalog medicine_id.

    Verifies ownership, validates the medicine_id exists in the catalog,
    updates prescription_medicine (medicine_id, match_status='MATCHED',
    patient_resolved=TRUE), and triggers dispensary request re-evaluation
    so that stock availability is refreshed for the now-identified medicine.

    Args:
        pm_id:            prescription_medicine.prescription_medicine_id
        medicine_id:      medicine.medicine_id chosen by the patient
        patient_user_id:  users.user_id of the logged-in patient

    Returns:
        Dict with keys ``pm_id``, ``medicine_id``, ``generic_name``,
        ``brand_name``, ``strength``, ``form``, ``category``, ``prescription_id``.
        Returns None if the row doesn't exist or doesn't belong to this patient.
    Raises:
        ValueError if medicine_id is not a valid catalog entry.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Ownership check: pm → prescription → patient → users
            cur.execute(
                """
                SELECT pm.prescription_medicine_id, pm.prescription_id,
                       pm.name, pm.patient_resolved
                FROM prescription_medicine pm
                JOIN prescription rx ON rx.prescription_id = pm.prescription_id
                JOIN patient pt       ON pt.patient_id      = rx.patient_id
                WHERE pm.prescription_medicine_id = %s AND pt.user_id = %s
                """,
                (pm_id, patient_user_id),
            )
            pm_row = cur.fetchone()
            if not pm_row:
                return None

            prescription_id = pm_row["prescription_id"]

            # 2. Validate medicine catalog entry
            cur.execute(
                """
                SELECT medicine_id, generic_name, brand_name,
                       strength, form::TEXT AS form, category
                FROM medicine
                WHERE medicine_id = %s
                """,
                (medicine_id,),
            )
            med_row = cur.fetchone()
            if not med_row:
                raise ValueError(f"Medicine ID {medicine_id} does not exist in catalog.")

            # 3. Commit the patient's choice — mark patient_resolved to protect
            #    this row from future automatic re-matching.
            cur.execute(
                """
                UPDATE prescription_medicine
                SET medicine_id      = %s,
                    match_status     = 'MATCHED',
                    patient_resolved = TRUE
                WHERE prescription_medicine_id = %s
                """,
                (medicine_id, pm_id),
            )

            # 3b. Self-learning: store this user-confirmed match in medicine_alias
            raw_text = pm_row.get("name")
            if raw_text:
                from services.medicine_matcher import _clean_name
                alias_clean = _clean_name(raw_text)
                if alias_clean and len(alias_clean) >= 2:
                    try:
                        cur.execute(
                            """
                            INSERT INTO medicine_alias (alias_name, medicine_id, alias_type, notes)
                            VALUES (LOWER(%s), %s, 'user_learned', 'Learned from patient confirmation')
                            ON CONFLICT (alias_name) DO UPDATE SET medicine_id = EXCLUDED.medicine_id
                            """,
                            (alias_clean, medicine_id),
                        )
                    except Exception as e:
                        print(f"[ALIAS LEARN WARNING] Could not persist learned alias {alias_clean}: {e}")


            result = {
                "pm_id":           pm_id,
                "prescription_id": prescription_id,
                "medicine_id":     med_row["medicine_id"],
                "generic_name":    med_row["generic_name"],
                "brand_name":      med_row["brand_name"],
                "strength":        med_row["strength"],
                "form":            med_row["form"],
                "category":        med_row["category"],
                "patient_resolved": True,
            }

    # 4. Re-trigger dispensary request evaluation now that medicine_id is known.
    #    Done OUTSIDE the transaction so the commit above is visible.
    try:
        from services import dispensary as dispensary_service
        dispensary_service.create_dispensary_request_for_prescription(prescription_id)
    except Exception as exc:
        # Non-fatal: dispensary update failure must not break the patient's save
        print(f"[DISPENSARY RE-EVAL] Failed for rx #{prescription_id}: {exc}")

    return result


# =============================================================================
# Medication Timeline & Current Medication Management
# =============================================================================

def _backfill_patient_current_medications(patient_id: int) -> None:
    """Ensure any past prescriptions have their medicines registered in current_medication."""
    from services.prescription import _populate_current_medications
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT rx.prescription_id, rx.issue_date
                FROM prescription rx
                WHERE rx.patient_id = %s
                  AND EXISTS (
                      SELECT 1 FROM prescription_medicine pm
                      WHERE pm.prescription_id = rx.prescription_id
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM current_medication cm
                      JOIN prescription_medicine pm ON pm.prescription_medicine_id = cm.prescription_medicine_id
                      WHERE pm.prescription_id = rx.prescription_id
                  )
                """,
                (patient_id,),
            )
            unfilled = cur.fetchall()

    for row in unfilled:
        try:
            issue_date = str(row["issue_date"]) if row["issue_date"] else None
            _populate_current_medications(row["prescription_id"], patient_id, issue_date)
        except Exception as e:
            print(f"[TIMELINE BACKFILL] Skipped rx #{row['prescription_id']}: {e}")


def get_patient_medication_timeline(patient_user_id: int) -> Dict[str, Any]:
    """Build a comprehensive chronological flowchart timeline of active, continued,

    and discontinued medications for a patient.

    Logic:
      1. Resolves patient_id from patient_user_id.
      2. Ensures any historical prescriptions are backfilled into current_medication.
      3. Gathers all current_medication rows with joined prescription & medicine details.
      4. Groups events into chronological milestones (nodes).
      5. Analyzes transitions between milestones:
         - NEW: newly introduced at this date
         - CONTINUED: continuing from earlier prescription, still active
         - DISCONTINUED: explicitly stopped by patient/doctor
         - COMPLETED: duration ended
      6. Provides graph flowchart connections (source node/medication -> target node/medication).
    """
    import datetime as _dt

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (patient_user_id,))
            p_row = cur.fetchone()
            if not p_row:
                return {
                    "patient_id": None,
                    "milestones": [],
                    "flowchart_links": [],
                    "active_now": [],
                    "summary": {
                        "total_prescriptions": 0,
                        "active_now_count": 0,
                        "discontinued_count": 0,
                        "completed_count": 0,
                    },
                }
            patient_id = p_row["patient_id"]

    # 1. Backfill legacy prescriptions if needed
    _backfill_patient_current_medications(patient_id)

    today = _dt.date.today()

    # 2. Query all current_medication records
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    cm.current_medication_id,
                    cm.patient_id,
                    cm.prescription_medicine_id,
                    cm.medicine_id,
                    COALESCE(m.brand_name, m.generic_name, pm.name, 'Unknown Medication') AS display_name,
                    m.generic_name,
                    m.brand_name,
                    m.strength,
                    m.form::TEXT AS form,
                    m.category,
                    COALESCE(cm.dosage, pm.dosage) AS dosage,
                    COALESCE(cm.frequency, pm.frequency) AS frequency,
                    pm.duration,
                    pm.instructions,
                    cm.start_date,
                    cm.end_date,
                    cm.status,
                    cm.notes,
                    rx.prescription_id,
                    rx.issue_date AS rx_issue_date,
                    COALESCE(doc_u.full_name, 'Prescribing Doctor') AS doctor_name,
                    rx.diagnosis,
                    cm.created_at
                FROM current_medication cm
                LEFT JOIN prescription_medicine pm ON pm.prescription_medicine_id = cm.prescription_medicine_id
                LEFT JOIN prescription rx ON rx.prescription_id = pm.prescription_id
                LEFT JOIN medicine m ON m.medicine_id = COALESCE(cm.medicine_id, pm.medicine_id)
                LEFT JOIN doctor doc ON doc.doctor_id = rx.doctor_id
                LEFT JOIN users doc_u ON doc_u.user_id = doc.user_id
                WHERE cm.patient_id = %s
                ORDER BY
                    COALESCE(cm.start_date, rx.issue_date, cm.created_at::date) ASC,
                    cm.current_medication_id ASC
                """,
                (patient_id,),
            )
            raw_rows = cur.fetchall()

    if not raw_rows:
        return {
            "patient_id": patient_id,
            "milestones": [],
            "flowchart_links": [],
            "active_now": [],
            "summary": {
                "total_prescriptions": 0,
                "active_now_count": 0,
                "discontinued_count": 0,
                "completed_count": 0,
            },
        }

    # Helper to guarantee pure datetime.date objects for safe comparisons
    def _to_date(val: Any) -> Optional[_dt.date]:
        if val is None:
            return None
        if isinstance(val, _dt.datetime):
            return val.date()
        if isinstance(val, _dt.date):
            return val
        if isinstance(val, str):
            try:
                return _dt.date.fromisoformat(val.strip().split("T")[0])
            except ValueError:
                return None
        return None

    # Format dates and normalize rows
    all_meds = []
    seen_prescriptions = set()
    for r in raw_rows:
        raw_start = r["start_date"] or r["rx_issue_date"] or (r["created_at"].date() if r["created_at"] else today)
        start_d = _to_date(raw_start) or today
        end_d = _to_date(r["end_date"])
        status = r["status"]

        # Check if duration naturally expired
        is_past_end = bool(end_d and end_d < today)
        effective_status = status
        if status == "ACTIVE" and is_past_end:
            effective_status = "COMPLETED"

        rx_id = r["prescription_id"]
        if rx_id:
            seen_prescriptions.add(rx_id)

        all_meds.append({
            "current_medication_id": r["current_medication_id"],
            "prescription_medicine_id": r["prescription_medicine_id"],
            "medicine_id": r["medicine_id"],
            "name": r["display_name"],
            "generic_name": r["generic_name"],
            "brand_name": r["brand_name"],
            "strength": r["strength"],
            "form": r["form"],
            "category": r["category"],
            "dosage": r["dosage"],
            "frequency": r["frequency"],
            "duration": r["duration"],
            "instructions": r["instructions"],
            "start_date": str(start_d) if start_d else None,
            "start_date_obj": start_d,
            "end_date": str(end_d) if end_d else None,
            "end_date_obj": end_d,
            "status": status,
            "effective_status": effective_status,
            "notes": r["notes"],
            "prescription_id": rx_id,
            "doctor_name": r["doctor_name"],
            "diagnosis": r["diagnosis"],
        })

    # Group into chronological milestone dates
    # Each milestone date is an event point (e.g. prescription date or start date)
    milestone_dates = sorted(list({m["start_date_obj"] for m in all_meds if m["start_date_obj"]}))

    milestones = []
    flowchart_links = []
    med_last_seen_node = {}  # med_name_clean -> last milestone node index & item key

    for idx, m_date in enumerate(milestone_dates):
        date_str = str(m_date)
        display_date = m_date.strftime("%d %b %Y") if hasattr(m_date, "strftime") else str(m_date)

        # What prescriptions were issued on this date?
        rx_ids_on_date = sorted(list({
            m["prescription_id"] for m in all_meds
            if m["start_date_obj"] == m_date and m["prescription_id"]
        }))
        doctors_on_date = list(dict.fromkeys([
            m["doctor_name"] for m in all_meds
            if m["start_date_obj"] == m_date and m["doctor_name"]
        ]))
        diagnoses_on_date = list(dict.fromkeys([
            m["diagnosis"] for m in all_meds
            if m["start_date_obj"] == m_date and m["diagnosis"]
        ]))

        # Which medications are part of the patient's regimen at date m_date?
        # A medication belongs to this milestone if:
        # 1. It was introduced ON this date (m["start_date_obj"] == m_date), OR
        # 2. It was introduced BEFORE this date and was still active or ongoing on this date
        items_at_milestone = []
        milestone_rx_set = set()

        for med in all_meds:
            s_obj = med["start_date_obj"]
            e_obj = med["end_date_obj"]

            if not s_obj:
                continue

            # Started exactly on this milestone
            is_new = (s_obj == m_date)

            # Started before, but still active at m_date
            is_carried_over = (
                s_obj < m_date
                and (e_obj is None or e_obj >= m_date)
                and med["status"] != "DISCONTINUED"
            )

            # Just discontinued on or before this date
            is_stopped_here = (
                s_obj < m_date
                and (
                    med["status"] == "DISCONTINUED"
                    or (e_obj and e_obj < m_date and e_obj >= (milestone_dates[idx - 1] if idx > 0 else s_obj))
                )
            )

            if is_new or is_carried_over or is_stopped_here:
                if med["prescription_id"]:
                    milestone_rx_set.add(med["prescription_id"])

                clean_name = (med["name"] or "").strip().lower()
                node_item_id = f"node-{idx}-{med['current_medication_id']}"

                transition = "STARTED"
                if is_carried_over:
                    transition = "CONTINUED"
                elif is_stopped_here:
                    transition = "DISCONTINUED" if med["status"] == "DISCONTINUED" else "COMPLETED"

                # Flowchart link: connect from previous milestone where this medicine was present
                link_source = None
                if clean_name in med_last_seen_node:
                    prev_info = med_last_seen_node[clean_name]
                    link_source = prev_info["node_item_id"]
                    flowchart_links.append({
                        "id": f"link-{prev_info['node_item_id']}->{node_item_id}",
                        "source": prev_info["node_item_id"],
                        "target": node_item_id,
                        "source_milestone": prev_info["milestone_idx"],
                        "target_milestone": idx,
                        "medicine_name": med["name"],
                        "type": transition,
                    })

                med_last_seen_node[clean_name] = {
                    "node_item_id": node_item_id,
                    "milestone_idx": idx,
                    "date": date_str,
                }

                item_data = dict(med)
                item_data.pop("start_date_obj", None)
                item_data.pop("end_date_obj", None)
                item_data["node_item_id"] = node_item_id
                item_data["transition"] = transition
                item_data["connected_from"] = link_source
                items_at_milestone.append(item_data)

        # Count active in this milestone
        active_in_milestone = [it for it in items_at_milestone if it["transition"] in ("STARTED", "CONTINUED")]

        milestones.append({
            "index": idx,
            "date": date_str,
            "display_date": display_date,
            "title": f"Prescription Record #{rx_ids_on_date[0]}" if rx_ids_on_date else f"Health Milestone ({display_date})",
            "prescription_ids": rx_ids_on_date,
            "doctors": doctors_on_date,
            "diagnoses": diagnoses_on_date,
            "total_active_meds": len(active_in_milestone),
            "medications": items_at_milestone,
        })

    # Compile currently active medications (as of today)
    active_now = []
    discontinued_count = 0
    completed_count = 0

    for med in all_meds:
        s = dict(med)
        s.pop("start_date_obj", None)
        s.pop("end_date_obj", None)

        if med["status"] == "DISCONTINUED":
            discontinued_count += 1
        elif med["effective_status"] == "COMPLETED":
            completed_count += 1
        elif med["status"] == "ACTIVE":
            active_now.append(s)

    return {
        "patient_id": patient_id,
        "milestones": milestones,
        "flowchart_links": flowchart_links,
        "active_now": active_now,
        "summary": {
            "total_prescriptions": len(seen_prescriptions),
            "total_tracked_medications": len(all_meds),
            "active_now_count": len(active_now),
            "discontinued_count": discontinued_count,
            "completed_count": completed_count,
            "timeline_nodes_count": len(milestones),
        },
    }


def update_patient_medication_status(
    patient_user_id: int,
    current_medication_id: int,
    status: str,
    end_date: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Allow a patient to mark a medication as ACTIVE, DISCONTINUED, or COMPLETED.

    Also supports updating the medication's end_date or reason notes.
    """
    valid_statuses = {"ACTIVE", "DISCONTINUED", "COMPLETED"}
    norm_status = status.strip().upper()
    if norm_status not in valid_statuses:
        raise ValueError(f"Invalid medication status: '{status}'. Must be one of {valid_statuses}")

    import datetime as _dt
    parsed_end = None
    if end_date:
        try:
            parsed_end = _dt.date.fromisoformat(end_date)
        except ValueError:
            raise ValueError(f"Invalid end_date format: '{end_date}'. Expected YYYY-MM-DD.")
    elif norm_status in ("DISCONTINUED", "COMPLETED"):
        parsed_end = _dt.date.today()

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Verify ownership
            cur.execute(
                """
                SELECT cm.current_medication_id, cm.patient_id, cm.status, cm.end_date
                FROM current_medication cm
                JOIN patient pt ON pt.patient_id = cm.patient_id
                WHERE cm.current_medication_id = %s AND pt.user_id = %s
                """,
                (current_medication_id, patient_user_id),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("Medication record not found or access denied.")

            cur.execute(
                """
                UPDATE current_medication
                SET status     = %s,
                    end_date   = COALESCE(%s, end_date),
                    notes      = COALESCE(%s, notes),
                    updated_at = NOW()
                WHERE current_medication_id = %s
                RETURNING current_medication_id, status, start_date, end_date, notes
                """,
                (norm_status, parsed_end.isoformat() if parsed_end else None, notes, current_medication_id),
            )
            updated = cur.fetchone()

    return {
        "success": True,
        "message": f"Medication marked as {norm_status}.",
        "medication": dict(updated),
    }

