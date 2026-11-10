"""Data access repository for user accounts across all platform roles."""

from __future__ import annotations
from typing import Optional
import psycopg2.extras
from database.db import get_conn
from services.auth.domain import AuthUser


class UserRepository:
    """Encapsulates SQL persistence for platform user identities and roles."""

    def get_by_email(self, email: str) -> Optional[AuthUser]:
        """Fetch general platform user (PATIENT or DOCTOR) by email."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT u.user_id, u.email, u.password_hash, u.role, u.full_name AS display_name,
                           u.status, p.patient_id, p.patient_code, d.doctor_id, d.specialization AS doctor_specialty,
                           disp.dispensary_id
                    FROM users u
                    LEFT JOIN patient p ON p.user_id = u.user_id
                    LEFT JOIN doctor d  ON d.user_id = u.user_id
                    LEFT JOIN dispensary disp ON disp.email = u.email
                    WHERE LOWER(u.email) = LOWER(%s)
                    """,
                    (email.strip(),),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return self._row_to_auth_user(row)

    def get_by_id(self, user_id: int) -> Optional[AuthUser]:
        """Fetch general platform user by internal user_id."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT u.user_id, u.email, u.password_hash, u.role, u.full_name AS display_name,
                           u.status, p.patient_id, p.patient_code, d.doctor_id, d.specialization AS doctor_specialty,
                           disp.dispensary_id
                    FROM users u
                    LEFT JOIN patient p ON p.user_id = u.user_id
                    LEFT JOIN doctor d  ON d.user_id = u.user_id
                    LEFT JOIN dispensary disp ON disp.email = u.email
                    WHERE u.user_id = %s
                    """,
                    (user_id,),
                )
                row = cur.fetchone()
                return self._row_to_auth_user(row) if row else None

    def get_dispensary_by_email(self, email: str) -> Optional[AuthUser]:
        """Fetch organizational dispensary identity by login email."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT dispensary_id, hospital_id, name AS display_name, email,
                           password_hash, status
                    FROM dispensary
                    WHERE LOWER(email) = LOWER(%s)
                    """,
                    (email.strip(),),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return AuthUser(
                    user_id=row["dispensary_id"],
                    email=row["email"],
                    role="DISPENSARY",
                    password_hash=row["password_hash"],
                    status=row.get("status", "ACTIVE"),
                    display_name=row.get("display_name"),
                    dispensary_id=row["dispensary_id"],
                    hospital_id=row.get("hospital_id"),
                )

    def get_hospital_by_email(self, email: str) -> Optional[AuthUser]:
        """Fetch organizational hospital identity by login email."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT hospital_id, name AS display_name, email, password_hash, status
                    FROM hospital
                    WHERE LOWER(email) = LOWER(%s)
                    """,
                    (email.strip(),),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return AuthUser(
                    user_id=row["hospital_id"],
                    email=row["email"],
                    role="HOSPITAL",
                    password_hash=row["password_hash"],
                    status=row.get("status", "ACTIVE"),
                    display_name=row.get("display_name"),
                    hospital_id=row["hospital_id"],
                )

    def create_user(self, email: str, password_hash: str, role: str, full_name: Optional[str] = None) -> Optional[AuthUser]:
        """Insert new user and matching role profile row. Returns AuthUser on success, None if email taken."""
        pg_role = role.upper()
        if pg_role not in {"PATIENT", "DOCTOR"}:
            raise ValueError(f"Invalid registration role: {role}")

        if self.get_by_email(email):
            return None

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO users (email, password_hash, role, full_name)
                    VALUES (%s, %s, %s, %s)
                    RETURNING user_id, email, role, full_name, status
                    """,
                    (email.strip(), password_hash, pg_role, full_name or email.split("@")[0]),
                )
                user_row = dict(cur.fetchone())
                uid = user_row["user_id"]

                patient_id, patient_code, doctor_id = None, None, None
                if pg_role == "PATIENT":
                    cur.execute("INSERT INTO patient (user_id) VALUES (%s) RETURNING patient_id, patient_code", (uid,))
                    p_row = cur.fetchone()
                    patient_id = p_row["patient_id"]
                    patient_code = p_row.get("patient_code")
                else:
                    cur.execute("INSERT INTO doctor (user_id) VALUES (%s) RETURNING doctor_id", (uid,))
                    doctor_id = cur.fetchone()["doctor_id"]

                conn.commit()
                return AuthUser(
                    user_id=uid,
                    email=user_row["email"],
                    role=pg_role,
                    password_hash=password_hash,
                    status=user_row.get("status", "ACTIVE"),
                    display_name=user_row.get("full_name"),
                    patient_id=patient_id,
                    patient_code=patient_code,
                    doctor_id=doctor_id,
                )

    @staticmethod
    def _row_to_auth_user(row: dict) -> AuthUser:
        return AuthUser(
            user_id=row["user_id"],
            email=row["email"],
            role=row["role"],
            password_hash=row["password_hash"],
            status=row.get("status", "ACTIVE"),
            display_name=row.get("display_name"),
            patient_id=row.get("patient_id"),
            patient_code=row.get("patient_code"),
            doctor_id=row.get("doctor_id"),
            doctor_specialty=row.get("doctor_specialty"),
            dispensary_id=row.get("dispensary_id"),
        )


default_user_repo = UserRepository()


