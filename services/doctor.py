"""Doctor-specific database service layer — PostgreSQL version.

All queries are scoped to the logged-in doctor's assigned patients.
Uses the new ER-diagram schema:
  - patient_doctor    (replaces doctor_patient_assignments + patient_doctor_requests)
  - prescription      (replaces prescriptions)
  - prescription_medicine (replaces prescription_medications)
  - doctor / patient  (separate profile tables)
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn


# ---------------------------------------------------------------------------
# Prescription queries (doctor-scoped)
# ---------------------------------------------------------------------------

def get_my_prescriptions(
    doctor_id: int,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Return paginated prescriptions for patients assigned to this doctor only."""
    params: list = [doctor_id]

    where_extra = ""
    if search:
        where_extra = """
            AND (
                u.full_name     ILIKE %s OR
                rx.diagnosis    ILIKE %s OR
                ch.name         ILIKE %s
            )
        """
        pattern = f"%{search}%"
        params.extend([pattern, pattern, pattern])

    query = f"""
        SELECT
            rx.prescription_id          AS id,
            u.full_name                 AS patient_name,
            u.user_id                   AS patient_user_id,
            u.email                     AS uploaded_by,
            ch.name                     AS clinic_name,
            rx.diagnosis,
            rx.issue_date,
            rx.follow_up_date,
            rx.notes
        FROM prescription rx
        JOIN patient        pt  ON pt.patient_id  = rx.patient_id
        JOIN users          u   ON u.user_id       = pt.user_id
        JOIN patient_doctor pd  ON pd.patient_id   = pt.patient_id
                                AND pd.doctor_id    = %s
                                AND pd.status       = 'active'
        LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
        {where_extra}
        ORDER BY rx.prescription_id DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            return [dict(row) for row in cur.fetchall()]


def get_my_prescription_detail(
    doctor_id: int, prescription_id: int
) -> Optional[Dict[str, Any]]:
    """Return full prescription detail only if the doctor is assigned to that patient."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # Verify access
            cur.execute(
                """
                SELECT rx.prescription_id
                FROM prescription rx
                JOIN patient        pt  ON pt.patient_id = rx.patient_id
                JOIN patient_doctor pd  ON pd.patient_id = pt.patient_id
                                       AND pd.doctor_id  = %s
                                       AND pd.status     = 'active'
                WHERE rx.prescription_id = %s
                """,
                (doctor_id, prescription_id),
            )
            if cur.fetchone() is None:
                return None

            # Prescription header
            cur.execute(
                """
                SELECT
                    rx.prescription_id  AS id,
                    u.full_name         AS patient_name,
                    u.user_id,
                    u.email             AS uploaded_by,
                    ch.name             AS clinic_name,
                    ch.address          AS clinic_address,
                    ch.phone            AS clinic_phone,
                    rx.diagnosis,
                    rx.issue_date,
                    rx.follow_up_date,
                    rx.notes,
                    rx.raw_text
                FROM prescription rx
                JOIN patient      pt ON pt.patient_id = rx.patient_id
                JOIN users        u  ON u.user_id     = pt.user_id
                LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
                WHERE rx.prescription_id = %s
                """,
                (prescription_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None

            prescription = dict(row)

            # Medications
            cur.execute(
                """
                SELECT prescription_medicine_id AS id,
                       name, dosage, frequency, duration, instructions, created_at AS date
                FROM prescription_medicine
                WHERE prescription_id = %s
                ORDER BY prescription_medicine_id
                """,
                (prescription_id,),
            )
            prescription["medications"] = [dict(r) for r in cur.fetchall()]
            return prescription


def get_my_patients(doctor_id: int) -> List[Dict[str, Any]]:
    """Return summary of all patients assigned to this doctor."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    u.user_id               AS id,
                    u.email                 AS username,
                    u.full_name             AS display_name,
                    pd.created_at           AS assigned_at,
                    COUNT(rx.prescription_id) AS prescription_count
                FROM patient_doctor pd
                JOIN patient  pt ON pt.patient_id = pd.patient_id
                JOIN users    u  ON u.user_id      = pt.user_id
                LEFT JOIN prescription rx ON rx.patient_id = pt.patient_id
                WHERE pd.doctor_id = %s AND pd.status = 'active'
                GROUP BY u.user_id, u.email, u.full_name, pd.created_at
                ORDER BY pd.created_at DESC
                """,
                (doctor_id,),
            )
            return [dict(row) for row in cur.fetchall()]


def get_patient_prescriptions_scoped(
    doctor_id: int, patient_user_id: int
) -> List[Dict[str, Any]]:
    """All prescriptions for a specific assigned patient (full detail)."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # Verify assignment
            cur.execute(
                """
                SELECT pd.patient_doctor_id
                FROM patient_doctor pd
                JOIN patient pt ON pt.patient_id = pd.patient_id
                WHERE pd.doctor_id = %s AND pt.user_id = %s AND pd.status = 'active'
                """,
                (doctor_id, patient_user_id),
            )
            if cur.fetchone() is None:
                return []

            # Get prescription IDs
            cur.execute(
                """
                SELECT rx.prescription_id
                FROM prescription rx
                JOIN patient pt ON pt.patient_id = rx.patient_id
                WHERE pt.user_id = %s
                ORDER BY rx.prescription_id DESC
                """,
                (patient_user_id,),
            )
            ids = [row["prescription_id"] for row in cur.fetchall()]

    return [
        detail
        for pid in ids
        if (detail := get_my_prescription_detail(doctor_id, pid)) is not None
    ]


def get_doctor_stats(doctor_id: int) -> Dict[str, Any]:
    """Return dashboard statistics for the logged-in doctor in a single query."""
    today = datetime.now().date()
    week_ahead = today + timedelta(days=7)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM patient_doctor WHERE doctor_id = %s AND status = 'active') AS patient_count,
                    (SELECT COUNT(*) FROM prescription rx
                     JOIN patient pt ON pt.patient_id = rx.patient_id
                     JOIN patient_doctor pd ON pd.patient_id = pt.patient_id AND pd.doctor_id = %s AND pd.status = 'active') AS rx_count,
                    (SELECT COUNT(*) FROM patient_doctor WHERE doctor_id = %s AND status = 'pending') AS pending_requests,
                    (SELECT COUNT(*) FROM prescription rx
                     JOIN patient pt ON pt.patient_id = rx.patient_id
                     JOIN patient_doctor pd ON pd.patient_id = pt.patient_id AND pd.doctor_id = %s AND pd.status = 'active'
                     WHERE rx.follow_up_date >= %s AND rx.follow_up_date <= %s) AS upcoming_followups
                """,
                (doctor_id, doctor_id, doctor_id, doctor_id, today, week_ahead),
            )
            row = cur.fetchone()
            if row is None:
                return {
                    "patient_count": 0,
                    "rx_count": 0,
                    "pending_requests": 0,
                    "upcoming_followups": 0,
                }
            return {
                "patient_count": row["patient_count"] or 0,
                "rx_count": row["rx_count"] or 0,
                "pending_requests": row["pending_requests"] or 0,
                "upcoming_followups": row["upcoming_followups"] or 0,
            }


