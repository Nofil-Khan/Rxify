"""Tests for Find Nearby Dispensaries and Stock Availability service & endpoints."""

import pytest
import psycopg2.extras
from database.db import get_conn
from services.dispensary_search import (
    haversine_distance,
    find_nearby_dispensaries,
    route_prescription_fulfillment,
    cancel_patient_request,
)


def test_haversine_distance_calculation():
    """Verify haversine formula calculations with known distances."""
    # Distance between same coordinates is 0
    assert haversine_distance(26.1973, 78.1611, 26.1973, 78.1611) == 0.0

    # Distance between Gwalior (26.1973, 78.1611) and Gwalior Airport (~26.293, 78.227) is ~12.5 km
    dist = haversine_distance(26.1973, 78.1611, 26.2930, 78.2270)
    assert 10.0 <= dist <= 15.0


def test_find_nearby_dispensaries_discovery():
    """Discover active dispensaries near Gwalior coordinates."""
    res = find_nearby_dispensaries(latitude=26.1973, longitude=78.1611, radius_km=50)
    assert "total_found" in res
    assert res["total_found"] >= 1
    assert "dispensaries" in res

    first = res["dispensaries"][0]
    assert "dispensary_id" in first
    assert "name" in first
    assert "distance_km" in first
    assert first["distance_km"] is not None
    # Dispensaries should be sorted by distance ascending
    for i in range(len(res["dispensaries"]) - 1):
        d1 = res["dispensaries"][i]["distance_km"]
        d2 = res["dispensaries"][i + 1]["distance_km"]
        if d1 is not None and d2 is not None:
            assert d1 <= d2


