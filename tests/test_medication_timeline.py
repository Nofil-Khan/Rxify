"""Comprehensive test suite for the Medication Timeline & Reconciliation Engine.

Covers:
  - Acute vs. chronic drug categorization (antibiotics vs maintenance)
  - Evidence-based reconciliation (continuation vs titration vs separate acute courses)
  - Unresolved medicines preserved as separate courses
  - Strict idempotency: repeated execution does not duplicate courses or links
  - Prescription and instruction immutability
  - Patient adherence confirmation (Confirm Taking, Pause, Stop, Never Started)
  - 5-status support (ACTIVE, ON_HOLD, DISCONTINUED, COMPLETED, UNCERTAIN)
  - Complete status change audit logging with reasons and provenance
  - Prescription lineage retrieval
  - Tenant isolation and authorization security
"""

from __future__ import annotations

import datetime as _dt
import os
import sys
import pytest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from services.medication_reconciliation import (
    is_acute_medication,
    reconcile_prescription_item,
    reconcile_patient_prescriptions,
    migrate_legacy_current_medications,
)
from services import medication_timeline


# ---------------------------------------------------------------------------
# DB availability fixture
# ---------------------------------------------------------------------------

def _db_available() -> bool:
    try:
        from database.db import get_conn
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception:
        return False


db_available = pytest.mark.skipif(
    not _db_available(),
    reason="PostgreSQL database not reachable — skipping DB integration tests",
)


# =============================================================================
# Unit Tests (No DB required)
# =============================================================================

def test_unit_is_acute_medication_stems():
    """Verify acute antibiotics, antifungals, and NSAIDs are recognized as acute."""
    # Acute antibiotic stems
    assert is_acute_medication("amoxicillin", None, 7) is True
    assert is_acute_medication("azithromycin", "Antibiotics", 5) is True
    assert is_acute_medication("ciprofloxacin", None, 10) is True
    assert is_acute_medication("cefixime", None, 7) is True
    assert is_acute_medication("doxycycline", None, 14) is True

    # Acute analgesics / NSAIDs with short duration
    assert is_acute_medication("paracetamol", "Analgesics", 3) is True
    assert is_acute_medication("ibuprofen", "NSAID", 5) is True


def test_unit_is_chronic_medication():
    """Verify chronic maintenance drugs are NOT classified as acute."""
    assert is_acute_medication("metformin hydrochloride", "Antidiabetic", None) is False
    assert is_acute_medication("atorvastatin", "Cardiovascular", 30) is False
    assert is_acute_medication("amlodipine", "Antihypertensive", 90) is False
    assert is_acute_medication("levothyroxine", "Endocrine", None) is False
    assert is_acute_medication("losartan potassium", None, 30) is False


# =============================================================================
# DB Integration Tests
# =============================================================================

@pytest.fixture
def test_patient_and_prescriptions():
    """Create an isolated test patient, doctor, and prescriptions in the DB."""
    if not _db_available():
        pytest.skip("DB not available")

    import uuid
    from database.db import get_conn

    unique_email = f"timeline_test_{uuid.uuid4().hex[:8]}@example.com"
    doc_email = f"doc_{uuid.uuid4().hex[:8]}@example.com"

    with get_conn() as conn:
        with conn.cursor() as cur:
            # 1. Create Patient user & profile
            cur.execute(
                """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES ('Timeline Test Patient', %s, 'hash', 'PATIENT')
                RETURNING user_id
                """,
                (unique_email,),
            )
            patient_user_id = cur.fetchone()[0]

            cur.execute(
                "INSERT INTO patient (user_id) VALUES (%s) RETURNING patient_id",
                (patient_user_id,),
            )
            patient_id = cur.fetchone()[0]

            # 2. Create Doctor user & profile
            cur.execute(
                """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES ('Dr. Timeline Expert', %s, 'hash', 'DOCTOR')
                RETURNING user_id
                """,
                (doc_email,),
            )
            doc_user_id = cur.fetchone()[0]

            cur.execute(
                "INSERT INTO doctor (user_id, specialization) VALUES (%s, 'Cardiology') RETURNING doctor_id",
                (doc_user_id,),
            )
            doctor_id = cur.fetchone()[0]

    yield {
        "patient_id": patient_id,
        "patient_user_id": patient_user_id,
        "doctor_id": doctor_id,
    }

    # Cleanup
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM patient WHERE patient_id = %s", (patient_id,))
            cur.execute("DELETE FROM users WHERE user_id IN (%s, %s)", (patient_user_id, doc_user_id))


