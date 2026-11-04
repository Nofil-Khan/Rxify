import pytest
import psycopg2.extras
from database.db import get_conn
from services import dispensary as dispensary_service
from services.dispensary_search import route_prescription_fulfillment


def test_dispensary_approval_and_reconsultation_workflow():
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Find an active patient with prescription
            cur.execute("""
                SELECT rx.prescription_id, rx.patient_id, p.user_id AS patient_user_id
                FROM prescription rx
                JOIN patient p ON p.patient_id = rx.patient_id
                WHERE EXISTS (SELECT 1 FROM prescription_medicine pm WHERE pm.prescription_id = rx.prescription_id)
                LIMIT 1
            """)
            rx = cur.fetchone()
            if not rx:
                pytest.skip("No prescription found in database")

            rx_id = rx["prescription_id"]
            p_uid = rx["patient_user_id"]

            # Find an active dispensary
            cur.execute("SELECT dispensary_id FROM dispensary WHERE status = 'ACTIVE' LIMIT 1")
            disp = cur.fetchone()
            if not disp:
                pytest.skip("No active dispensary found")
            disp_id = disp["dispensary_id"]

            # Clear previous requests for this test
            cur.execute("DELETE FROM dispensary_request WHERE prescription_id = %s", (rx_id,))
            conn.commit()

    # 1. Route fulfillment (patient places ticket)
    fulfill_res = route_prescription_fulfillment(
        prescription_id=rx_id,
        dispensary_id=disp_id,
        patient_user_id=p_uid,
        notes="Please prepare urgently",
    )
    req_id = fulfill_res["request_id"]
    assert req_id > 0
    assert fulfill_res["status"] in ("PENDING", "PARTIALLY_AVAILABLE", "UNAVAILABLE")

    # 2. Pharmacist Approves & Confirms the ticket
    approved = dispensary_service.confirm_or_approve_request(
        dispensary_id=disp_id,
        request_id=req_id,
        estimated_prep_minutes=25,
        pharmacist_notes="Verified by Pharmacist John. Ready at Counter 2.",
    )
    assert approved["status"] == "CONFIRMED"
    assert approved["pharmacist_notes"] == "Verified by Pharmacist John. Ready at Counter 2."
    assert approved["estimated_ready_at"] is not None

    # 3. Pharmacist flags reconsultation with Doctor
    reconsulted = dispensary_service.request_reconsultation(
        dispensary_id=disp_id,
        request_id=req_id,
        reason="OUT_OF_STOCK_ALTERNATE_NEEDED",
        pharmacist_notes="Medicine out of stock. Advise patient to reconsult Dr. regarding Cefixime alternative.",
        target="DOCTOR",
    )
    assert reconsulted["status"] == "RECONSULTATION_NEEDED"
    assert reconsulted["reconsultation_reason"] == "OUT_OF_STOCK_ALTERNATE_NEEDED"
    assert reconsulted["reconsultation_target"] == "DOCTOR"
    assert "Cefixime alternative" in reconsulted["pharmacist_notes"]
    assert reconsulted["reconsultation_at"] is not None

    # Verify patient receives notification
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT title, message FROM notification
                WHERE user_id = %s AND title ILIKE '%%Reconsultation%%'
                ORDER BY notification_id DESC LIMIT 1
            """, (p_uid,))
            notif = cur.fetchone()
            assert notif is not None
            assert "advises doctor reconsultation" in notif["message"]

            # Clean up
            cur.execute("DELETE FROM dispensary_request WHERE request_id = %s", (req_id,))
            conn.commit()


def test_per_medicine_decisions_and_verification_record():
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT rx.prescription_id, rx.patient_id, p.user_id AS patient_user_id
                FROM prescription rx
                JOIN patient p ON p.patient_id = rx.patient_id
                WHERE EXISTS (SELECT 1 FROM prescription_medicine pm WHERE pm.prescription_id = rx.prescription_id)
                LIMIT 1
            """)
            rx = cur.fetchone()
            if not rx:
                pytest.skip("No prescription found in database")

            rx_id = rx["prescription_id"]
            p_uid = rx["patient_user_id"]

            cur.execute("SELECT dispensary_id FROM dispensary WHERE status = 'ACTIVE' LIMIT 1")
            disp_id = cur.fetchone()["dispensary_id"]

            # User ID of dispensary
            cur.execute("SELECT user_id FROM users WHERE email = (SELECT email FROM dispensary WHERE dispensary_id = %s)", (disp_id,))
            disp_u = cur.fetchone()
            disp_user_id = disp_u["user_id"] if disp_u and disp_u["user_id"] else 1

            cur.execute("DELETE FROM dispensary_request WHERE prescription_id = %s", (rx_id,))
            conn.commit()

    # 1. Route fulfillment
    fulfill_res = route_prescription_fulfillment(
        prescription_id=rx_id,
        dispensary_id=disp_id,
        patient_user_id=p_uid,
    )
    req_id = fulfill_res["request_id"]

    detail = dispensary_service.get_request_detail(disp_id, req_id)
    assert len(detail["items"]) > 0
    first_item_id = detail["items"][0]["item_id"]

    # 2. Test Per-Medicine decision: Partial fulfillment
    part_res = dispensary_service.update_request_item_decision(
        dispensary_id=disp_id,
        request_id=req_id,
        item_id=first_item_id,
        decision="PARTIAL",
        quantity=5,
        notes="Dispensed only 5 units due to distributor batch shortage",
    )
    first_item_updated = next(i for i in part_res["items"] if i["item_id"] == first_item_id)
    assert first_item_updated["availability_status"] == "PARTIAL"
    assert first_item_updated["dispensed_quantity"] == 5

    # 3. Test Pharmacist Clinical Verification Record
    verif_res = dispensary_service.verify_prescription(
        dispensary_id=disp_id,
        request_id=req_id,
        user_id=disp_user_id,
        patient_checked=True,
        dosage_checked=True,
        interactions_checked=True,
        notes="All dosages clinically verified against adult renal dose parameters.",
    )
    assert verif_res["verified_at"] is not None
    assert verif_res["verification_signature"] is not None
    assert verif_res["verification_signature"].startswith(f"RXF-V-{req_id}-{disp_id}-")
    assert verif_res["verification_checklist"] is not None
    assert verif_res["verification_checklist"]["patient_identity_checked"] is True

    # 4. Test Inventory Transaction History Ledger
    txns_res = dispensary_service.get_inventory_transactions(dispensary_id=disp_id, limit=10)
    assert "transactions" in txns_res
    assert txns_res["total_count"] >= 0

    # 5. Test Dispensary Queue retrieval with verification fields
    queue_items = dispensary_service.get_dispensary_queue(dispensary_id=disp_id)
    assert isinstance(queue_items, list)
    matching = [q for q in queue_items if q["request_id"] == req_id]
    if matching:
        assert matching[0]["verification_signature"] == verif_res["verification_signature"]

    # Clean up
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("DELETE FROM dispensary_request WHERE request_id = %s", (req_id,))
            conn.commit()
