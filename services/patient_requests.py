"""Patient-facing service for managing connection requests to doctors.

Allows patients to search for doctors, send requests, and fetch status.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from database.user_database import db_connection


def lookup_doctor(doctor_id: int) -> Optional[Dict[str, Any]]:
    """Look up a doctor by their User ID.

    Only matches user accounts with the 'doctor' role.
    """
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, username, display_name, specialty
            FROM users
            WHERE id = ? AND role = 'doctor'
            """,
            (doctor_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def send_request(patient_id: int, doctor_id: int) -> Dict[str, Any]:
    """Send a connection request from a patient to a doctor.

    Returns:
        A dictionary with keys 'success' (bool) and 'message' (str).
    """
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()

        # ── 1. Confirm target user is a doctor ────────────────────────────────
        cursor.execute(
            "SELECT id FROM users WHERE id = ? AND role = 'doctor'",
            (doctor_id,),
        )
        if cursor.fetchone() is None:
            return {"success": False, "message": "No doctor found with that ID."}

        # ── 2. Check if already active/connected ──────────────────────────────
        cursor.execute(
            """
            SELECT id FROM doctor_patient_assignments
            WHERE doctor_id = ? AND patient_id = ? AND status = 'active'
            """,
            (doctor_id, patient_id),
        )
        if cursor.fetchone():
            return {"success": False, "message": "You are already connected to this doctor."}

        # ── 3. Check for an existing request ──────────────────────────────────
        cursor.execute(
            """
            SELECT id, status FROM patient_doctor_requests
            WHERE patient_id = ? AND doctor_id = ?
            """,
            (patient_id, doctor_id),
        )
        existing = cursor.fetchone()
        if existing:
            if existing["status"] == "pending":
                return {"success": False, "message": "You already have a pending request with this doctor."}
            if existing["status"] == "accepted":
                return {"success": False, "message": "This doctor has already accepted you."}

            # If previously rejected, update status back to pending to allow re-requesting
            cursor.execute(
                "UPDATE patient_doctor_requests SET status = 'pending', requested_at = datetime('now') WHERE id = ?",
                (existing["id"],),
            )
            return {"success": True, "message": "Connection request re-sent successfully."}

        # ── 4. Insert new request ─────────────────────────────────────────────
        cursor.execute(
            "INSERT INTO patient_doctor_requests (patient_id, doctor_id) VALUES (?, ?)",
            (patient_id, doctor_id),
        )
        return {"success": True, "message": "Connection request sent! Waiting for doctor to accept."}


def get_my_requests(patient_id: int) -> List[Dict[str, Any]]:
    """Return all connection requests sent by this patient, with doctor details."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                r.id,
                r.doctor_id,
                r.requested_at,
                r.status,
                u.username      AS doctor_username,
                u.display_name  AS doctor_display_name,
                u.specialty     AS doctor_specialty
            FROM patient_doctor_requests r
            JOIN users u ON u.id = r.doctor_id
            WHERE r.patient_id = ?
            ORDER BY r.requested_at DESC
            """,
            (patient_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def get_my_assigned_doctor(patient_id: int) -> Optional[Dict[str, Any]]:
    """Return the active doctor currently assigned to this patient (if any)."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                u.id,
                u.username,
                u.display_name,
                u.specialty,
                dpa.assigned_at
            FROM doctor_patient_assignments dpa
            JOIN users u ON u.id = dpa.doctor_id
            WHERE dpa.patient_id = ? AND dpa.status = 'active'
            ORDER BY dpa.assigned_at DESC
            LIMIT 1
            """,
            (patient_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