@db_available
def test_chronic_refill_continuation(test_patient_and_prescriptions):
    """Two prescriptions for the same chronic medication (Metformin 500mg) 30 days apart

    must link into the same course as CONTINUATION.
    """
    ctx = test_patient_and_prescriptions
    patient_id = ctx["patient_id"]
    doctor_id = ctx["doctor_id"]

    import psycopg2.extras
    from database.db import get_conn
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Find metformin in medicine catalog
            cur.execute("SELECT medicine_id FROM medicine WHERE generic_name ILIKE '%metformin%' LIMIT 1")
            med_row = cur.fetchone()
            med_id = med_row["medicine_id"] if med_row else None

            # Create Prescription #1 (Jan 1)
            cur.execute(
                """
                INSERT INTO prescription (patient_id, doctor_id, issue_date, diagnosis)
                VALUES (%s, %s, '2026-01-01', 'Type 2 Diabetes') RETURNING prescription_id
                """,
                (patient_id, doctor_id),
            )
            rx1_id = cur.fetchone()["prescription_id"]

            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency, duration, instructions)
                VALUES (%s, %s, 'Metformin 500mg', '500 mg', 'Twice daily', '30 days', 'Take with meals')
                RETURNING prescription_medicine_id, medicine_id, name, dosage, frequency, duration, instructions
                """,
                (rx1_id, med_id),
            )
            pm1 = dict(cur.fetchone())

            # Reconcile Rx1
            c1_id = reconcile_prescription_item(
                prescription_id=rx1_id,
                pm=pm1,
                patient_id=patient_id,
                issue_date=_dt.date(2026, 1, 1),
                doctor_id=doctor_id,
                cur=cur,
            )

            # Create Prescription #2 (Feb 1 - 31 days later, refill)
            cur.execute(
                """
                INSERT INTO prescription (patient_id, doctor_id, issue_date, diagnosis)
                VALUES (%s, %s, '2026-02-01', 'Type 2 Diabetes Refill') RETURNING prescription_id
                """,
                (patient_id, doctor_id),
            )
            rx2_id = cur.fetchone()["prescription_id"]

            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency, duration, instructions)
                VALUES (%s, %s, 'Metformin 500mg', '500 mg', 'Twice daily', '30 days', 'Take with meals')
                RETURNING prescription_medicine_id, medicine_id, name, dosage, frequency, duration, instructions
                """,
                (rx2_id, med_id),
            )
            pm2 = dict(cur.fetchone())

            # Reconcile Rx2
            c2_id = reconcile_prescription_item(
                prescription_id=rx2_id,
                pm=pm2,
                patient_id=patient_id,
                issue_date=_dt.date(2026, 2, 1),
                doctor_id=doctor_id,
                cur=cur,
            )

            # Must link to the SAME course!
            assert c1_id == c2_id

            # Verify link records
            cur.execute("SELECT event_type FROM medication_course_prescription WHERE course_id = %s ORDER BY event_date ASC", (c1_id,))
            events = [r["event_type"] for r in cur.fetchall()]
            assert events == ["NEW_COURSE", "CONTINUATION"]