# ---------------------------------------------------------------------------
# Connection requests
# ---------------------------------------------------------------------------

def get_pending_requests(doctor_id: int) -> List[Dict[str, Any]]:
    """Return all pending patient connection requests for this doctor."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    pd.patient_doctor_id        AS id,
                    pt.patient_id,
                    pd.created_at               AS requested_at,
                    pd.status,
                    u.email                     AS patient_username,
                    u.full_name                 AS patient_display_name,
                    COUNT(rx.prescription_id)   AS prescription_count
                FROM patient_doctor pd
                JOIN patient  pt ON pt.patient_id  = pd.patient_id
                JOIN users    u  ON u.user_id       = pt.user_id
                LEFT JOIN prescription rx ON rx.patient_id = pt.patient_id
                WHERE pd.doctor_id = %s AND pd.status = 'pending'
                GROUP BY pd.patient_doctor_id, pt.patient_id, pd.created_at, pd.status,
                         u.email, u.full_name
                ORDER BY pd.created_at DESC
                """,
                (doctor_id,),
            )
            return [dict(row) for row in cur.fetchall()]


def respond_to_request(doctor_id: int, request_id: int, accept: bool) -> bool:
    """Accept or reject a patient's connection request."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # Verify ownership and pending status
            cur.execute(
                """
                SELECT patient_id FROM patient_doctor
                WHERE patient_doctor_id = %s AND doctor_id = %s AND status = 'pending'
                """,
                (request_id, doctor_id),
            )
            row = cur.fetchone()
            if row is None:
                return False

            new_status = "active" if accept else "rejected"
            cur.execute(
                "UPDATE patient_doctor SET status = %s WHERE patient_doctor_id = %s",
                (new_status, request_id),
            )
            return True


def update_doctor_profile(
    doctor_id: int,
    display_name: Optional[str],
    specialty: Optional[str],
) -> bool:
    """Update the doctor's full_name (in users) and specialization (in doctor)."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Get user_id from doctor table
            cur.execute(
                "SELECT user_id FROM doctor WHERE doctor_id = %s", (doctor_id,)
            )
            row = cur.fetchone()
            if row is None:
                return False
            user_id = row[0]

            if display_name is not None:
                cur.execute(
                    "UPDATE users SET full_name = %s WHERE user_id = %s",
                    (display_name, user_id),
                )
            if specialty is not None:
                cur.execute(
                    "UPDATE doctor SET specialization = %s WHERE doctor_id = %s",
                    (specialty, doctor_id),
                )
            return True


