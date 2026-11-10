"""Rxify Services Domain Layer — Central Service Registry.

Exposes domain packages and their default singleton services:
  - auth: Authentication, credential verification, and user management.
  - appointments: Doctor slot scheduling, patient booking, and status workflows.
  - clinical: AI-driven medication matching and fuzzy canonical normalization.
  - clinical_ops: Hospital enterprise and doctor caseload operations.
  - dispensary: Discovery, stock availability, fulfillment, and pharmacy telemetry.
  - patient_care: Patient profile, timeline, adherence, and reconciliation.
  - prescription: OCR ingestion, parsing, and clinical dosage schedules.
  - chat: Direct patient-doctor messaging with read tracking.
  - sharing: Cryptographic tokenized prescription sharing.
"""

from __future__ import annotations

# Domain service instances
from services.auth import default_auth_service, default_user_repo
from services.appointments import default_appointment_service, default_slot_matcher
from services.clinical import default_matcher_service, default_ai_fallback_service
from services.clinical_ops import default_doctor_service, default_hospital_service
from services.dispensary import (
    default_discovery_service,
    default_availability_service,
    default_order_service,
    default_stats_service,
)
from services.patient_care import (
    default_care_service,
    default_timeline_service,
    default_reconciliation_service,
    default_patient_repo,
)
from services.prescription import default_prescription_service
from services.chat import default_chat_service, default_chat_repo
from services.sharing import default_sharing_service, default_sharing_repo
from services.websocket_manager import manager as websocket_manager

__all__ = [
    # Auth
    "default_auth_service",
    "default_user_repo",
    # Appointments
    "default_appointment_service",
    "default_slot_matcher",
    # Clinical & AI
    "default_matcher_service",
    "default_ai_fallback_service",
    # Clinical Operations
    "default_doctor_service",
    "default_hospital_service",
    # Dispensary
    "default_discovery_service",
    "default_availability_service",
    "default_order_service",
    "default_stats_service",
    # Patient Care
    "default_care_service",
    "default_timeline_service",
    "default_reconciliation_service",
    "default_patient_repo",
    # Prescription
    "default_prescription_service",
    # Chat & Messaging
    "default_chat_service",
    "default_chat_repo",
    # Prescription Sharing
    "default_sharing_service",
    "default_sharing_repo",
    # WebSockets
    "websocket_manager",
]
