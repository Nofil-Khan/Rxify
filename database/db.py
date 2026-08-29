"""PostgreSQL connection manager for Rxify.

Replaces the old SQLite user_database.py. Provides:
- get_conn()    : context manager for a psycopg2 connection
- get_cursor()  : context manager yielding a RealDictCursor (dict-like rows)
- init_db()     : idempotent schema runner — call once at startup
- User CRUD helpers used by core/security.py and routers/auth.py
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, Optional

import bcrypt
import psycopg2
import psycopg2.extras
import psycopg2.pool
from psycopg2.extensions import connection as PgConn

# ---------------------------------------------------------------------------
# Connection string & Pooling — read from DATABASE_URL env var
# ---------------------------------------------------------------------------

def _get_dsn() -> str:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Add it to your .env file, e.g.:\n"
            "  DATABASE_URL=postgresql://postgres:password@localhost:5432/rxify"
        )
    return dsn


_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None   #private variable


def get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=20,
            dsn=_get_dsn(),
        )
    return _pool


# ---------------------------------------------------------------------------
# Context managers
# ---------------------------------------------------------------------------

@contextmanager
def get_conn() -> Generator[PgConn, None, None]:
    """Yield a pooled psycopg2 connection that auto-commits on success or rolls back on error."""
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


@contextmanager
def get_cursor(
    conn: Optional[PgConn] = None,
) -> Generator[psycopg2.extras.RealDictCursor, None, None]:
    """Yield a RealDictCursor (rows accessible as dicts).

    If a connection is supplied, use it (caller manages lifecycle).
    Otherwise open and close a fresh connection automatically.
    """
    if conn is not None:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            yield cur
        finally:
            cur.close()
    else:
        with get_conn() as _conn:
            cur = _conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            try:
                yield cur
            finally:
                cur.close()


# ---------------------------------------------------------------------------
# Schema initialisation
# ---------------------------------------------------------------------------

def _ensure_hospital_schema(conn: PgConn) -> None:
    """Run incremental migrations for the hospital module and schema fixes on existing databases."""
    with conn.cursor() as cur:
        # Ensure column nullability fixes for prescription tables
        cur.execute("ALTER TABLE prescription ALTER COLUMN doctor_id DROP NOT NULL;")
        cur.execute("ALTER TABLE prescription ALTER COLUMN issue_date DROP NOT NULL;")
        cur.execute("ALTER TABLE prescription ALTER COLUMN follow_up_date DROP NOT NULL;")
        cur.execute("ALTER TABLE prescription_medicine ALTER COLUMN medicine_id DROP NOT NULL;")

        # Check if hospital table exists
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hospital');")
        if not cur.fetchone()[0]:
            print("[DB] Applying Hospital Module migration...")
            hospital_sql = """
            CREATE TABLE IF NOT EXISTS audit_log (
                log_id      SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(user_id),
                action      TEXT NOT NULL,
                entity_type TEXT,
                entity_id   INTEGER,
                details     TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS hospital (
                hospital_id         SERIAL PRIMARY KEY,
                name                TEXT NOT NULL,
                email               TEXT UNIQUE NOT NULL,
                password_hash       TEXT NOT NULL,
                phone               TEXT,
                address             TEXT,
                city                TEXT,
                state               TEXT,
                registration_number TEXT UNIQUE,
                status              TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            ALTER TABLE patient ADD COLUMN IF NOT EXISTS patient_code TEXT UNIQUE;
            ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospital(hospital_id);

            CREATE OR REPLACE FUNCTION generate_patient_code() RETURNS TRIGGER AS $$
            DECLARE
                new_code TEXT;
                chars    TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                i        INT;
                attempts INT := 0;
            BEGIN
                IF NEW.patient_code IS NULL THEN
                    LOOP
                        new_code := 'RXF-P-';
                        FOR i IN 1..5 LOOP
                            new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
                        END LOOP;
                        PERFORM 1 FROM patient WHERE patient_code = new_code;
                        IF NOT FOUND THEN
                            NEW.patient_code := new_code;
                            RETURN NEW;
                        END IF;
                        attempts := attempts + 1;
                        IF attempts > 100 THEN
                            RAISE EXCEPTION 'Could not generate unique patient_code after 100 attempts';
                        END IF;
                    END LOOP;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_generate_patient_code ON patient;
            CREATE TRIGGER trg_generate_patient_code
                BEFORE INSERT OR UPDATE ON patient
                FOR EACH ROW
                EXECUTE FUNCTION generate_patient_code();

            CREATE INDEX IF NOT EXISTS idx_hospital_email          ON hospital(email);
            CREATE INDEX IF NOT EXISTS idx_patient_code            ON patient(patient_code);
            CREATE INDEX IF NOT EXISTS idx_audit_log_hospital_id   ON audit_log(hospital_id);
            """
            cur.execute(hospital_sql)
            
            # Backfill existing patients with patient_code (trigger handles the actual code generation)
            cur.execute("UPDATE patient SET patient_code = NULL WHERE patient_code IS NULL;")
            print("[DB] Hospital Module migration complete.")

def init_db() -> None:
    """Run the full idempotent schema migration from database/schema.sql if needed."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');")
            exists = cur.fetchone()[0]
            if exists:
                print("[DB] PostgreSQL schema already initialised.")
                _ensure_hospital_schema(conn)
                return

    schema_path = Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            # Ensure backfill is run for new setups as well, though usually not needed
            cur.execute("UPDATE patient SET patient_code = NULL WHERE patient_code IS NULL;")
    print("[DB] PostgreSQL schema initialised (all tables ensured).")


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Fetch a user by email (login key). Returns None if not found."""
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                """
                SELECT u.user_id AS id,
                       u.email   AS username,
                       u.password_hash,
                       u.role,
                       u.full_name AS display_name,
                       u.status,
                       p.patient_id,
                       d.doctor_id,
                       d.specialization AS specialty
                FROM   users u
                LEFT JOIN patient p ON p.user_id = u.user_id
                LEFT JOIN doctor  d ON d.user_id = u.user_id
                WHERE  u.email = %s
                """,
                (email,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Fetch a user by numeric user_id. Returns None if not found."""
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                """
                SELECT u.user_id AS id,
                       u.email   AS username,
                       u.role,
                       u.full_name AS display_name,
                       u.status,
                       p.patient_id,
                       d.doctor_id,
                       d.specialization AS specialty
                FROM   users u
                LEFT JOIN patient p ON p.user_id = u.user_id
                LEFT JOIN doctor  d ON d.user_id = u.user_id
                WHERE  u.user_id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def create_user(
    email: str,
    password: str,
    role: str = "PATIENT",
    full_name: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Create a new user + matching patient or doctor profile row.

    Returns a user dict on success, or None if the email is already taken.
    """
    pg_role = role.upper()
    if pg_role not in {"PATIENT", "DOCTOR" , "DISPENSARY"}:
        raise ValueError(f"Invalid role '{role}'. Must be PATIENT, DOCTOR, or DISPENSARY.")

    if get_user_by_email(email):
        return None  # email already taken

    password_hash = get_password_hash(password)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Insert into users
            cur.execute(
                """
                INSERT INTO users (email, password_hash, role, full_name)
                VALUES (%s, %s, %s, %s)
                RETURNING user_id, email, role, full_name
                """,
                (email, password_hash, pg_role, full_name or email.split("@")[0]),
            )
            user_row = dict(cur.fetchone())
            uid = user_row["user_id"]

            # Insert profile row
            if pg_role == "PATIENT":
                cur.execute(
                    "INSERT INTO patient (user_id) VALUES (%s) RETURNING patient_id",
                    (uid,),
                )
                user_row["patient_id"] = cur.fetchone()["patient_id"]
                user_row["doctor_id"] = None
            elif pg_role == "DOCTOR":
                cur.execute(
                    "INSERT INTO doctor (user_id) VALUES (%s) RETURNING doctor_id",
                    (uid,),
                )
                user_row["doctor_id"] = cur.fetchone()["doctor_id"]
                user_row["patient_id"] = None
            else:
                cur.execute(
                    "INSERT INTO inventory_dispensary_stock (user_id) VALUES (%s) RETURNING dispensary_id",
                    (uid,),
                )

    user_row["id"] = user_row["user_id"]
    user_row["username"] = user_row["email"]
    return user_row


# ---------------------------------------------------------------------------
# Backward-compat shim (used by security.py via old import path)
# ---------------------------------------------------------------------------

# These are imported as: from database import user_database
# We keep the old names working so security.py needs minimal changes.
get_user = get_user_by_email
