"""Doctor-specific database service layer.

All queries here are strictly scoped to the logged-in doctor's assigned patients.
Patients who have not sent a request, or whose request was not accepted/active,
are completely invisible to any doctor.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from database.user_database import db_connection


def get_my_prescriptions(
    doctor_id: int,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Return paginated prescriptions for patients assigned to this doctor only."""
    query = """
        SELECT
            p.id,
            p.patient_name,
            p.patient_age,
            p.patient_gender,
            p.doctor_name,
            p.clinic_name,
            p.diagnosis,
            p.issue_date,
            p.follow_up_date,
            u.username AS uploaded_by,
            u.id       AS patient_user_id
        FROM prescriptions p
        JOIN users u ON p.user_id = u.id
        JOIN doctor_patient_assignments dpa
            ON dpa.patient_id = u.id
           AND dpa.doctor_id  = ?
           AND dpa.status     = 'active'
    """
    params: list = [doctor_id]

    if search:
        query += """
        WHERE (
            p.patient_name LIKE ? OR
            p.diagnosis    LIKE ? OR
            p.doctor_name  LIKE ? OR
            p.clinic_name  LIKE ?
        )
        """
        pattern = f"%{search}%"
        params.extend([pattern, pattern, pattern, pattern])

    query += " ORDER BY p.id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def get_my_prescription_detail(
    doctor_id: int, prescription_id: int
) -> Optional[Dict[str, Any]]:
    """Return full prescription detail only if the doctor is assigned to that patient."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()

        # ── 1. Verify access: doctor must be assigned to this patient ────────
        cursor.execute(
            """
            SELECT p.id FROM prescriptions p
            JOIN doctor_patient_assignments dpa
                ON dpa.patient_id = p.user_id
               AND dpa.doctor_id  = ?
               AND dpa.status     = 'active'
            WHERE p.id = ?
            """,
            (doctor_id, prescription_id),
        )
        if cursor.fetchone() is None:
            return None  # not found or not assigned

        # ── 2. Fetch prescription header ─────────────────────────────────────
        cursor.execute(
            """
            SELECT
                p.id,
                p.patient_name,
                p.patient_age,
                p.patient_gender,
                p.doctor_name,
                p.clinic_name,
                p.clinic_address,
                p.clinic_phone,
                p.diagnosis,
                p.issue_date,
                p.follow_up_date,
                p.notes,
                p.raw_text,
                u.username AS uploaded_by,
                u.id       AS user_id
            FROM prescriptions p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
            """,
            (prescription_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return None

        prescription = dict(row)

        # ── 3. Fetch medications ─────────────────────────────────────────────
        cursor.execute(
            """
            SELECT id, name, dosage, frequency, duration, instructions, date
            FROM prescription_medications
            WHERE prescription_id = ?
            ORDER BY id
            """,
            (prescription_id,),
        )
        prescription["medications"] = [dict(r) for r in cursor.fetchall()]
        return prescription


def get_my_patients(doctor_id: int) -> List[Dict[str, Any]]:
    """Return summary of all patients assigned to this doctor."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                u.id,
                u.username,
                u.display_name,
                dpa.assigned_at,
                COUNT(p.id) AS prescription_count
            FROM doctor_patient_assignments dpa
            JOIN users u ON u.id = dpa.patient_id
            LEFT JOIN prescriptions p ON p.user_id = u.id
            WHERE dpa.doctor_id = ? AND dpa.status = 'active'
            GROUP BY u.id, u.username, u.display_name, dpa.assigned_at
            ORDER BY dpa.assigned_at DESC
            """,
            (doctor_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def get_patient_prescriptions_scoped(
    doctor_id: int, patient_user_id: int
) -> List[Dict[str, Any]]:
    """All prescriptions for a specific assigned patient (full detail)."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()

        # ── 1. Verify assignment ─────────────────────────────────────────────
        cursor.execute(
            """
            SELECT id FROM doctor_patient_assignments
            WHERE doctor_id = ? AND patient_id = ? AND status = 'active'
            """,
            (doctor_id, patient_user_id),
        )
        if cursor.fetchone() is None:
            return []

        # ── 2. Get prescription IDs ──────────────────────────────────────────
        cursor.execute(
            "SELECT id FROM prescriptions WHERE user_id = ? ORDER BY id DESC",
            (patient_user_id,),
        )
        ids = [row["id"] for row in cursor.fetchall()]

    # ── 3. Populate detailed prescriptions ──────────────────────────────────
    return [
        detail
        for pid in ids
        if (detail := get_my_prescription_detail(doctor_id, pid)) is not None
    ]