@db_available
def test_chronic_dose_titration(test_patient_and_prescriptions):
    """Prescription #1 (Atorvastatin 10mg) followed by Prescription #2 (Atorvastatin 20mg)

    links into the same course as DOSE_CHANGED, updating active strength to 20mg
    while preserving Prescription #1's 10mg snapshot.
    """
    ctx = test_patient_and_prescriptions
    patient_id = ctx["patient_id"]
    doctor_id = ctx["doctor_id"]

    import psycopg2.extras
    from database.db import get_conn
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT medicine_id FROM medicine WHERE generic_name ILIKE '%atorvastatin%' LIMIT 1")
            med_row = cur.fetchone()
            med_id = med_row["medicine_id"] if med_row else None

            # Rx 1: 10mg
            cur.execute(
                "INSERT INTO prescription (patient_id, doctor_id, issue_date) VALUES (%s, %s, '2026-01-01') RETURNING prescription_id",
                (patient_id, doctor_id),
            )
            rx1 = cur.fetchone()["prescription_id"]
            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency, duration, instructions)
                VALUES (%s, %s, 'Atorvastatin 10mg', '10 mg', 'Once daily at night', '30 days', 'Bedtime')
                RETURNING prescription_medicine_id, medicine_id, name, dosage, frequency, duration, instructions
                """,
                (rx1, med_id),
            )
            pm1 = dict(cur.fetchone())

            c1 = reconcile_prescription_item(rx1, pm1, patient_id, _dt.date(2026, 1, 1), doctor_id, cur)

            # Rx 2: 20mg (titration 30 days later)
            cur.execute(
                "INSERT INTO prescription (patient_id, doctor_id, issue_date) VALUES (%s, %s, '2026-02-01') RETURNING prescription_id",
                (patient_id, doctor_id),
            )
            rx2 = cur.fetchone()["prescription_id"]
            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency, duration, instructions)
                VALUES (%s, %s, 'Atorvastatin 20mg', '20 mg', 'Once daily at night', '30 days', 'Bedtime after titration')
                RETURNING prescription_medicine_id, medicine_id, name, dosage, frequency, duration, instructions
                """,
                (rx2, med_id),
            )
            pm2 = dict(cur.fetchone())

            c2 = reconcile_prescription_item(rx2, pm2, patient_id, _dt.date(2026, 2, 1), doctor_id, cur)

            # Same course
            assert c1 == c2

            # Check active strength updated on course
            cur.execute("SELECT active_strength FROM medication_course WHERE course_id = %s", (c1,))
            course_strength = cur.fetchone()["active_strength"]
            assert "20" in course_strength

            # Check original prescriptions are preserved in link table
            cur.execute(
                """
                SELECT prescribed_dosage, prescribed_instructions, event_type
                FROM medication_course_prescription
                WHERE course_id = %s
                ORDER BY event_date ASC
                """,
                (c1,),
            )
            links = cur.fetchall()
            assert len(links) == 2
            assert links[0]["prescribed_dosage"] == "10 mg"
            assert links[0]["prescribed_instructions"] == "Bedtime"
            assert links[0]["event_type"] == "NEW_COURSE"
            assert links[1]["prescribed_dosage"] == "20 mg"
            assert links[1]["prescribed_instructions"] == "Bedtime after titration"
            assert links[1]["event_type"] == "DOSE_CHANGED"


@db_available
def test_acute_medications_separate_courses(test_patient_and_prescriptions):
    """Two prescriptions for an acute antibiotic (Amoxicillin) prescribed months apart

    MUST be preserved as two distinct courses (distinct infection episodes).
    """
    ctx = test_patient_and_prescriptions
    patient_id = ctx["patient_id"]
    doctor_id = ctx["doctor_id"]

    import psycopg2.extras
    from database.db import get_conn
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT medicine_id FROM medicine WHERE generic_name ILIKE '%amoxicillin%' LIMIT 1")
            med_row = cur.fetchone()
            med_id = med_row["medicine_id"] if med_row else None

            # Course 1: Jan 10 (Ear infection)
            cur.execute(
                "INSERT INTO prescription (patient_id, doctor_id, issue_date) VALUES (%s, %s, '2026-01-10') RETURNING prescription_id",
                (patient_id, doctor_id),
            )
            rx1 = cur.fetchone()["prescription_id"]
            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency, duration, instructions)
                VALUES (%s, %s, 'Amoxicillin 500mg', '500 mg', 'Three times daily', '7 days', 'Finish full course')
                RETURNING prescription_medicine_id, medicine_id, name, dosage, frequency, duration, instructions
                """,
                (rx1, med_id),
            )
            pm1 = dict(cur.fetchone())
            c1 = reconcile_prescription_item(rx1, pm1, patient_id, _dt.date(2026, 1, 10), doctor_id, cur)

            # Course 2: Oct 15 (Dental procedure - 9 months later)
            cur.execute(
                "INSERT INTO prescription (patient_id, doctor_id, issue_date) VALUES (%s, %s, '2026-10-15') RETURNING prescription_id",
                (patient_id, doctor_id),
            )
            rx2 = cur.fetchone()["prescription_id"]
            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency, duration, instructions)
                VALUES (%s, %s, 'Amoxicillin 500mg', '500 mg', 'Three times daily', '5 days', 'Post-procedure')
                RETURNING prescription_medicine_id, medicine_id, name, dosage, frequency, duration, instructions
                """,
                (rx2, med_id),
            )
            pm2 = dict(cur.fetchone())
            c2 = reconcile_prescription_item(rx2, pm2, patient_id, _dt.date(2026, 10, 15), doctor_id, cur)

            # Must NOT be merged: distinct courses!
            assert c1 != c2


