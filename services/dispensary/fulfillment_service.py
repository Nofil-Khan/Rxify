"""Dispensary Order Fulfillment & Prescription Processing Service."""

from __future__ import annotations

import json
import logging
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import psycopg2.extras

from database.db import get_conn
from services.dispensary.dispatcher import DispensaryNotificationDispatcher, default_dispatcher
from services.dispensary.repository import DispensaryRepository, default_dispensary_repo

logger = logging.getLogger(__name__)

_DETAIL_DATE_FIELDS = (
    "estimated_ready_at",
    "ready_at",
    "dispensed_at",
    "created_at",
    "issue_date",
    "patient_dob",
    "reconsultation_at",
    "verified_at",
)

_QUEUE_DATE_FIELDS = ("estimated_ready_at", "created_at")

_REQUEST_DETAIL_SELECT = """
    SELECT
        req.request_id,
        req.prescription_id,
        req.dispensary_id,
        d.name              AS dispensary_name,
        d.location          AS dispensary_location,
        req.patient_id,
        pt.patient_code,
        u.full_name         AS patient_name,
        u.email             AS patient_email,
        u.phone             AS patient_phone,
        pt.date_of_birth    AS patient_dob,
        u.gender            AS patient_gender,
        rx.issue_date,
        rx.diagnosis,
        rx.notes            AS prescription_notes,
        doc_u.full_name     AS doctor_name,
        doc.specialization  AS doctor_specialty,
        req.status,
        req.estimated_ready_at,
        req.ready_at,
        req.dispensed_at,
        req.pickup_code,
        req.notes,
        req.pharmacist_notes,
        req.reconsultation_reason,
        req.reconsultation_target,
        req.reconsultation_at,
        req.verified_by_user_id,
        req.verified_at,
        req.verification_signature,
        req.verification_checklist,
        verif_u.full_name   AS verified_by_name,
        req.created_at,
        COALESCE(
            (
                SELECT json_agg(
                    json_build_object(
                        'item_id', item.item_id,
                        'prescription_medicine_id', item.prescription_medicine_id,
                        'medicine_id', item.medicine_id,
                        'prescribed_medicine_name', pm.name,
                        'dosage', pm.dosage,
                        'frequency', pm.frequency,
                        'duration', pm.duration,
                        'instructions', pm.instructions,
                        'generic_name', m.generic_name,
                        'brand_name', m.brand_name,
                        'strength', m.strength,
                        'form', m.form,
                        'required_quantity', item.required_quantity,
                        'dispensed_quantity', item.dispensed_quantity,
                        'availability_status', item.availability_status,
                        'reserved', item.reserved,
                        'reconsultation_needed', COALESCE(item.reconsultation_needed, FALSE),
                        'reconsultation_notes', item.reconsultation_notes,
                        'suggested_substitute_id', item.suggested_substitute_id,
                        'substitute_name', sub_m.generic_name,
                        'substitute_brand', sub_m.brand_name,
                        'substitute_strength', sub_m.strength,
                        'substitute_form', sub_m.form::TEXT
                    ) ORDER BY item.item_id ASC
                )
                FROM dispensary_request_item item
                JOIN prescription_medicine pm ON pm.prescription_medicine_id = item.prescription_medicine_id
                LEFT JOIN medicine m ON m.medicine_id = item.medicine_id
                LEFT JOIN medicine sub_m ON sub_m.medicine_id = item.suggested_substitute_id
                WHERE item.request_id = req.request_id
            ),
            '[]'::json
        ) AS items
    FROM dispensary_request req
    JOIN dispensary d ON d.dispensary_id = req.dispensary_id
    JOIN patient pt   ON pt.patient_id   = req.patient_id
    JOIN users u      ON u.user_id       = pt.user_id
    JOIN prescription rx ON rx.prescription_id = req.prescription_id
    LEFT JOIN doctor doc    ON doc.doctor_id   = rx.doctor_id
    LEFT JOIN users doc_u   ON doc_u.user_id   = doc.user_id
    LEFT JOIN users verif_u ON verif_u.user_id = req.verified_by_user_id
"""


def _stringify_dates(record: Dict[str, Any], keys: Iterable[str]) -> Dict[str, Any]:
    """Convert non-null date/timestamp fields to strings for JSON serialization."""
    for key in keys:
        if record.get(key):
            record[key] = str(record[key])
    return record


