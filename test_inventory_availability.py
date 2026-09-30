"""Tests for the Inventory Availability Service.

Follows the same plain-script style as quick_test.py and test_summary.py
(no pytest framework; runs against the live DB specified in DATABASE_URL).

Usage:
    python test_inventory_availability.py

All test data is discovered DYNAMICALLY from the live DB:
  - A medicine that has a stock row with qty > 0     (for AVAILABLE test)
  - A medicine that exists in catalog but no stock row (for NOT_AVAILABLE test)
  - Fake IDs (999999) for non-existence tests

No permanent test data is inserted. Temporary state changes (setting qty to 0)
are always restored in a finally block.

Test cases covered:
    1. Medicine with positive stock          -> AVAILABLE
    2. Medicine with zero stock              -> NOT_AVAILABLE (temporarily set)
    3. Medicine with no inventory row        -> NOT_AVAILABLE
    4. Non-existent medicine_id             -> UNRESOLVED
    5. Non-existent dispensary_id           -> ValueError
    6. Multiple medicines in one request    -> get_prescription_availability
    7. Invalid medicine_id (negative)       -> UNRESOLVED in batch
    8. Empty medicines list                 -> ValueError
    9. Non-existent dispensary in batch     -> ValueError
"""

from __future__ import annotations

import sys
import traceback
from typing import Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from database.db import get_conn
import psycopg2.extras

from services.inventory_availability import (
    STATUS_AVAILABLE,
    STATUS_NOT_AVAILABLE,
    STATUS_UNRESOLVED,
    get_medicine_availability,
    get_prescription_availability,
)


# ---------------------------------------------------------------------------
# Test infrastructure
# ---------------------------------------------------------------------------

PASS = "[PASS]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"

_results: list[tuple[str, str]] = []


def _check(label: str, condition: bool, extra: str = "") -> None:
    marker = PASS if condition else FAIL
    msg = f"{marker} {label}"
    if extra:
        msg += f"  ({extra})"
    print(msg)
    _results.append((marker, label))


def _skip(label: str, reason: str) -> None:
    print(f"{SKIP} {label}  -- {reason}")
    _results.append((SKIP, label))


def _run(label: str, fn):
    try:
        return fn()
    except Exception as exc:
        print(f"{FAIL} {label}  -> UNEXPECTED EXCEPTION: {exc}")
        traceback.print_exc()
        _results.append((FAIL, label))
        return None


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

FAKE_MED_ID  = 999_999_999   # guaranteed non-existent in a 12k-row catalog
FAKE_DISP_ID = 999_999_999


