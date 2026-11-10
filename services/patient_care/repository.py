"""Patient Care Repository — SQL Data Access for Patient & Adherence Records."""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional

import psycopg2.extras
from database.db import get_conn

logger = logging.getLogger(__name__)


class PatientRepository:
    """Manages transactional queries for patient prescriptions, doctors, and adherence records."""

    def get_patient_id_by_user_id(self, user_id: int) -> Optional[int]:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
                return row[0] if row else None

    def get_prescriptions_by_user(self, patient_user_id: int) -> List[Dict[str, Any]]:
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

    def get_prescription_detail(self, patient_user_id: int, prescription_id: int) -> Optional[Dict[str, Any]]:
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

    def get_patient_stats(self, patient_user_id: int) -> Dict[str, Any]:
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

    def lookup_doctor(self, doctor_id: int) -> Optional[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT d.doctor_id AS id,
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

    def send_doctor_request(self, patient_user_id: int, doctor_id: int) -> Dict[str, Any]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (patient_user_id,))
                row = cur.fetchone()
                if row is None:
                    return {"success": False, "message": "Patient profile not found."}
                patient_id = row["patient_id"]

                cur.execute("SELECT doctor_id FROM doctor WHERE doctor_id = %s", (doctor_id,))
                if cur.fetchone() is None:
                    return {"success": False, "message": "No doctor found with that ID."}

                cur.execute(
                    "SELECT patient_doctor_id, status FROM patient_doctor WHERE patient_id = %s AND doctor_id = %s",
                    (patient_id, doctor_id),
                )
                existing = cur.fetchone()
                if existing:
                    if existing["status"] == "pending":
                        return {"success": False, "message": "You already have a pending request with this doctor."}
                    if existing["status"] == "active":
                        return {"success": False, "message": "You are already connected to this doctor."}

                    cur.execute(
                        "UPDATE patient_doctor SET status = 'pending', created_at = NOW() WHERE patient_doctor_id = %s",
                        (existing["patient_doctor_id"],),
                    )
                    return {"success": True, "message": "Connection request re-sent successfully."}

                cur.execute(
                    "INSERT INTO patient_doctor (patient_id, doctor_id, status) VALUES (%s, %s, 'pending')",
                    (patient_id, doctor_id),
                )
                return {"success": True, "message": "Connection request sent! Waiting for doctor to accept."}

    def get_my_requests(self, patient_user_id: int) -> List[Dict[str, Any]]:
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

    def get_assigned_doctor(self, patient_user_id: int) -> Optional[Dict[str, Any]]:
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


default_patient_repo = PatientRepository()