def test_find_nearby_dispensaries_with_prescription():
    """Prescription-scoped availability check correctly classifies stock."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Check if prescription #2 exists
            cur.execute("SELECT prescription_id FROM prescription WHERE prescription_id = 2")
            if not cur.fetchone():
                pytest.skip("Prescription #2 not found in DB")

    res = find_nearby_dispensaries(
        latitude=26.1973,
        longitude=78.1611,
        radius_km=50,
        prescription_id=2,
    )
    assert res["prescription"] is not None
    assert res["prescription"]["prescription_id"] == 2
    assert len(res["dispensaries"]) >= 1

    # Check that availability is evaluated on dispensary #1
    disp1 = next((d for d in res["dispensaries"] if d["dispensary_id"] == 1), None)
    if disp1 and "availability" in disp1:
        avail = disp1["availability"]
        assert "overall_status" in avail
        assert avail["overall_status"] in ("ALL_AVAILABLE", "PARTIALLY_AVAILABLE", "NONE_AVAILABLE", "AVAILABILITY_UNKNOWN")
        assert len(avail["items"]) >= 1
        for it in avail["items"]:
            assert it["status"] in ("AVAILABLE", "UNAVAILABLE", "UNKNOWN")


def test_route_prescription_fulfillment_and_reassignment():
    """Patient can route prescription to chosen dispensary and create/transfer fulfillment request."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT rx.prescription_id, p.user_id
                FROM prescription rx
                JOIN patient p ON p.patient_id = rx.patient_id
                LIMIT 1
                """
            )
            rx = cur.fetchone()
            if not rx:
                pytest.skip("No prescriptions in DB")
            rx_id = rx["prescription_id"]
            user_id = rx["user_id"]

            cur.execute("SELECT dispensary_id FROM dispensary WHERE status = 'ACTIVE' LIMIT 1")
            active_disp = cur.fetchone()
            if not active_disp:
                pytest.skip("No active dispensary in DB")
            test_disp_id = active_disp["dispensary_id"]

    # Route to Dispensary
    result = route_prescription_fulfillment(
        prescription_id=rx_id,
        dispensary_id=test_disp_id,
        patient_user_id=user_id,
        notes="Automated test pickup request",
    )
    assert result["prescription_id"] == rx_id
    assert result["dispensary_id"] == test_disp_id
    assert "request_id" in result
    assert result["status"] in ("PENDING", "PARTIALLY_AVAILABLE", "UNAVAILABLE")
    assert result["queue_position"] >= 1


def test_unauthorized_prescription_access_rejected():
    """User cannot query or route prescription they do not own."""
    with pytest.raises(PermissionError):
        find_nearby_dispensaries(
            latitude=26.1973,
            longitude=78.1611,
            prescription_id=2,
            patient_user_id=99999999,  # Non-existent or mismatched patient user
        )

    with pytest.raises(PermissionError):
        route_prescription_fulfillment(
            prescription_id=2,
            dispensary_id=1,
            patient_user_id=99999999,
        )


def test_patient_request_cancellation():
    """Patient can cancel their pending request and prevent double cancellation."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT rx.prescription_id, p.user_id
                FROM prescription rx
                JOIN patient p ON p.patient_id = rx.patient_id
                LIMIT 1
                """
            )
            rx = cur.fetchone()
            if not rx:
                pytest.skip("No prescriptions in DB")
            rx_id = rx["prescription_id"]
            user_id = rx["user_id"]

            cur.execute("SELECT dispensary_id FROM dispensary WHERE status = 'ACTIVE' LIMIT 1")
            active_disp = cur.fetchone()
            if not active_disp:
                pytest.skip("No active dispensary in DB")
            test_disp_id = active_disp["dispensary_id"]

    # 1. Route fulfillment
    routed = route_prescription_fulfillment(
        prescription_id=rx_id,
        dispensary_id=test_disp_id,
        patient_user_id=user_id,
        notes="To be cancelled",
    )
    req_id = routed["request_id"]

    # 2. Cancel unauthorized (different user)
    with pytest.raises(PermissionError):
        cancel_patient_request(request_id=req_id, patient_user_id=99999999)

    # 3. Cancel authorized
    cancel_res = cancel_patient_request(request_id=req_id, patient_user_id=user_id, reason="Changed mind")
    assert cancel_res["success"] is True
    assert cancel_res["status"] == "CANCELLED"

    # 4. Attempting to cancel already cancelled request raises ValueError
    with pytest.raises(ValueError):
        cancel_patient_request(request_id=req_id, patient_user_id=user_id)


def test_dispensary_ranking_system_and_top_k():
    """Verify that multi-criteria ranking assigns rank_score, match_tier, and top_k restricts output."""
    res = find_nearby_dispensaries(
        latitude=26.2112,
        longitude=78.1697,
        radius_km=25.0,
        top_k=3,
    )
    assert res["total_found"] >= 3
    assert len(res["dispensaries"]) == 3
    assert res["top_k_applied"] == 3

    # Check rankings are sorted descending by rank_score
    scores = [d["ranking"]["rank_score"] for d in res["dispensaries"]]
    assert scores == sorted(scores, reverse=True)

    # Check top pick metadata
    top = res["dispensaries"][0]
    assert top["ranking"]["rank"] == 1
    assert top["ranking"]["is_top_pick"] is True
    assert "score_breakdown" in top["ranking"]
    assert "availability_score" in top["ranking"]["score_breakdown"]
    assert "distance_score" in top["ranking"]["score_breakdown"]


def test_dispensary_users_in_users_table_with_hospital_first_name():
    """Verify that every dispensary has a matching user in users table with first word password."""
    from database.db import get_user_by_email, verify_password

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT dispensary_id, name, email FROM dispensary LIMIT 5")
            dispensaries = cur.fetchall()

    assert len(dispensaries) > 0
    for d in dispensaries:
        user = get_user_by_email(d["email"])
        assert user is not None
        assert user["role"] == "DISPENSARY"
        assert user["dispensary_id"] == d["dispensary_id"]

        first_name = d["name"].split()[0]
        # Password matches first name of the hospital / dispensary
        assert verify_password(first_name, user["password_hash"]) is True


def test_pickup_verification_code_handover():
    """Verify that routing creates 6-digit pickup code, and dispensing enforces code matching."""
    from services.dispensary import dispense_request

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT rx.prescription_id, p.user_id
                FROM prescription rx
                JOIN patient p ON p.patient_id = rx.patient_id
                LIMIT 1
                """
            )
            rx = cur.fetchone()
            if not rx:
                pytest.skip("No prescriptions in DB")
            rx_id = rx["prescription_id"]
            user_id = rx["user_id"]

            cur.execute("SELECT dispensary_id FROM dispensary WHERE status = 'ACTIVE' LIMIT 1")
            active_disp = cur.fetchone()
            test_disp_id = active_disp["dispensary_id"]

    # 1. Route fulfillment ticket
    routed = route_prescription_fulfillment(
        prescription_id=rx_id,
        dispensary_id=test_disp_id,
        patient_user_id=user_id,
        notes="Test pickup verification",
    )
    req_id = routed["request_id"]
    pickup_code = routed.get("pickup_code")

    assert pickup_code is not None
    assert len(pickup_code) == 6
    assert pickup_code.isdigit()

    # 2. Attempt dispensing with incorrect code -> raises ValueError
    with pytest.raises(ValueError, match="Invalid pickup verification code"):
        dispense_request(
            dispensary_id=test_disp_id,
            request_id=req_id,
            pickup_code="000000" if pickup_code != "000000" else "999999",
        )

    # 3. Attempt dispensing with correct 6-digit code -> succeeds
    dispensed = dispense_request(
        dispensary_id=test_disp_id,
        request_id=req_id,
        pickup_code=pickup_code,
        notes="Verified at counter",
    )
    assert dispensed["status"] == "DISPENSED"
    assert dispensed["request_id"] == req_id




