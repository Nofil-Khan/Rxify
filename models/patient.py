"""Patient-related Pydantic schemas.

Used by routers/patient.py for doctor connection requests and patient-facing actions.
"""

from pydantic import BaseModel


class RequestDoctorAssignment(BaseModel):
    """Request body for a patient sending a connection request to a doctor."""
    doctor_id: int
