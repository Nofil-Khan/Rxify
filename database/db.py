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

    # Always ensure hospital_doctor table exists (idempotent)
    _ensure_hospital_doctor_schema(conn)


def _ensure_dispensary_schema(conn: PgConn) -> None:
    """Idempotent migration for the dispensary module.

    Handles existing databases that may have the OLD dispensary staff-profile
    table (with user_id). Migrates to the new design where dispensary is an
    authenticated org entity (like hospital).
    """
    with conn.cursor() as cur:
        # 0. If old dispensary table exists with user_id column, rename it away.
        #    We can't simply DROP since dispensary_request may FK to it.
        #    Safest: rename to _dispensary_staff_legacy if it has user_id column.
        cur.execute(
            """
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'dispensary' AND column_name = 'user_id'
                ) THEN
                    -- Drop FKs that referenced the old table, then rename
                    ALTER TABLE IF EXISTS dispensary_request
                        DROP CONSTRAINT IF EXISTS dispensary_request_fulfilled_by_fkey;
                    ALTER TABLE dispensary RENAME TO _dispensary_staff_legacy;
                END IF;
            END $$;
            """
        )

        # 1. Create new dispensary org table
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS dispensary (
                dispensary_id       SERIAL PRIMARY KEY,
                hospital_id         INTEGER NOT NULL REFERENCES hospital(hospital_id) ON DELETE CASCADE,
                name                TEXT NOT NULL DEFAULT 'Main Dispensary',
                email               TEXT UNIQUE NOT NULL,
                password_hash       TEXT NOT NULL,
                phone               TEXT,
                location            TEXT,
                operating_hours     TEXT,
                avg_prep_minutes    INTEGER NOT NULL DEFAULT 15,
                status              TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_dispensary_hospital_id ON dispensary(hospital_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_dispensary_email ON dispensary(email);")

        # 2. Add new ENUM values to dispensary_status (idempotent)
        for val in ('PROCESSING', 'READY', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'CANCELLED'):
            cur.execute(
                f"""
                DO $$ BEGIN
                    ALTER TYPE dispensary_status ADD VALUE IF NOT EXISTS '{val}';
                EXCEPTION WHEN others THEN NULL; END $$;
                """
            )

        # 3. Create inventory_txn_type ENUM if not exists
        cur.execute(
            """
            DO $$ BEGIN
                CREATE TYPE inventory_txn_type AS ENUM (
                    'STOCK_ADDED', 'STOCK_REMOVED', 'MEDICINE_DISPENSED',
                    'MEDICINE_RESERVED', 'RESERVATION_CANCELLED',
                    'EXPIRED', 'DAMAGED', 'STOCK_ADJUSTMENT'
                );
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
            """
        )

        # 4. Rebuild inventory_dispensary_stock (now references dispensary, not clinic)
        #    If old table has clinic_id column, drop it and recreate.
        cur.execute(
            """
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'inventory_dispensary_stock' AND column_name = 'clinic_id'
                ) THEN
                    DROP TABLE IF EXISTS inventory_dispensary_stock CASCADE;
                END IF;
            END $$;
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS inventory_dispensary_stock (
                inventory_id        SERIAL PRIMARY KEY,
                dispensary_id       INTEGER NOT NULL REFERENCES dispensary(dispensary_id) ON DELETE CASCADE,
                medicine_id         INTEGER NOT NULL REFERENCES medicine(medicine_id) ON DELETE CASCADE,
                available_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
                reserved_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
                reorder_level       INTEGER NOT NULL DEFAULT 10,
                unit                TEXT,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (dispensary_id, medicine_id)
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_inventory_dispensary_id ON inventory_dispensary_stock(dispensary_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_inventory_medicine_id ON inventory_dispensary_stock(medicine_id);")

        # 5. Rebuild dispensary_request (now per-prescription, not per-medicine)
        cur.execute(
            """
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'dispensary_request'
                    AND column_name = 'prescription_medicine_id'
                ) THEN
                    DROP TABLE IF EXISTS dispensary_request CASCADE;
                END IF;
            END $$;
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS dispensary_request (
                request_id          SERIAL PRIMARY KEY,
                prescription_id     INTEGER NOT NULL REFERENCES prescription(prescription_id) ON DELETE CASCADE,
                dispensary_id       INTEGER NOT NULL REFERENCES dispensary(dispensary_id),
                patient_id          INTEGER NOT NULL REFERENCES patient(patient_id),
                status              dispensary_status NOT NULL DEFAULT 'PENDING',
                estimated_ready_at  TIMESTAMPTZ,
                ready_at            TIMESTAMPTZ,
                dispensed_at        TIMESTAMPTZ,
                notes               TEXT,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (prescription_id, dispensary_id)
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_disp_req_dispensary_id ON dispensary_request(dispensary_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_disp_req_prescription_id ON dispensary_request(prescription_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_disp_req_status ON dispensary_request(status);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_disp_req_patient_id ON dispensary_request(patient_id);")

        # 6. Create dispensary_request_item
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS dispensary_request_item (
                item_id                     SERIAL PRIMARY KEY,
                request_id                  INTEGER NOT NULL REFERENCES dispensary_request(request_id) ON DELETE CASCADE,
                prescription_medicine_id    INTEGER NOT NULL REFERENCES prescription_medicine(prescription_medicine_id),
                medicine_id                 INTEGER REFERENCES medicine(medicine_id),
                required_quantity           INTEGER NOT NULL DEFAULT 1,
                dispensed_quantity          INTEGER,
                availability_status         TEXT NOT NULL DEFAULT 'CHECKING',
                reserved                    BOOLEAN NOT NULL DEFAULT FALSE,
                notes                       TEXT,
                created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_disp_req_item_request_id ON dispensary_request_item(request_id);")

        # 7. Create inventory_transaction
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS inventory_transaction (
                txn_id          SERIAL PRIMARY KEY,
                inventory_id    INTEGER NOT NULL REFERENCES inventory_dispensary_stock(inventory_id),
                dispensary_id   INTEGER NOT NULL REFERENCES dispensary(dispensary_id),
                medicine_id     INTEGER NOT NULL REFERENCES medicine(medicine_id),
                txn_type        inventory_txn_type NOT NULL,
                quantity        INTEGER NOT NULL CHECK (quantity > 0),
                reference_id    INTEGER,
                notes           TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_inv_txn_dispensary_id ON inventory_transaction(dispensary_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_inv_txn_inventory_id ON inventory_transaction(inventory_id);")

    print("[DB] Dispensary schema ensured.")


def _ensure_hospital_doctor_schema(conn: PgConn) -> None:
    """Create the hospital_doctor affiliation table if it does not yet exist."""
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS hospital_doctor (
                hospital_doctor_id  SERIAL PRIMARY KEY,
                hospital_id         INTEGER NOT NULL REFERENCES hospital(hospital_id) ON DELETE CASCADE,
                doctor_id           INTEGER NOT NULL REFERENCES doctor(doctor_id)     ON DELETE CASCADE,
                department          TEXT,
                is_active           BOOLEAN NOT NULL DEFAULT TRUE,
                joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (hospital_id, doctor_id)
            );
            CREATE INDEX IF NOT EXISTS idx_hospital_doctor_h ON hospital_doctor(hospital_id);
            CREATE INDEX IF NOT EXISTS idx_hospital_doctor_d ON hospital_doctor(doctor_id);
            """
        )


def init_db() -> None:
    """Run the full idempotent schema migration from database/schema.sql if needed."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');")
            exists = cur.fetchone()[0]
            if exists:
                print("[DB] PostgreSQL schema already initialised.")
                _ensure_hospital_schema(conn)
                _ensure_dispensary_schema(conn)
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
                       p.patient_code,
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
                       p.patient_code,
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
    Note: DISPENSARY role is no longer supported here — dispensaries are
    org-level entities that authenticate separately (like hospital).
    """
    pg_role = role.upper()
    if pg_role not in {"PATIENT", "DOCTOR"}:
        raise ValueError(f"Invalid role '{role}'. Must be PATIENT or DOCTOR.")

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
            else:  # DOCTOR
                cur.execute(
                    "INSERT INTO doctor (user_id) VALUES (%s) RETURNING doctor_id",
                    (uid,),
                )
                user_row["doctor_id"] = cur.fetchone()["doctor_id"]
                user_row["patient_id"] = None

    user_row["id"] = user_row["user_id"]
    user_row["username"] = user_row["email"]
    return user_row


# ---------------------------------------------------------------------------
# Backward-compat shim (used by security.py via old import path)
# ---------------------------------------------------------------------------

# These are imported as: from database import user_database
# We keep the old names working so security.py needs minimal changes.
get_user = get_user_by_email
