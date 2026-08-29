"""Dispensary API endpoints — /api/dispensary/...

Placeholder — dispensary inventory and prescription fulfillment endpoints
will be implemented here when the dispensary feature is built out.

Planned endpoints:
  GET  /api/dispensary/stock               — list available medicines
  GET  /api/dispensary/requests            — view pending dispensary requests
  POST /api/dispensary/requests/{id}/fulfill — mark a request as fulfilled
"""

from __future__ import annotations

from fastapi import APIRouter

from core.security import require_role  # noqa: F401 — will be used by future endpoints

router = APIRouter(prefix="/api/dispensary", tags=["dispensary"])


# TODO: Implement dispensary endpoints