class OrderFulfillmentService:
    """Manages the lifecycle of prescription fulfillment tickets, stock reservation, and collection."""

    def __init__(
        self,
        repository: Optional[DispensaryRepository] = None,
        dispatcher: Optional[DispensaryNotificationDispatcher] = None,
    ):
        self._repo = repository or default_dispensary_repo
        self._dispatcher = dispatcher or default_dispatcher

    # ── Shared Private Helpers ────────────────────────────────────────────────

    def _lock_request(
        self,
        cur: psycopg2.extras.RealDictCursor,
        dispensary_id: int,
        request_id: int,
        forbidden_statuses: Sequence[str] = (),
        action_label: str = "modify",
    ) -> Dict[str, Any]:
        """Acquire a FOR UPDATE row lock on a request ticket and enforce tenancy & status guards."""
        cur.execute(
            """
            SELECT req.request_id, req.prescription_id, req.dispensary_id, req.patient_id,
                   req.status, req.pickup_code, req.verified_at,
                   p.user_id AS patient_user_id, d.name AS disp_name, d.location
            FROM dispensary_request req
            JOIN patient p ON p.patient_id = req.patient_id
            JOIN dispensary d ON d.dispensary_id = req.dispensary_id
            WHERE req.request_id = %s AND req.dispensary_id = %s
            FOR UPDATE
            """,
            (request_id, dispensary_id),
        )
        req = cur.fetchone()
        if not req:
            raise ValueError(f"Request #{request_id} not found for this dispensary.")
        if req["status"] in forbidden_statuses:
            raise ValueError(f"Cannot {action_label} request in status '{req['status']}'.")
        return dict(req)

    def _reserve_stock(
        self,
        cur: psycopg2.extras.RealDictCursor,
        dispensary_id: int,
        medicine_id: Optional[int],
        qty: int,
        request_id: int,
        txn_note: str,
    ) -> bool:
        """Lock shelf stock and reserve `qty` units if sufficient free stock exists."""
        if not medicine_id or qty <= 0:
            return False

        cur.execute(
            """
            SELECT inventory_id, (available_quantity - reserved_quantity) AS free_stock
            FROM inventory_dispensary_stock
            WHERE dispensary_id = %s AND medicine_id = %s
            FOR UPDATE
            """,
            (dispensary_id, medicine_id),
        )
        inv = cur.fetchone()
        if not inv or (inv["free_stock"] or 0) < qty:
            return False

        cur.execute(
            """
            UPDATE inventory_dispensary_stock
            SET reserved_quantity = reserved_quantity + %s, updated_at = NOW()
            WHERE inventory_id = %s
            """,
            (qty, inv["inventory_id"]),
        )
        cur.execute(
            """
            INSERT INTO inventory_transaction (
                inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
            ) VALUES (%s, %s, %s, 'MEDICINE_RESERVED', %s, %s, %s)
            """,
            (inv["inventory_id"], dispensary_id, medicine_id, qty, request_id, txn_note),
        )
        return True

    def _release_stock(
        self,
        cur: psycopg2.extras.RealDictCursor,
        dispensary_id: int,
        medicine_id: Optional[int],
        qty: int,
        request_id: int,
        txn_note: str,
    ) -> None:
        """Decrement `reserved_quantity` for a single medicine and log RESERVATION_CANCELLED."""
        if not medicine_id or qty <= 0:
            return

        cur.execute(
            """
            UPDATE inventory_dispensary_stock
            SET reserved_quantity = GREATEST(0, reserved_quantity - %s), updated_at = NOW()
            WHERE dispensary_id = %s AND medicine_id = %s
            RETURNING inventory_id
            """,
            (qty, dispensary_id, medicine_id),
        )
        inv_row = cur.fetchone()
        if inv_row:
            cur.execute(
                """
                INSERT INTO inventory_transaction (
                    inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                ) VALUES (%s, %s, %s, 'RESERVATION_CANCELLED', %s, %s, %s)
                """,
                (inv_row["inventory_id"], dispensary_id, medicine_id, qty, request_id, txn_note),
            )

    def _release_all_reservations(
        self,
        cur: psycopg2.extras.RealDictCursor,
        dispensary_id: int,
        request_id: int,
        txn_note: str,
    ) -> None:
        """Release all reserved stock held by items in a ticket (used on cancel / reconsult)."""
        cur.execute(
            """
            SELECT item_id, medicine_id, suggested_substitute_id,
                   COALESCE(dispensed_quantity, required_quantity) AS held_qty
            FROM dispensary_request_item
            WHERE request_id = %s AND reserved = TRUE
            """,
            (request_id,),
        )
        for item in cur.fetchall():
            held_med_id = item["suggested_substitute_id"] or item["medicine_id"]
            self._release_stock(cur, dispensary_id, held_med_id, item["held_qty"], request_id, txn_note)

    def _select_target_dispensary(
        self, cur: psycopg2.extras.RealDictCursor, clinic_id: Optional[int]
    ) -> Optional[Dict[str, Any]]:
        """Pick the clinic's affiliated active dispensary, or fall back to the first active dispensary."""
        if clinic_id:
            cur.execute(
                """
                SELECT d.dispensary_id, d.avg_prep_minutes, d.name AS dispensary_name
                FROM dispensary d
                JOIN clinic_hospital ch ON ch.clinic_id = %s
                WHERE d.status = 'ACTIVE'
                ORDER BY d.dispensary_id ASC
                LIMIT 1
                """,
                (clinic_id,),
            )
            disp = cur.fetchone()
            if disp:
                return dict(disp)

        cur.execute(
            """
            SELECT dispensary_id, avg_prep_minutes, name AS dispensary_name
            FROM dispensary
            WHERE status = 'ACTIVE'
            ORDER BY dispensary_id ASC
            LIMIT 1
            """
        )
        disp = cur.fetchone()
        return dict(disp) if disp else None

    def _check_initial_item_status(
        self, cur: psycopg2.extras.RealDictCursor, dispensary_id: int, pm: Dict[str, Any], required_qty: int = 1
    ) -> str:
        """Determine initial line-item stock status when ingesting a prescription."""
        match_status = pm["match_status"]
        if match_status in ("AMBIGUOUS", "UNRESOLVED", "NOT_A_MEDICINE"):
            return match_status

        med_id = pm["medicine_id"]
        if not med_id:
            return "UNRESOLVED"

        cur.execute(
            """
            SELECT (available_quantity - reserved_quantity) AS free_stock
            FROM inventory_dispensary_stock
            WHERE dispensary_id = %s AND medicine_id = %s
            """,
            (dispensary_id, med_id),
        )
        stock_row = cur.fetchone()
        free_stock = (stock_row["free_stock"] or 0) if stock_row else 0
        if free_stock >= required_qty:
            return "AVAILABLE"
        if free_stock > 0:
            return "PARTIAL"
        return "UNAVAILABLE"

    def _resolve_substitute_medicine(
        self,
        cur: psycopg2.extras.RealDictCursor,
        substitute_medicine_id: Optional[int],
        substitute_name: Optional[str],
    ) -> int:
        """Resolve an explicit substitute ID or look up/register the substitute drug name in `medicine`."""
        if substitute_medicine_id:
            return substitute_medicine_id

        if not substitute_name or not substitute_name.strip():
            raise ValueError("substitute_medicine_id or substitute_name is required when substituting an item.")

        clean_name = substitute_name.strip()
        cur.execute(
            """
            SELECT medicine_id FROM medicine
            WHERE generic_name ILIKE %s OR brand_name ILIKE %s
            LIMIT 1
            """,
            (f"%{clean_name}%", f"%{clean_name}%"),
        )
        found = cur.fetchone()
        if found:
            return found["medicine_id"]

        cur.execute(
            "INSERT INTO medicine (generic_name, form) VALUES (%s, 'TABLET') RETURNING medicine_id",
            (clean_name,),
        )
        return cur.fetchone()["medicine_id"]

    def _resolve_pharmacist_signer(
        self, cur: psycopg2.extras.RealDictCursor, dispensary_id: int, user_id: Optional[int]
    ) -> Tuple[Optional[int], str]:
        """Resolve a valid `users.user_id` and display name for digital verification audit stamps."""
        if user_id:
            cur.execute("SELECT user_id, full_name FROM users WHERE user_id = %s", (user_id,))
            u_row = cur.fetchone()
            if u_row:
                return u_row["user_id"], (u_row["full_name"] or "Staff Pharmacist")

        cur.execute(
            """
            SELECT u.user_id, u.full_name
            FROM users u
            JOIN dispensary d ON LOWER(d.email) = LOWER(u.email)
            WHERE d.dispensary_id = %s
            LIMIT 1
            """,
            (dispensary_id,),
        )
        u_match = cur.fetchone()
        if u_match:
            return u_match["user_id"], (u_match["full_name"] or "Staff Pharmacist")
        return None, "Staff Pharmacist"

    def _fetch_request_details(
        self,
        where_clause: str,
        params: Sequence[Any],
        order_by: str = "",
    ) -> List[Dict[str, Any]]:
        """Execute the canonical nested ticket query used by both dispensary detail and patient history views."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f"{_REQUEST_DETAIL_SELECT} WHERE {where_clause} {order_by}", tuple(params))
                return [_stringify_dates(dict(row), _DETAIL_DATE_FIELDS) for row in cur.fetchall()]

    # ── Public Fulfillment Lifecycle Methods ──────────────────────────────────

    def create_dispensary_request_for_prescription(self, prescription_id: int) -> Optional[Dict[str, Any]]:
        """Create and route a fulfillment ticket when a physician finalizes a prescription.

        Selects an active dispensary, checks free stock for every prescribed medication,
        generates a 6-digit handover OTP, calculates initial ETA, and alerts both patient
        and pharmacy queue screens.
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT rx.prescription_id, rx.patient_id, rx.clinic_id, p.user_id AS patient_user_id
                    FROM prescription rx
                    JOIN patient p ON p.patient_id = rx.patient_id
                    WHERE rx.prescription_id = %s
                    """,
                    (prescription_id,),
                )
                rx = cur.fetchone()
                if not rx:
                    return None

                disp = self._select_target_dispensary(cur, rx["clinic_id"])
                if not disp:
                    logger.warning("No active dispensary found to route prescription #%s", prescription_id)
                    return None

                dispensary_id = disp["dispensary_id"]
                eta_minutes = disp["avg_prep_minutes"] or 15
                dispensary_name = disp["dispensary_name"]

                # Return existing ticket if already routed to this dispensary
                cur.execute(
                    "SELECT request_id FROM dispensary_request WHERE prescription_id = %s AND dispensary_id = %s",
                    (prescription_id, dispensary_id),
                )
                existing = cur.fetchone()
                if existing:
                    return self.get_request_detail(dispensary_id, existing["request_id"])

                estimated_ready_at = datetime.now(timezone.utc) + timedelta(minutes=eta_minutes)
                pickup_code = f"{random.randint(100000, 999999)}"

                cur.execute(
                    """
                    INSERT INTO dispensary_request (
                        prescription_id, dispensary_id, patient_id,
                        status, estimated_ready_at, pickup_code
                    ) VALUES (%s, %s, %s, 'PENDING', %s, %s)
                    RETURNING request_id
                    """,
                    (prescription_id, dispensary_id, rx["patient_id"], estimated_ready_at, pickup_code),
                )
                request_id = cur.fetchone()["request_id"]

                cur.execute(
                    """
                    SELECT prescription_medicine_id, medicine_id, match_status
                    FROM prescription_medicine
                    WHERE prescription_id = %s
                    """,
                    (prescription_id,),
                )
                pm_rows = cur.fetchall()

                item_statuses: List[str] = []
                for pm in pm_rows:
                    avail_status = self._check_initial_item_status(cur, dispensary_id, pm, required_qty=1)
                    item_statuses.append(avail_status)
                    cur.execute(
                        """
                        INSERT INTO dispensary_request_item (
                            request_id, prescription_medicine_id, medicine_id,
                            required_quantity, availability_status
                        ) VALUES (%s, %s, %s, 1, %s)
                        """,
                        (request_id, pm["prescription_medicine_id"], pm["medicine_id"], avail_status),
                    )

                if not item_statuses or all(s == "AVAILABLE" for s in item_statuses):
                    overall_status = "PENDING"
                elif any(s in ("AVAILABLE", "PARTIAL") for s in item_statuses):
                    overall_status = "PARTIALLY_AVAILABLE"
                else:
                    overall_status = "UNAVAILABLE"

                cur.execute(
                    "UPDATE dispensary_request SET status = %s WHERE request_id = %s",
                    (overall_status, request_id),
                )
                conn.commit()

                msg_text = (
                    f"Your prescription #{prescription_id} has been received by {dispensary_name}. "
                    f"Status: {overall_status.replace('_', ' ')}. "
                    f"Est. ready in ~{eta_minutes} mins."
                )
                self._dispatcher.notify_patient(
                    user_id=rx["patient_user_id"],
                    title="Dispensary Prescription Received",
                    message=msg_text,
                )
                self._dispatcher.broadcast_queue_update(
                    dispensary_id,
                    request_id,
                    event="NEW_TICKET",
                    prescription_id=prescription_id,
                    status=overall_status,
                )
                return self.get_request_detail(dispensary_id, request_id)

    def confirm_or_approve_request(
        self,
        dispensary_id: int,
        request_id: int,
        estimated_prep_minutes: Optional[int] = 15,
        pharmacist_notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Confirm an incoming ticket, lock & reserve unreserved shelf stock, and set prep ETA."""
        prep_mins = estimated_prep_minutes if (estimated_prep_minutes and estimated_prep_minutes > 0) else 15
        estimated_ready_at = datetime.now(timezone.utc) + timedelta(minutes=prep_mins)

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                req = self._lock_request(
                    cur, dispensary_id, request_id, forbidden_statuses=("DISPENSED", "CANCELLED"), action_label="approve"
                )

                cur.execute(
                    """
                    SELECT item_id, medicine_id, required_quantity, reserved
                    FROM dispensary_request_item
                    WHERE request_id = %s AND reserved = FALSE
                    """,
                    (request_id,),
                )
                for item in cur.fetchall():
                    if self._reserve_stock(
                        cur, dispensary_id, item["medicine_id"], item["required_quantity"], request_id,
                        "Reserved upon ticket confirmation",
                    ):
                        cur.execute(
                            "UPDATE dispensary_request_item SET reserved = TRUE, availability_status = 'AVAILABLE' WHERE item_id = %s",
                            (item["item_id"],),
                        )

                cur.execute(
                    """
                    UPDATE dispensary_request
                    SET status = 'CONFIRMED',
                        estimated_ready_at = %s,
                        pharmacist_notes = COALESCE(%s, pharmacist_notes),
                        reconsultation_reason = NULL,
                        updated_at = NOW()
                    WHERE request_id = %s
                    """,
                    (estimated_ready_at, pharmacist_notes, request_id),
                )

                notes_addon = f' Note from pharmacist: "{pharmacist_notes}"' if pharmacist_notes else ""
                msg = (
                    f"Your prescription order #{req['prescription_id']} has been APPROVED & CONFIRMED by {req['disp_name']}! "
                    f"Estimated ready in ~{prep_mins} mins.{notes_addon}"
                )
                self._dispatcher.notify_patient(req["patient_user_id"], "Dispensary Order Confirmed", msg)
                conn.commit()

                self._dispatcher.broadcast_queue_update(dispensary_id, request_id)
                return self.get_request_detail(dispensary_id, request_id)

    def process_request(self, dispensary_id: int, request_id: int) -> Dict[str, Any]:
        """Transition ticket to PROCESSING after ensuring stock reservations are locked."""
        self.confirm_or_approve_request(dispensary_id, request_id)
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE dispensary_request SET status = 'PROCESSING', updated_at = NOW() WHERE request_id = %s AND dispensary_id = %s",
                    (request_id, dispensary_id),
                )
                conn.commit()
        return self.get_request_detail(dispensary_id, request_id)

    def request_reconsultation(
        self,
        dispensary_id: int,
        request_id: int,
        reason: str,
        pharmacist_notes: str,
        target: str = "DOCTOR",
        item_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Place order on RECONSULTATION_NEEDED hold, release held stock, and notify patient/doctor."""
        if not pharmacist_notes or not pharmacist_notes.strip():
            raise ValueError("Clinical notes describing the reconsultation reasoning are required.")

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                req = self._lock_request(cur, dispensary_id, request_id, action_label="hold")
                self._release_all_reservations(cur, dispensary_id, request_id, "Released due to reconsultation")

                cur.execute(
                    """
                    UPDATE dispensary_request
                    SET status = 'RECONSULTATION_NEEDED',
                        reconsultation_reason = %s,
                        pharmacist_notes = %s,
                        reconsultation_target = %s,
                        reconsultation_at = NOW(),
                        updated_at = NOW()
                    WHERE request_id = %s
                    """,
                    (reason, pharmacist_notes.strip(), target.upper(), request_id),
                )

                self._dispatcher.notify_patient(
                    req["patient_user_id"],
                    "Doctor Reconsultation Advised by Pharmacist",
                    f"Pharmacist at {req['disp_name']} advises doctor reconsultation for prescription #{req['prescription_id']}: {pharmacist_notes.strip()}",
                )
                conn.commit()

                self._dispatcher.broadcast_queue_update(dispensary_id, request_id)
                return self.get_request_detail(dispensary_id, request_id)

    def mark_request_ready(self, dispensary_id: int, request_id: int) -> Dict[str, Any]:
        """Mark ticket READY for counter collection and notify patient with pickup directions."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                req = self._lock_request(cur, dispensary_id, request_id, action_label="mark ready")

                cur.execute(
                    "UPDATE dispensary_request SET status = 'READY', ready_at = NOW(), updated_at = NOW() WHERE request_id = %s",
                    (request_id,),
                )

                loc_str = f" from {req['location']}" if req.get("location") else ""
                msg = f"Your medicines are READY for collection{loc_str} at {req['disp_name']}!"
                self._dispatcher.notify_patient(req["patient_user_id"], "Medicines Ready for Pickup", msg)
                conn.commit()

                self._dispatcher.broadcast_queue_update(dispensary_id, request_id)
                return self.get_request_detail(dispensary_id, request_id)

    def dispense_request(
        self,
        dispensary_id: int,
        request_id: int,
        items_input: Optional[List[Dict[str, Any]]] = None,
        notes: Optional[str] = None,
        pickup_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Validate 6-digit OTP, permanently deduct physical inventory, and finalize ticket as DISPENSED."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                req = self._lock_request(
                    cur, dispensary_id, request_id, forbidden_statuses=("DISPENSED", "CANCELLED"), action_label="dispense"
                )

                expected_code = (req.get("pickup_code") or "").strip()
                if expected_code and not req.get("verified_at"):
                    if not pickup_code or pickup_code.strip() != expected_code:
                        raise ValueError("Invalid pickup verification code. Please ask the patient for the 6-digit code.")

                cur.execute(
                    """
                    SELECT item_id, medicine_id, suggested_substitute_id, required_quantity, reserved
                    FROM dispensary_request_item
                    WHERE request_id = %s
                    """,
                    (request_id,),
                )
                input_qty_map = {inp["item_id"]: inp.get("dispensed_quantity") for inp in (items_input or [])}

                for item in cur.fetchall():
                    active_med_id = item["suggested_substitute_id"] or item["medicine_id"]
                    disp_qty = input_qty_map.get(item["item_id"])
                    if disp_qty is None:
                        disp_qty = item["required_quantity"]

                    if active_med_id and disp_qty > 0:
                        cur.execute(
                            """
                            SELECT inventory_id, available_quantity, reserved_quantity
                            FROM inventory_dispensary_stock
                            WHERE dispensary_id = %s AND medicine_id = %s
                            FOR UPDATE
                            """,
                            (dispensary_id, active_med_id),
                        )
                        inv = cur.fetchone()
                        if inv:
                            new_avail = max(0, inv["available_quantity"] - disp_qty)
                            new_res = max(0, inv["reserved_quantity"] - (disp_qty if item["reserved"] else 0))
                            cur.execute(
                                """
                                UPDATE inventory_dispensary_stock
                                SET available_quantity = %s, reserved_quantity = %s, updated_at = NOW()
                                WHERE inventory_id = %s
                                """,
                                (new_avail, new_res, inv["inventory_id"]),
                            )
                            cur.execute(
                                """
                                INSERT INTO inventory_transaction (
                                    inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                                ) VALUES (%s, %s, %s, 'MEDICINE_DISPENSED', %s, %s, 'Dispensed to patient')
                                """,
                                (inv["inventory_id"], dispensary_id, active_med_id, disp_qty, request_id),
                            )

                    cur.execute(
                        """
                        UPDATE dispensary_request_item
                        SET dispensed_quantity = %s, reserved = FALSE, availability_status = 'DISPENSED'
                        WHERE item_id = %s
                        """,
                        (disp_qty, item["item_id"]),
                    )

                cur.execute(
                    """
                    UPDATE dispensary_request
                    SET status = 'DISPENSED', dispensed_at = NOW(), notes = COALESCE(%s, notes), updated_at = NOW()
                    WHERE request_id = %s
                    """,
                    (notes, request_id),
                )

                self._dispatcher.notify_patient(
                    req["patient_user_id"],
                    "Prescription Dispensed",
                    "Your prescription has been fulfilled and handed over. Check instructions in your timeline.",
                )
                conn.commit()

                self._dispatcher.broadcast_queue_update(dispensary_id, request_id)
                return self.get_request_detail(dispensary_id, request_id)

    def cancel_request(self, dispensary_id: int, request_id: int, notes: Optional[str] = None) -> Dict[str, Any]:
        """Cancel a non-dispensed ticket and release all held inventory reservations."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                req = self._lock_request(
                    cur, dispensary_id, request_id, forbidden_statuses=("DISPENSED",), action_label="cancel"
                )
                self._release_all_reservations(cur, dispensary_id, request_id, "Request cancelled")

                cur.execute(
                    "UPDATE dispensary_request SET status = 'CANCELLED', notes = %s, updated_at = NOW() WHERE request_id = %s",
                    (notes, request_id),
                )
                self._dispatcher.notify_patient(
                    req["patient_user_id"],
                    "Dispensary Order Cancelled",
                    "Your dispensary request has been cancelled.",
                )
                conn.commit()

                self._dispatcher.broadcast_queue_update(dispensary_id, request_id)
                return self.get_request_detail(dispensary_id, request_id)

    def update_request_item_decision(
        self,
        dispensary_id: int,
        request_id: int,
        item_id: int,
        decision: str,
        quantity: Optional[int] = None,
        substitute_medicine_id: Optional[int] = None,
        substitute_name: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Apply a per-item clinical decision (FULFILL, PARTIAL, SUBSTITUTE, UNAVAILABLE, RECONSULT)."""
        decision_clean = decision.upper().strip()
        valid_decisions = ("FULFILL", "PARTIAL", "SUBSTITUTE", "UNAVAILABLE", "RECONSULT")
        if decision_clean not in valid_decisions:
            raise ValueError(f"Invalid decision '{decision}'. Must be one of {valid_decisions}")

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                req = self._lock_request(
                    cur, dispensary_id, request_id, forbidden_statuses=("DISPENSED", "CANCELLED"), action_label="update item decisions for"
                )
                cur.execute(
                    """
                    SELECT item_id, medicine_id, suggested_substitute_id, required_quantity,
                           dispensed_quantity, reserved
                    FROM dispensary_request_item
                    WHERE item_id = %s AND request_id = %s
                    FOR UPDATE
                    """,
                    (item_id, request_id),
                )
                item = cur.fetchone()
                if not item:
                    raise ValueError(f"Item #{item_id} not found for this request.")

                med_id = item["medicine_id"]
                held_med_id = item["suggested_substitute_id"] or med_id
                held_qty = item["dispensed_quantity"] or item["required_quantity"]
                target_qty = quantity if (quantity is not None and quantity > 0) else item["required_quantity"]

                if decision_clean in ("FULFILL", "PARTIAL"):
                    if not item["reserved"]:
                        self._reserve_stock(
                            cur, dispensary_id, med_id, target_qty, request_id, f"Item #{item_id}: {decision_clean}"
                        )
                    status_label = "AVAILABLE" if decision_clean == "FULFILL" else "PARTIAL"
                    cur.execute(
                        """
                        UPDATE dispensary_request_item
                        SET availability_status = %s, dispensed_quantity = %s, reserved = TRUE,
                            reconsultation_needed = FALSE, notes = COALESCE(%s, notes)
                        WHERE item_id = %s
                        """,
                        (status_label, target_qty, notes, item_id),
                    )

                elif decision_clean == "SUBSTITUTE":
                    sub_med_id = self._resolve_substitute_medicine(cur, substitute_medicine_id, substitute_name)
                    if item["reserved"]:
                        self._release_stock(
                            cur, dispensary_id, held_med_id, held_qty, request_id, f"Released on substitution of item #{item_id}"
                        )
                    self._reserve_stock(
                        cur, dispensary_id, sub_med_id, target_qty, request_id, f"Substituted for item #{item_id}"
                    )
                    cur.execute(
                        """
                        UPDATE dispensary_request_item
                        SET suggested_substitute_id = %s, dispensed_quantity = %s, availability_status = 'SUBSTITUTED',
                            reserved = TRUE, reconsultation_needed = FALSE,
                            notes = COALESCE(%s, 'Pharmacist proposed substitute')
                        WHERE item_id = %s
                        """,
                        (sub_med_id, target_qty, notes, item_id),
                    )

                else:  # UNAVAILABLE or RECONSULT
                    if item["reserved"]:
                        self._release_stock(
                            cur, dispensary_id, held_med_id, held_qty, request_id, f"Released ({decision_clean}) on item #{item_id}"
                        )
                    if decision_clean == "UNAVAILABLE":
                        cur.execute(
                            """
                            UPDATE dispensary_request_item
                            SET availability_status = 'UNAVAILABLE', dispensed_quantity = 0, reserved = FALSE,
                                notes = COALESCE(%s, notes)
                            WHERE item_id = %s
                            """,
                            (notes, item_id),
                        )
                    else:
                        cur.execute(
                            """
                            UPDATE dispensary_request_item
                            SET availability_status = 'RECONSULTATION_NEEDED', reconsultation_needed = TRUE,
                                reconsultation_notes = COALESCE(%s, 'Doctor reconsultation advised'), reserved = FALSE
                            WHERE item_id = %s
                            """,
                            (notes, item_id),
                        )

                # Recalibrate overall ticket status from updated line items
                cur.execute(
                    "SELECT availability_status, reconsultation_needed FROM dispensary_request_item WHERE request_id = %s",
                    (request_id,),
                )
                all_items = cur.fetchall()
                statuses = [it["availability_status"] for it in all_items]

                if any(it["reconsultation_needed"] for it in all_items) and not any(
                    s in ("AVAILABLE", "SUBSTITUTED") for s in statuses
                ):
                    new_status = "RECONSULTATION_NEEDED"
                elif all(s in ("AVAILABLE", "SUBSTITUTED", "DISPENSED") for s in statuses):
                    new_status = (
                        "CONFIRMED"
                        if req["status"] in ("PENDING", "PARTIALLY_AVAILABLE", "UNAVAILABLE")
                        else req["status"]
                    )
                elif any(s in ("AVAILABLE", "SUBSTITUTED", "PARTIAL") for s in statuses):
                    new_status = "PARTIALLY_AVAILABLE"
                else:
                    new_status = "UNAVAILABLE"

                cur.execute(
                    "UPDATE dispensary_request SET status = %s, updated_at = NOW() WHERE request_id = %s",
                    (new_status, request_id),
                )
                conn.commit()

                self._dispatcher.broadcast_queue_update(dispensary_id, request_id)
                return self.get_request_detail(dispensary_id, request_id)

    def verify_prescription(
        self,
        dispensary_id: int,
        request_id: int,
        user_id: Optional[int] = None,
        patient_checked: bool = True,
        dosage_checked: bool = True,
        interactions_checked: bool = True,
        notes: Optional[str] = None,
        pickup_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record 4-point clinical verification audit checklist and authenticate handover OTP."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                row = self._lock_request(cur, dispensary_id, request_id, action_label="verify")

                expected_code = (row.get("pickup_code") or "").strip()
                if expected_code and (not pickup_code or pickup_code.strip() != expected_code):
                    raise ValueError(
                        "Invalid 6-digit pickup verification code. Please request the handover OTP from the patient."
                    )

                valid_user_id, pharmacist_name = self._resolve_pharmacist_signer(cur, dispensary_id, user_id)
                sig = f"RXF-V-{request_id}-{dispensary_id}-{int(time.time())}"
                checklist = {
                    "patient_identity_checked": patient_checked,
                    "dosage_validity_checked": dosage_checked,
                    "interactions_cleared": interactions_checked,
                    "pickup_code_verified": True,
                    "verified_by_user_id": valid_user_id,
                    "pharmacist_name": pharmacist_name,
                    "verified_at": datetime.now(timezone.utc).isoformat(),
                    "notes": notes,
                }

                cur.execute(
                    """
                    UPDATE dispensary_request
                    SET verified_by_user_id = %s, verified_at = NOW(),
                        verification_signature = %s, verification_checklist = %s::jsonb, updated_at = NOW()
                    WHERE request_id = %s
                    """,
                    (valid_user_id, sig, json.dumps(checklist), request_id),
                )
                conn.commit()

                self._dispatcher.broadcast_queue_update(dispensary_id, request_id)
                return self.get_request_detail(dispensary_id, request_id)

    def get_dispensary_queue(self, dispensary_id: int, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve FIFO chronological order queue for a dispensary, optionally filtered by status."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                where_extra = ""
                params: list[Any] = [dispensary_id]
                if status_filter and status_filter.upper() != "ALL":
                    where_extra = "AND req.status = %s"
                    params.append(status_filter.upper())

                cur.execute(
                    f"""
                    SELECT
                        req.request_id, req.prescription_id, req.patient_id,
                        u.full_name         AS patient_name,
                        pt.patient_code,
                        req.status, req.estimated_ready_at, req.pickup_code,
                        req.notes, req.pharmacist_notes,
                        req.reconsultation_reason, req.reconsultation_target, req.reconsultation_at,
                        req.verified_by_user_id, req.verified_at, req.verification_signature, req.verification_checklist,
                        verif_u.full_name   AS verified_by_name,
                        req.created_at,
                        COUNT(item.item_id) AS total_items
                    FROM dispensary_request req
                    JOIN patient pt  ON pt.patient_id = req.patient_id
                    JOIN users   u   ON u.user_id     = pt.user_id
                    LEFT JOIN users verif_u ON verif_u.user_id = req.verified_by_user_id
                    LEFT JOIN dispensary_request_item item ON item.request_id = req.request_id
                    WHERE req.dispensary_id = %s {where_extra}
                    GROUP BY req.request_id, u.full_name, pt.patient_code, verif_u.full_name
                    ORDER BY req.created_at ASC
                    """,
                    params,
                )
                return [_stringify_dates(dict(row), _QUEUE_DATE_FIELDS) for row in cur.fetchall()]

    def get_request_detail(self, dispensary_id: Optional[int], request_id: int) -> Optional[Dict[str, Any]]:
        """Load the full clinical, demographic, and line-item graph for one fulfillment ticket."""
        where_clause = "req.request_id = %s AND req.dispensary_id = %s" if dispensary_id else "req.request_id = %s"
        params = (request_id, dispensary_id) if dispensary_id else (request_id,)
        results = self._fetch_request_details(where_clause, params)
        return results[0] if results else None

    def get_patient_dispensary_requests(self, patient_id: int) -> List[Dict[str, Any]]:
        """Fetch reverse-chronological fulfillment orders and pickup codes for a patient."""
        return self._fetch_request_details("req.patient_id = %s", (patient_id,), order_by="ORDER BY req.created_at DESC")


default_fulfillment_service = OrderFulfillmentService()
