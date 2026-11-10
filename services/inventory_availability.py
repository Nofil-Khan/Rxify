"""Inventory Availability Service Facade (Backwards-Compatible Interface).

Delegates inventory stock availability checks to the OOP InventoryAvailabilityService
under services.dispensary.
"""

from __future__ import annotations
from typing import Any, Dict, List

from services.dispensary.availability_service import (
    STATUS_AVAILABLE,
    STATUS_NOT_AVAILABLE,
    STATUS_UNRESOLVED,
    default_availability_service,
)

__all__ = [
    "STATUS_AVAILABLE",
    "STATUS_NOT_AVAILABLE",
    "STATUS_UNRESOLVED",
    "get_medicine_availability",
    "get_prescription_availability",
]


def get_medicine_availability(
    dispensary_id: int,
    medicine_id: int,
) -> Dict[str, Any]:
    return default_availability_service.get_medicine_availability(dispensary_id, medicine_id)


def get_prescription_availability(
    dispensary_id: int,
    medicines: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return default_availability_service.get_prescription_availability(dispensary_id, medicines)