def lookup_patient_by_code_for_doctor(doctor_id: int, patient_code: str) -> Optional[Dict[str, Any]]:
    """Look up patient by public patient_code and check relationship with this doctor."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT pt.patient_id,
                       pt.patient_code,
                       pt.date_of_birth,
                       pt.blood_group,
                       u.user_id,
                       u.full_name,
                       u.email,
                       pd.status AS connection_status,
                       pd.patient_doctor_id,
                       pd.created_at AS connected_at
                FROM patient pt
                JOIN users u ON u.user_id = pt.user_id
                LEFT JOIN patient_doctor pd ON pd.patient_id = pt.patient_id AND pd.doctor_id = %s
                WHERE UPPER(pt.patient_code) = %s
                """,
                (doctor_id, patient_code.strip().upper()),
            )
            row = cur.fetchone()
            if not row:
                return None
            res = dict(row)
            # Count prescriptions
            cur.execute("SELECT COUNT(*) AS total_rx FROM prescription WHERE patient_id = %s", (res["patient_id"],))
            rx_row = cur.fetchone()
            res["total_prescriptions"] = rx_row["total_rx"] if rx_row else 0
            if res.get("date_of_birth"):
                res["date_of_birth"] = str(res["date_of_birth"])
            if res.get("connected_at"):
                res["connected_at"] = str(res["connected_at"])
            return res


def doctor_connect_patient(doctor_id: int, patient_code: str) -> Dict[str, Any]:
    """Connect doctor directly with patient via patient_code."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT patient_id, patient_code FROM patient WHERE UPPER(patient_code) = %s",
                (patient_code.strip().upper(),),
            )
            pt = cur.fetchone()
            if not pt:
                return {"success": False, "message": f"Patient with code {patient_code} not found."}
            patient_id = pt["patient_id"]

            cur.execute(
                "SELECT patient_doctor_id, status FROM patient_doctor WHERE patient_id = %s AND doctor_id = %s",
                (patient_id, doctor_id),
            )
            existing = cur.fetchone()
            if existing:
                if existing["status"] == "active":
                    return {"success": True, "message": "Already connected to this patient.", "status": "active"}
                cur.execute(
                    "UPDATE patient_doctor SET status = 'active', created_at = NOW() WHERE patient_doctor_id = %s",
                    (existing["patient_doctor_id"],),
                )
                return {"success": True, "message": "Patient connected successfully!", "status": "active"}

            cur.execute(
                """
                INSERT INTO patient_doctor (patient_id, doctor_id, relationship_type, status)
                VALUES (%s, %s, 'CONSULTING', 'active')
                """,
                (patient_id, doctor_id),
            )
            return {"success": True, "message": "Patient connected to your care directory!", "status": "active"}

