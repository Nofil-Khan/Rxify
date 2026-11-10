"""Dispensary Domain Service & Inventory Management Package.

Exposes domain entities, service classes, repositories, and backwards-compatible facades.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.dispensary.domain import (
    AvailabilityStatus,
    DispensaryOrder,
    DispensaryProfile,
    DispensaryRequestItem,
    RequestStatus,
    StockItem,
    StockStatus,
)
from services.dispensary.dispatcher import DispensaryNotificationDispatcher, default_dispatcher
from services.dispensary.repository import DispensaryRepository, default_dispensary_repo
from services.dispensary.stock_service import StockAllocationService, default_stock_service
from services.dispensary.fulfillment_service import OrderFulfillmentService, default_fulfillment_service
from services.dispensary.analytics_service import DispensaryAnalyticsService, default_analytics_service
from services.dispensary.availability_service import InventoryAvailabilityService, default_availability_service
from services.dispensary.discovery_service import DispensaryDiscoveryService, default_discovery_service

# Service Aliases for consistency across domains
default_order_service = default_fulfillment_service
default_stats_service = default_analytics_service



# ── Backwards-Compatible Functional Facade ───────────────────────────────────

def _broadcast_queue_update(
    dispensary_id: int,
    request_id: int,
    event: str = "STATUS_CHANGED",
    prescription_id: Optional[int] = None,
    status: Optional[str] = None,
) -> None:
    default_dispatcher.broadcast_queue_update(dispensary_id, request_id, event, prescription_id, status)


def create_dispensary(
    hospital_id: Optional[int] = None,
    name: str = "",
    email: str = "",
    password: str = "",
    phone: Optional[str] = None,
    location: Optional[str] = None,
    operating_hours: Optional[str] = None,
    avg_prep_minutes: int = 15,
) -> Optional[Dict[str, Any]]:
    return default_dispensary_repo.create_dispensary(
        hospital_id=hospital_id,
        name=name,
        email=email,
        password=password,
        phone=phone,
        location=location,
        operating_hours=operating_hours,
        avg_prep_minutes=avg_prep_minutes,
    )


def authenticate_dispensary(email: str, password: str) -> Optional[Dict[str, Any]]:
    from services.auth.auth_service import default_auth_service
    res = default_auth_service.authenticate_dispensary(email, password)
    if not res:
        return None
    return default_dispensary_repo.get_by_email(email)


def get_dispensary_by_email(email: str) -> Optional[Dict[str, Any]]:
    return default_dispensary_repo.get_by_email(email)


def get_dispensary_by_id(dispensary_id: int) -> Optional[Dict[str, Any]]:
    return default_dispensary_repo.get_by_id(dispensary_id)


def list_dispensaries_by_hospital(hospital_id: int) -> List[Dict[str, Any]]:
    return default_dispensary_repo.list_by_hospital(hospital_id)


def update_dispensary_location(
    dispensary_id: int,
    latitude: float,
    longitude: float,
    address: Optional[str],
) -> Optional[Dict[str, Any]]:
    return default_dispensary_repo.update_location(dispensary_id, latitude, longitude, address)


def get_inventory_stock(dispensary_id: int) -> List[Dict[str, Any]]:
    return default_stock_service.get_inventory_stock(dispensary_id)


def add_or_update_stock(
    dispensary_id: int,
    medicine_id: int,
    available_quantity: int,
    reorder_level: int = 10,
    unit: Optional[str] = "units",
) -> Dict[str, Any]:
    return default_stock_service.add_or_update_stock(
        dispensary_id=dispensary_id,
        medicine_id=medicine_id,
        available_quantity=available_quantity,
        reorder_level=reorder_level,
        unit=unit,
    )


def bulk_add_or_update_stock(
    dispensary_id: int,
    items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return default_stock_service.bulk_add_or_update_stock(dispensary_id, items)


def import_stock_from_csv(dispensary_id: int, csv_content: str) -> Dict[str, Any]:
    return default_stock_service.import_stock_from_csv(dispensary_id, csv_content)


def update_stock_partial(
    dispensary_id: int,
    inventory_id: int,
    available_quantity: Optional[int] = None,
    reorder_level: Optional[int] = None,
    unit: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    return default_stock_service.update_stock_partial(
        dispensary_id=dispensary_id,
        inventory_id=inventory_id,
        available_quantity=available_quantity,
        reorder_level=reorder_level,
        unit=unit,
    )


def create_dispensary_request_for_prescription(prescription_id: int) -> Optional[Dict[str, Any]]:
    return default_fulfillment_service.create_dispensary_request_for_prescription(prescription_id)


def confirm_or_approve_request(
    dispensary_id: int,
    request_id: int,
    estimated_prep_minutes: Optional[int] = 15,
    pharmacist_notes: Optional[str] = None,
) -> Dict[str, Any]:
    return default_fulfillment_service.confirm_or_approve_request(
        dispensary_id=dispensary_id,
        request_id=request_id,
        estimated_prep_minutes=estimated_prep_minutes,
        pharmacist_notes=pharmacist_notes,
    )


def process_request(dispensary_id: int, request_id: int) -> Dict[str, Any]:
    return default_fulfillment_service.process_request(dispensary_id, request_id)


def request_reconsultation(
    dispensary_id: int,
    request_id: int,
    reason: str,
    pharmacist_notes: str,
    target: str = "DOCTOR",
    item_ids: Optional[List[int]] = None,
) -> Dict[str, Any]:
    return default_fulfillment_service.request_reconsultation(
        dispensary_id=dispensary_id,
        request_id=request_id,
        reason=reason,
        pharmacist_notes=pharmacist_notes,
        target=target,
        item_ids=item_ids,
    )


def mark_request_ready(dispensary_id: int, request_id: int) -> Dict[str, Any]:
    return default_fulfillment_service.mark_request_ready(dispensary_id, request_id)


def dispense_request(
    dispensary_id: int,
    request_id: int,
    items_input: Optional[List[Dict[str, Any]]] = None,
    notes: Optional[str] = None,
    pickup_code: Optional[str] = None,
) -> Dict[str, Any]:
    return default_fulfillment_service.dispense_request(
        dispensary_id=dispensary_id,
        request_id=request_id,
        items_input=items_input,
        notes=notes,
        pickup_code=pickup_code,
    )


def cancel_request(dispensary_id: int, request_id: int, notes: Optional[str] = None) -> Dict[str, Any]:
    return default_fulfillment_service.cancel_request(dispensary_id, request_id, notes)


def get_dispensary_queue(dispensary_id: int, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    return default_fulfillment_service.get_dispensary_queue(dispensary_id, status_filter)


def get_request_detail(dispensary_id: Optional[int], request_id: int) -> Optional[Dict[str, Any]]:
    return default_fulfillment_service.get_request_detail(dispensary_id, request_id)


def get_patient_dispensary_requests(patient_id: int) -> List[Dict[str, Any]]:
    return default_fulfillment_service.get_patient_dispensary_requests(patient_id)


def get_dashboard_stats(dispensary_id: int) -> Dict[str, Any]:
    return default_analytics_service.get_dashboard_stats(dispensary_id)


def get_inventory_alerts(dispensary_id: int) -> Dict[str, Any]:
    return default_stock_service.get_inventory_alerts(dispensary_id)


def get_dispensary_analytics(dispensary_id: int, days: int = 30) -> Dict[str, Any]:
    return default_analytics_service.get_dispensary_analytics(dispensary_id, days)


def update_request_item_decision(
    dispensary_id: int,
    request_id: int,
    item_id: int,
    decision: str,
    quantity: Optional[int] = None,
    substitute_medicine_id: Optional[int] = None,
    substitute_name: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    return default_fulfillment_service.update_request_item_decision(
        dispensary_id=dispensary_id,
        request_id=request_id,
        item_id=item_id,
        decision=decision,
        quantity=quantity,
        substitute_medicine_id=substitute_medicine_id,
        substitute_name=substitute_name,
        notes=notes,
    )


def verify_prescription(
    dispensary_id: int,
    request_id: int,
    user_id: Optional[int] = None,
    patient_checked: bool = True,
    dosage_checked: bool = True,
    interactions_checked: bool = True,
    notes: Optional[str] = None,
    pickup_code: Optional[str] = None,
) -> Dict[str, Any]:
    return default_fulfillment_service.verify_prescription(
        dispensary_id=dispensary_id,
        request_id=request_id,
        user_id=user_id,
        patient_checked=patient_checked,
        dosage_checked=dosage_checked,
        interactions_checked=interactions_checked,
        notes=notes,
        pickup_code=pickup_code,
    )


def get_inventory_transactions(
    dispensary_id: int,
    medicine_id: Optional[int] = None,
    txn_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    return default_stock_service.get_inventory_transactions(
        dispensary_id=dispensary_id,
        medicine_id=medicine_id,
        txn_type=txn_type,
        limit=limit,
        offset=offset,
    )


def lookup_code(dispensary_id: int, code: str) -> Optional[Dict[str, Any]]:
    return default_discovery_service.lookup_code(dispensary_id, code)


def search_master_catalog(query: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
    return default_discovery_service.search_master_catalog(query, limit)


__all__ = [
    # Domain Models & Enums
    "AvailabilityStatus",
    "DispensaryOrder",
    "DispensaryProfile",
    "DispensaryRequestItem",
    "RequestStatus",
    "StockItem",
    "StockStatus",
    # OOP Services & Repositories
    "DispensaryAnalyticsService",
    "DispensaryDiscoveryService",
    "DispensaryNotificationDispatcher",
    "DispensaryRepository",
    "OrderFulfillmentService",
    "StockAllocationService",
    # Default Instances
    "default_analytics_service",
    "default_discovery_service",
    "default_dispatcher",
    "default_dispensary_repo",
    "default_fulfillment_service",
    "default_order_service",
    "default_stats_service",
    "default_stock_service",

    # Facade Functions
    "_broadcast_queue_update",
    "add_or_update_stock",
    "authenticate_dispensary",
    "bulk_add_or_update_stock",
    "cancel_request",
    "confirm_or_approve_request",
    "create_dispensary",
    "create_dispensary_request_for_prescription",
    "dispense_request",
    "get_dashboard_stats",
    "get_dispensary_analytics",
    "get_dispensary_by_email",
    "get_dispensary_by_id",
    "get_dispensary_queue",
    "get_inventory_alerts",
    "get_inventory_stock",
    "get_inventory_transactions",
    "get_patient_dispensary_requests",
    "get_request_detail",
    "import_stock_from_csv",
    "list_dispensaries_by_hospital",
    "lookup_code",
    "mark_request_ready",
    "process_request",
    "request_reconsultation",
    "search_master_catalog",
    "update_dispensary_location",
    "update_request_item_decision",
    "update_stock_partial",
    "verify_prescription",
]

