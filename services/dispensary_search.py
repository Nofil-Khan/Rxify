"""Dispensary Discovery & Routing Facade (Backwards-Compatible Interface).

Delegates geospatial dispensary discovery, ranking, and fulfillment routing to
DispensaryDiscoveryService under services.dispensary.
"""

from __future__ import annotations
from typing import Any, Dict, Optional

from services.dispensary.discovery_service import (
    haversine_distance,
    calculate_dispensary_rank,
    default_discovery_service,
)

__all__ = [
    "haversine_distance",
    "calculate_dispensary_rank",
    "find_nearby_dispensaries",
    "route_prescription_fulfillment",
    "cancel_patient_request",
]


def find_nearby_dispensaries(
    latitude: float,
    longitude: float,
    radius_km: float = 25.0,
    prescription_id: Optional[int] = None,
    patient_user_id: Optional[int] = None,
    top_k: Optional[int] = None,
) -> Dict[str, Any]:
    return default_discovery_service.find_nearby_dispensaries(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        prescription_id=prescription_id,
        patient_user_id=patient_user_id,
        top_k=top_k,
    )


def route_prescription_fulfillment(
    prescription_id: int,
    dispensary_id: int,
    patient_user_id: int,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    return default_discovery_service.route_prescription_fulfillment(
        prescription_id=prescription_id,
        dispensary_id=dispensary_id,
        patient_user_id=patient_user_id,
        notes=notes,
    )


def cancel_patient_request(
    request_id: int,
    patient_user_id: int,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    return default_discovery_service.cancel_patient_request(
        request_id=request_id,
        patient_user_id=patient_user_id,
        reason=reason,
    )