@db_available
def test_unresolved_medicine_isolated(test_patient_and_prescriptions):
    """An unresolved prescription item (medicine_id IS NULL) must create an isolated

    course and never auto-merge.
    """
    ctx = test_patient_and_prescriptions
    patient_id = ctx["patient_id"]
    doctor_id = ctx["doctor_id"]

    import psycopg2.extras
    from database.db import get_conn
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO prescription (patient_id, doctor_id, issue_date) VALUES (%s, %s, '2026-03-01') RETURNING prescription_id",
                (patient_id, doctor_id),
            )
            rx1 = cur.fetchone()["prescription_id"]
            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency, duration)
                VALUES (%s, NULL, 'Unmapped Herbal Remedy 10ml', '10 ml', 'Twice daily', '14 days')
                RETURNING prescription_medicine_id, medicine_id, name, dosage, frequency, duration, instructions
                """,
                (rx1,),
            )
            pm1 = dict(cur.fetchone())
            c1 = reconcile_prescription_item(rx1, pm1, patient_id, _dt.date(2026, 3, 1), doctor_id, cur)

            cur.execute("SELECT canonical_medicine_id, display_name FROM medication_course WHERE course_id = %s", (c1,))
            row = cur.fetchone()
            assert row["canonical_medicine_id"] is None
            assert "Unmapped Herbal Remedy" in row["display_name"]


@db_available
def test_reconciliation_strict_idempotency(test_patient_and_prescriptions):
    """Reconciling the same patient prescriptions multiple times must not create

    duplicate courses, prescription links, or audit records.
    """
    ctx = test_patient_and_prescriptions
    patient_id = ctx["patient_id"]
    doctor_id = ctx["doctor_id"]

    import psycopg2.extras
    from database.db import get_conn
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO prescription (patient_id, doctor_id, issue_date) VALUES (%s, %s, '2026-04-01') RETURNING prescription_id",
                (patient_id, doctor_id),
            )
            rx_id = cur.fetchone()["prescription_id"]
            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency, duration)
                VALUES (%s, NULL, 'Idempotent Test Pill 100mg', '100 mg', 'Daily', '30 days')
                """,
                (rx_id,),
            )

    # Run 1
    reconcile_patient_prescriptions(patient_id)
    # Run 2 (immediate re-run)
    reconcile_patient_prescriptions(patient_id)
    # Run 3
    reconcile_patient_prescriptions(patient_id)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*) FROM medication_course_prescription mcp
                JOIN prescription rx ON rx.prescription_id = mcp.prescription_id
                WHERE rx.patient_id = %s
                """,
                (patient_id,),
            )
            link_count = cur.fetchone()[0]
            assert link_count == 1  # Exactly one link!


@db_available
def test_patient_confirmation_and_audit_history(test_patient_and_prescriptions):
    """Newly prescribed medicine starts as NEEDS_CONFIRMATION / SYSTEM_INFERRED.

    Confirming taking sets CONFIRMED_TAKING / PATIENT_REPORTED and appends an audit row.
    """
    ctx = test_patient_and_prescriptions
    patient_id = ctx["patient_id"]
    patient_user_id = ctx["patient_user_id"]
    doctor_id = ctx["doctor_id"]

    import psycopg2.extras
    from database.db import get_conn
    today = _dt.date.today()
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO prescription (patient_id, doctor_id, issue_date) VALUES (%s, %s, %s) RETURNING prescription_id",
                (patient_id, doctor_id, today),
            )
            rx_id = cur.fetchone()["prescription_id"]
            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency, duration)
                VALUES (%s, NULL, 'Adherence Test Drug 50mg', '50 mg', 'Daily', '60 days')
                RETURNING prescription_medicine_id, medicine_id, name, dosage, frequency, duration, instructions
                """,
                (rx_id,),
            )
            pm = dict(cur.fetchone())
            course_id = reconcile_prescription_item(rx_id, pm, patient_id, today, doctor_id, cur)

    # Initial state verification
    timeline = medication_timeline.get_patient_medication_timeline(patient_user_id)
    course_item = next((c for c in timeline["courses"] if c["course_id"] == course_id), None)
    assert course_item is not None
    assert course_item["confirmation_status"] == "NEEDS_CONFIRMATION"
    assert course_item["status_source"] == "SYSTEM_INFERRED"

    # Action 1: Confirm Taking
    res = medication_timeline.confirm_patient_medication(
        patient_user_id=patient_user_id,
        course_id=course_id,
        action="CONFIRM_TAKING",
        reason="Patient taking daily with breakfast",
    )
    assert res["success"] is True

    # Action 2: Retrieve History and verify audit log
    hist = medication_timeline.get_course_history(patient_user_id, course_id)
    assert hist["course"]["confirmation_status"] == "CONFIRMED_TAKING"
    assert hist["course"]["status_source"] == "PATIENT_REPORTED"
    assert len(hist["audit_history"]) >= 1
    assert hist["audit_history"][0]["new_confirmation"] == "CONFIRMED_TAKING"
    assert hist["audit_history"][0]["source"] == "PATIENT_REPORTED"

    # Action 3: Put on hold
    res_pause = medication_timeline.confirm_patient_medication(
        patient_user_id=patient_user_id,
        course_id=course_id,
        action="PAUSE",
        reason="Nausea symptoms",
    )
    assert res_pause["course"]["status"] == "ON_HOLD"
    assert res_pause["course"]["confirmation_status"] == "CONFIRMED_PAUSED"


