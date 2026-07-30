"""Database helper layer for user management and schema migrations.

Provides SQLite connection lifecycle helpers, idempotent migrations,
and CRUD operations for User accounts.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator
import bcrypt

VALID_ROLES = {"patient", "doctor"}


def get_db_path() -> Path:
    """Return the absolute path to the SQLite database file."""
    return Path(__file__).parent / "prescriptions.db"


@contextmanager
def db_connection(row_factory: bool = False) -> Generator[sqlite3.Connection, None, None]:
    """Context manager for SQLite database connections.

    Automatically handles commits on success, rollbacks on error, and ensures
    the connection is closed on exit.

    Args:
        row_factory: If True, set conn.row_factory to sqlite3.Row for dict-like access.
    """
    conn = sqlite3.connect(get_db_path())
    if row_factory:
        conn.row_factory = sqlite3.Row
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def run_migrations() -> None:
    """Consolidated idempotent migration runner.

    Creates all database tables and adds missing columns if they don't exist.
    """
    with db_connection() as conn:
        cursor = conn.cursor()

        # ── 1. Ensure 'users' table exists ───────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role          TEXT NOT NULL DEFAULT 'patient',
                display_name  TEXT,
                specialty     TEXT
            )
        """)

        # ── 2. Handle incremental columns for 'users' ────────────────────────
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]

        if "role" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'patient'")
            print("[DB] 'role' column added to users table.")

        if "display_name" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
            print("[DB] 'display_name' column added to users table.")

        if "specialty" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN specialty TEXT")
            print("[DB] 'specialty' column added to users table.")

        # ── 3. Ensure 'doctor_patient_assignments' table exists ──────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS doctor_patient_assignments (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id   INTEGER NOT NULL REFERENCES users(id),
                patient_id  INTEGER NOT NULL REFERENCES users(id),
                assigned_at TEXT    NOT NULL DEFAULT (datetime('now')),
                status      TEXT    NOT NULL DEFAULT 'active',
                UNIQUE(doctor_id, patient_id)
            )
        """)
        print("[DB] 'doctor_patient_assignments' table ensured.")

        # ── 4. Ensure 'patient_doctor_requests' table exists ─────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patient_doctor_requests (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id   INTEGER NOT NULL REFERENCES users(id),
                doctor_id    INTEGER NOT NULL REFERENCES users(id),
                requested_at TEXT    NOT NULL DEFAULT (datetime('now')),
                status       TEXT    NOT NULL DEFAULT 'pending',
                UNIQUE(patient_id, doctor_id)
            )
        """)
        print("[DB] 'patient_doctor_requests' table ensured.")

        # ── 5. Ensure 'patient_share_tokens' table exists ────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patient_share_tokens (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id  INTEGER NOT NULL REFERENCES users(id),
                token       TEXT    UNIQUE NOT NULL,
                label       TEXT,
                expires_at  TEXT,
                is_active   INTEGER NOT NULL DEFAULT 1,
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            )
        """)
        print("[DB] 'patient_share_tokens' table ensured.")

        # ── 6. Ensure 'messages' table exists ───────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id    INTEGER NOT NULL REFERENCES users(id),
                receiver_id  INTEGER NOT NULL REFERENCES users(id),
                body         TEXT    NOT NULL,
                sent_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                is_read      INTEGER NOT NULL DEFAULT 0,
                message_type TEXT    NOT NULL DEFAULT 'text',
                scheduled_at TEXT
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_conversation
            ON messages (sender_id, receiver_id)
        """)
        print("[DB] 'messages' table ensured.")

        # ── 6a. Add message_type / scheduled_at columns if missing (existing DBs) ─
        cursor.execute("PRAGMA table_info(messages)")
        msg_columns = [col[1] for col in cursor.fetchall()]
        if "message_type" not in msg_columns:
            cursor.execute(
                "ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text'"
            )
            print("[DB] 'message_type' column added to messages table.")
        if "scheduled_at" not in msg_columns:
            cursor.execute(
                "ALTER TABLE messages ADD COLUMN scheduled_at TEXT"
            )
            print("[DB] 'scheduled_at' column added to messages table.")

        # ── 7. Ensure 'video_call_sessions' table exists ─────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS video_call_sessions (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                room_name    TEXT    UNIQUE NOT NULL,
                doctor_id    INTEGER NOT NULL REFERENCES users(id),
                patient_id   INTEGER NOT NULL REFERENCES users(id),
                scheduled_at TEXT    NOT NULL,
                status       TEXT    NOT NULL DEFAULT 'scheduled',
                created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
            )
        """)
        print("[DB] 'video_call_sessions' table ensured.")


# ── Deprecated Individual Migration Wrappers for Backward Compatibility ──────

def migrate_add_role_column() -> None:
    """Wrapper calling consolidated run_migrations()."""
    run_migrations()


def migrate_add_doctor_profile_columns() -> None:
    """Wrapper calling consolidated run_migrations()."""
    run_migrations()


def migrate_add_doctor_patient_assignments() -> None:
    """Wrapper calling consolidated run_migrations()."""
    run_migrations()


def migrate_add_patient_doctor_requests() -> None:
    """Wrapper calling consolidated run_migrations()."""
    run_migrations()


# ── Password Hashing Helpers ──────────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain text password against a hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def get_password_hash(password: str) -> str:
    """Generate a bcrypt hash of a plain text password."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# ── User CRUD Actions ─────────────────────────────────────────────────────────

def get_user(username: str) -> dict | None:
    """Fetch a user record (id, username, password_hash, role) or None."""
    try:
        with db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, username, password_hash, role, display_name, specialty 
                FROM users 
                WHERE username = ?
                """,
                (username,),
            )
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "username": row[1],
                    "password_hash": row[2],
                    "role": row[3],
                    "display_name": row[4],
                    "specialty": row[5],
                }
    except Exception as e:
        print(f"[DB] Error fetching user: {e}")
    return None


def get_user_by_id(user_id: int) -> dict | None:
    """Fetch a user record by numeric ID or None."""
    try:
        with db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, username, role, display_name, specialty 
                FROM users 
                WHERE id = ?
                """,
                (user_id,),
            )
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "username": row[1],
                    "role": row[2],
                    "display_name": row[3],
                    "specialty": row[4],
                }
    except Exception as e:
        print(f"[DB] Error fetching user by id: {e}")
    return None


def create_user(username: str, password: str, role: str = "patient") -> dict | None:
    """Create a new user. Returns basic user dict or None if username taken."""
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role '{role}'. Must be one of: {VALID_ROLES}")

    if get_user(username):
        return None  # username already taken

    password_hash = get_password_hash(password)
    try:
        with db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                (username, password_hash, role),
            )
            return {"username": username, "role": role}
    except Exception as e:
        print(f"[DB] Error creating user: {e}")
        return None
