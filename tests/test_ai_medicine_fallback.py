import pytest
import psycopg2.extras
from database.db import get_conn
from services.ai_medicine_fallback import (
    predict_medicine_fallback,
    resolve_unresolved_prescription_medicines,
)
from services.dispensary_search import route_prescription_fulfillment
from services import dispensary as dispensary_service


def test_ai_predict_colloquial_medicine():
    """Verify AI model successfully maps colloquial brand to catalog generic substance."""
    # Test with standard brand
    res = predict_medicine_fallback("Tab Dolo 650", extracted_dosage="650mg", extracted_form="tablet")
    assert res is not None
    assert res["status"] == "MATCHED"
    assert res["medicine_id"] is not None
    assert "paracetamol" in res["generic_name"].lower() or "acetaminophen" in res["generic_name"].lower()


def test_ai_fallback_auto_resolves_in_dispensary_routing():
    """Verify that when prescription is routed to dispensary, unreviewed medicines are auto-resolved by AI."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Get a patient
            cur.execute("SELECT patient_id, user_id FROM patient LIMIT 1")
            patient = cur.fetchone()
            if not patient:
                pytest.skip("No patient in database")
            pt_id = patient["patient_id"]
            p_uid = patient["user_id"]

            # Get an active dispensary
            cur.execute("SELECT dispensary_id FROM dispensary WHERE status = 'ACTIVE' LIMIT 1")
            disp = cur.fetchone()
            if not disp:
                pytest.skip("No dispensary in database")
            disp_id = disp["dispensary_id"]

            # Create dummy prescription
            cur.execute(
                """
                INSERT INTO prescription (patient_id, issue_date, diagnosis, notes)
                VALUES (%s, CURRENT_DATE, 'AI Fallback Test', 'Clinical AI test')
                RETURNING prescription_id
                """,
                (pt_id,),
            )
            rx_id = cur.fetchone()["prescription_id"]

            # Insert an UNRESOLVED medicine (colloquial brand, patient_resolved = FALSE)
            cur.execute(
                """
                INSERT INTO prescription_medicine (
                    prescription_id, medicine_id, name, dosage, frequency, duration,
                    match_status, patient_resolved
                ) VALUES (%s, NULL, 'Pan 40', '40mg', '1-0-0', '5 days', 'UNRESOLVED', FALSE)
                RETURNING prescription_medicine_id
                """,
                (rx_id,),
            )
            pm_id = cur.fetchone()["prescription_medicine_id"]
            conn.commit()

    try:
        # Route fulfillment to dispensary (this triggers auto AI resolution before building items)
        route_res = route_prescription_fulfillment(
            prescription_id=rx_id,
            dispensary_id=disp_id,
            patient_user_id=p_uid,
        )
        req_id = route_res["request_id"]
        assert req_id is not None

        # Check prescription_medicine was auto-resolved
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT medicine_id, match_status FROM prescription_medicine WHERE prescription_medicine_id = %s",
                    (pm_id,),
                )
                pm_row = cur.fetchone()
                assert pm_row["medicine_id"] is not None
                assert pm_row["match_status"] == "MATCHED"

        # Check dispensary request item was also resolved and not UNRESOLVED
        detail = dispensary_service.get_request_detail(disp_id, req_id)
        assert detail is not None
        assert len(detail["items"]) > 0
        first_item = detail["items"][0]
        assert first_item["medicine_id"] is not None
        assert first_item["availability_status"] in ("AVAILABLE", "PARTIAL", "UNAVAILABLE")

    finally:
        # Clean up test artifacts
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM dispensary_request WHERE prescription_id = %s", (rx_id,))
                cur.execute("DELETE FROM prescription_medicine WHERE prescription_id = %s", (rx_id,))
                cur.execute("DELETE FROM prescription WHERE prescription_id = %s", (rx_id,))
                conn.commit()