def get_doctor_stats(doctor_id: int) -> Dict[str, Any]:
    """Return dashboard statistics for the logged-in doctor."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()

        # ── 1. Assigned patients count ────────────────────────────────────────
        cursor.execute(
            "SELECT COUNT(*) FROM doctor_patient_assignments WHERE doctor_id = ? AND status = 'active'",
            (doctor_id,),
        )
        patient_count = cursor.fetchone()[0]

        # ── 2. Total prescriptions across assigned patients ───────────────────
        cursor.execute(
            """
            SELECT COUNT(*) FROM prescriptions p
            JOIN doctor_patient_assignments dpa
                ON dpa.patient_id = p.user_id
               AND dpa.doctor_id  = ?
               AND dpa.status     = 'active'
            """,
            (doctor_id,),
        )
        rx_count = cursor.fetchone()[0]

        # ── 3. Pending connection requests ────────────────────────────────────
        cursor.execute(
            "SELECT COUNT(*) FROM patient_doctor_requests WHERE doctor_id = ? AND status = 'pending'",
            (doctor_id,),
        )
        pending_requests = cursor.fetchone()[0]

        # ── 4. Upcoming follow-ups in next 7 days ─────────────────────────────
        today = datetime.now().date().isoformat()
        week_ahead = (datetime.now().date() + timedelta(days=7)).isoformat()
        cursor.execute(
            """
            SELECT COUNT(*) FROM prescriptions p
            JOIN doctor_patient_assignments dpa
                ON dpa.patient_id = p.user_id
               AND dpa.doctor_id  = ?
               AND dpa.status     = 'active'
            WHERE p.follow_up_date >= ? AND p.follow_up_date <= ?
            """,
            (doctor_id, today, week_ahead),
        )
        upcoming_followups = cursor.fetchone()[0]

        return {
            "patient_count": patient_count,
            "rx_count": rx_count,
            "pending_requests": pending_requests,
            "upcoming_followups": upcoming_followups,
        }


def get_pending_requests(doctor_id: int) -> List[Dict[str, Any]]:
    """Return all pending patient connection requests for this doctor."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                r.id,
                r.patient_id,
                r.requested_at,
                r.status,
                u.username    AS patient_username,
                u.display_name AS patient_display_name,
                COUNT(p.id)  AS prescription_count
            FROM patient_doctor_requests r
            JOIN users u ON u.id = r.patient_id
            LEFT JOIN prescriptions p ON p.user_id = r.patient_id
            WHERE r.doctor_id = ? AND r.status = 'pending'
            GROUP BY r.id, r.patient_id, r.requested_at, r.status,
                     u.username, u.display_name
            ORDER BY r.requested_at DESC
            """,
            (doctor_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def respond_to_request(
    doctor_id: int, request_id: int, accept: bool
) -> bool:
    """Accept or reject a patient's connection request.

    If accepted, creates or reactivates a doctor_patient_assignments record.
    """
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()

        # ── 1. Verify this request belongs to this doctor and is still pending ─
        cursor.execute(
            "SELECT patient_id FROM patient_doctor_requests WHERE id = ? AND doctor_id = ? AND status = 'pending'",
            (request_id, doctor_id),
        )
        row = cursor.fetchone()
        if row is None:
            return False

        patient_id = row["patient_id"]
        new_status = "accepted" if accept else "rejected"

        # ── 2. Update request status ──────────────────────────────────────────
        cursor.execute(
            "UPDATE patient_doctor_requests SET status = ? WHERE id = ?",
            (new_status, request_id),
        )

        # ── 3. Insert or reactivate assignment ────────────────────────────────
        if accept:
            cursor.execute(
                """
                INSERT INTO doctor_patient_assignments (doctor_id, patient_id, status)
                VALUES (?, ?, 'active')
                ON CONFLICT(doctor_id, patient_id)
                DO UPDATE SET status = 'active', assigned_at = datetime('now')
                """,
                (doctor_id, patient_id),
            )

        return True


def update_doctor_profile(
    doctor_id: int, display_name: Optional[str], specialty: Optional[str]
) -> bool:
    """Update the doctor's display name and specialty."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET display_name = ?, specialty = ? WHERE id = ?",
            (display_name, specialty, doctor_id),
        )
        return cursor.rowcount > 0