def _discover_dispensary_id() -> Optional[int]:
    """Return the first dispensary_id found, or None."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT dispensary_id FROM dispensary LIMIT 1")
            row = cur.fetchone()
            return row["dispensary_id"] if row else None


def _discover_stocked_medicine(dispensary_id: int) -> Optional[int]:
    """Return a medicine_id at dispensary_id that has available_quantity > 0."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT medicine_id FROM inventory_dispensary_stock
                WHERE dispensary_id = %s AND available_quantity > 0
                LIMIT 1
                """,
                (dispensary_id,),
            )
            row = cur.fetchone()
            return row["medicine_id"] if row else None


def _discover_unstocked_medicine(dispensary_id: int) -> Optional[int]:
    """Return a medicine_id that EXISTS in the catalog but has NO stock row at dispensary_id."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT m.medicine_id
                FROM medicine m
                LEFT JOIN inventory_dispensary_stock inv
                    ON inv.medicine_id = m.medicine_id AND inv.dispensary_id = %s
                WHERE inv.inventory_id IS NULL
                LIMIT 1
                """,
                (dispensary_id,),
            )
            row = cur.fetchone()
            return row["medicine_id"] if row else None


def _set_stock(dispensary_id: int, medicine_id: int, qty: int) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE inventory_dispensary_stock SET available_quantity = %s, updated_at = NOW() "
                "WHERE dispensary_id = %s AND medicine_id = %s",
                (qty, dispensary_id, medicine_id),
            )


def _get_current_qty(dispensary_id: int, medicine_id: int) -> Optional[int]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT available_quantity FROM inventory_dispensary_stock "
                "WHERE dispensary_id = %s AND medicine_id = %s",
                (dispensary_id, medicine_id),
            )
            row = cur.fetchone()
            return row["available_quantity"] if row else None


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

def run_tests(dispensary_id: int, stocked_med: Optional[int], unstocked_med: Optional[int]) -> None:

    # Case 1: positive stock -> AVAILABLE
    label = "Case 1: positive stock -> AVAILABLE"
    if stocked_med is None:
        _skip(label, "No stocked medicine found at this dispensary")
    else:
        result = _run(label, lambda: get_medicine_availability(dispensary_id, stocked_med))
        if result is not None:
            ok = result["status"] == STATUS_AVAILABLE and result["available_quantity"] > 0
            _check(label, ok, f"medicine_id={stocked_med}, status={result['status']!r}, qty={result['available_quantity']}")

    # Case 2: zero stock -> NOT_AVAILABLE
    label = "Case 2: zero stock -> NOT_AVAILABLE"
    if stocked_med is None:
        _skip(label, "No stocked medicine to temporarily zero out")
    else:
        original_qty = _get_current_qty(dispensary_id, stocked_med)
        try:
            _set_stock(dispensary_id, stocked_med, 0)
            result = _run(label, lambda: get_medicine_availability(dispensary_id, stocked_med))
            if result is not None:
                ok = result["status"] == STATUS_NOT_AVAILABLE and result["available_quantity"] == 0
                _check(label, ok, f"status={result['status']!r}, qty={result['available_quantity']}")
        finally:
            if original_qty is not None:
                _set_stock(dispensary_id, stocked_med, original_qty)

    # Case 3: no stock row -> NOT_AVAILABLE
    label = "Case 3: no stock row -> NOT_AVAILABLE"
    if unstocked_med is None:
        _skip(label, "No unstocked medicine found in catalog for this dispensary")
    else:
        result = _run(label, lambda: get_medicine_availability(dispensary_id, unstocked_med))
        if result is not None:
            ok = result["status"] == STATUS_NOT_AVAILABLE and result["available_quantity"] == 0
            _check(label, ok, f"medicine_id={unstocked_med}, status={result['status']!r}")

    # Case 4: nonexistent medicine -> UNRESOLVED
    label = "Case 4: nonexistent medicine -> UNRESOLVED"
    result = _run(label, lambda: get_medicine_availability(dispensary_id, FAKE_MED_ID))
    if result is not None:
        ok = result["status"] == STATUS_UNRESOLVED
        _check(label, ok, f"status={result['status']!r}")

    # Case 5: nonexistent dispensary -> ValueError
    label = "Case 5: nonexistent dispensary -> ValueError"
    raised = False
    try:
        get_medicine_availability(FAKE_DISP_ID, stocked_med or FAKE_MED_ID)
    except ValueError as exc:
        raised = True
        print(f"  caught ValueError: {exc}")
    _check(label, raised, "ValueError raised as expected" if raised else "no error raised")

    # Case 6: prescription-level batch
    label = "Case 6: prescription-level batch availability"
    medicines = []
    expected_available = 0
    if stocked_med is not None:
        medicines.append({"medicine_id": stocked_med,  "requested_quantity": 2})
        expected_available += 1
    if unstocked_med is not None:
        medicines.append({"medicine_id": unstocked_med, "requested_quantity": 1})
    medicines.append({"medicine_id": FAKE_MED_ID, "requested_quantity": 1})

    if not medicines:
        _skip(label, "No test medicines available")
    else:
        result = _run(label, lambda: get_prescription_availability(dispensary_id, medicines))
        if result is not None:
            items = result.get("items", [])
            # Last item is always FAKE_MED_ID -> UNRESOLVED
            last_status = items[-1]["status"] if items else None
            ok = (
                len(items) == len(medicines)
                and last_status == STATUS_UNRESOLVED
                and "overall_status" in result
            )
            _check(
                label, ok,
                f"overall={result.get('overall_status')!r}, "
                f"statuses={[i['status'] for i in items]}"
            )

    # Case 7: invalid medicine_id (negative) in batch -> UNRESOLVED for that item
    label = "Case 7: invalid medicine_id in batch -> UNRESOLVED"
    medicines7 = [
        {"medicine_id": -5, "requested_quantity": 1},
    ]
    if stocked_med is not None:
        medicines7.append({"medicine_id": stocked_med, "requested_quantity": 1})
    result = _run(label, lambda: get_prescription_availability(dispensary_id, medicines7))
    if result is not None:
        items = result.get("items", [])
        ok = len(items) > 0 and items[0]["status"] == STATUS_UNRESOLVED
        item0_status = items[0]["status"] if items else "no items"
        _check(label, ok, f"item[0].status={item0_status!r}")

    # Case 8: empty medicines list -> ValueError
    label = "Case 8: empty medicines list -> ValueError"
    raised = False
    try:
        get_prescription_availability(dispensary_id, [])
    except ValueError as exc:
        raised = True
        print(f"  caught ValueError: {exc}")
    _check(label, raised, "ValueError raised as expected" if raised else "no error raised")

    # Case 9: nonexistent dispensary in batch -> ValueError
    label = "Case 9: nonexistent dispensary in batch -> ValueError"
    raised = False
    try:
        get_prescription_availability(FAKE_DISP_ID, [{"medicine_id": stocked_med or FAKE_MED_ID}])
    except ValueError as exc:
        raised = True
        print(f"  caught ValueError: {exc}")
    _check(label, raised, "ValueError raised as expected" if raised else "no error raised")


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

def main():
    print("=" * 70)
    print("  Inventory Availability Service -- Tests")
    print("=" * 70)
    print()

    dispensary_id = _discover_dispensary_id()
    if dispensary_id is None:
        print("ERROR: No dispensary found in the database. Run seed.sql first.")
        sys.exit(2)

    stocked_med   = _discover_stocked_medicine(dispensary_id)
    unstocked_med = _discover_unstocked_medicine(dispensary_id)

    print(f"  Using dispensary_id : {dispensary_id}")
    print(f"  Stocked medicine_id : {stocked_med}  (for AVAILABLE / zero-stock tests)")
    print(f"  Unstocked med_id    : {unstocked_med}  (for no-row NOT_AVAILABLE test)")
    print(f"  Fake medicine_id    : {FAKE_MED_ID}  (for UNRESOLVED test)")
    print()

    run_tests(dispensary_id, stocked_med, unstocked_med)

    passed  = sum(1 for m, _ in _results if m == PASS)
    failed  = sum(1 for m, _ in _results if m == FAIL)
    skipped = sum(1 for m, _ in _results if m == SKIP)
    total   = len(_results)

    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  PASSED  : {passed}/{total}")
    print(f"  FAILED  : {failed}/{total}")
    print(f"  SKIPPED : {skipped}/{total}")

    if failed:
        print()
        print("Failed cases:")
        for marker, lbl in _results:
            if marker == FAIL:
                print(f"    {lbl}")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
