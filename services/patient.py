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

    Returns None if the prescription does not exist or belongs to someone else.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # Verify ownership
            cur.execute(
                """
                SELECT rx.prescription_id
                FROM prescription rx
                JOIN patient pt ON pt.patient_id = rx.patient_id
                WHERE rx.prescription_id = %s AND pt.user_id = %s
                """,
                (prescription_id, patient_user_id),
            )
            if cur.fetchone() is None:
                return None

            # Prescription header
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
                    ch.phone            AS clinic_phone
                FROM prescription rx
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
                       name, dosage, frequency, duration, instructions,
                       created_at AS date
                FROM prescription_medicine
                WHERE prescription_id = %s
                ORDER BY prescription_medicine_id
                """,
                (prescription_id,),
            )
            prescription["medications"] = [dict(r) for r in cur.fetchall()]
            return prescription


def get_patient_stats(patient_user_id: int) -> Dict[str, Any]:
    """Return overview dashboard statistics for a patient (resolved from user_id)."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM prescription WHERE patient_id = pt.patient_id) AS rx_count,
                    (SELECT COUNT(*) FROM patient_doctor WHERE patient_id = pt.patient_id AND status = 'pending') AS pending_requests,
                    (SELECT COUNT(*) FROM patient_share_tokens WHERE patient_id = pt.patient_id AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())) AS active_shares
                FROM patient pt
                WHERE pt.user_id = %s
                """,
                (patient_user_id,),
            )
            row = cur.fetchone()
            if row is None:
                return {"rx_count": 0, "pending_requests": 0, "active_shares": 0}
            return {
                "rx_count": row["rx_count"] or 0,
                "pending_requests": row["pending_requests"] or 0,
                "active_shares": row["active_shares"] or 0,
            }


# =============================================================================
# Doctor connection requests
# =============================================================================

def lookup_doctor(doctor_id: int) -> Optional[Dict[str, Any]]:
    """Look up a doctor by their doctor_id (numeric).

    Returns user_id, email, full_name, specialization, or None if not found.
    Accepts either a doctor.doctor_id or users.user_id for convenience.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT d.doctor_id      AS id,
                       u.user_id,
                       u.email          AS username,
                       u.full_name      AS display_name,
                       d.specialization AS specialty
                FROM doctor d
                JOIN users u ON u.user_id = d.user_id
                WHERE d.doctor_id = %s OR u.user_id = %s
                """,
                (doctor_id, doctor_id),
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