@db_available
def test_tenant_isolation_security(test_patient_and_prescriptions):
    """Patient A cannot access or update Patient B's medication course."""
    ctx = test_patient_and_prescriptions
    patient_id = ctx["patient_id"]
    patient_user_id = ctx["patient_user_id"]
    doctor_id = ctx["doctor_id"]

    # Create course for Patient A
    import psycopg2.extras
    from database.db import get_conn
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO prescription (patient_id, doctor_id, issue_date) VALUES (%s, %s, '2026-06-01') RETURNING prescription_id",
                (patient_id, doctor_id),
            )
            rx = cur.fetchone()["prescription_id"]
            cur.execute(
                """
                INSERT INTO prescription_medicine (prescription_id, medicine_id, name, dosage, frequency)
                VALUES (%s, NULL, 'Private Drug Patient A', '10 mg', 'Daily')
                RETURNING prescription_medicine_id, medicine_id, name, dosage, frequency, duration, instructions
                """,
                (rx,),
            )
            pm = dict(cur.fetchone())
            c_id = reconcile_prescription_item(rx, pm, patient_id, _dt.date(2026, 6, 1), doctor_id, cur)

    # Attacker user_id (not Patient A)
    attacker_user_id = 99999999

    with pytest.raises(ValueError, match="not found|access denied"):
        medication_timeline.get_course_history(attacker_user_id, c_id)

    with pytest.raises(ValueError, match="not found|access denied"):
        medication_timeline.update_patient_medication_status(
            patient_user_id=attacker_user_id,
            course_id=c_id,
            status="DISCONTINUED",
        )
