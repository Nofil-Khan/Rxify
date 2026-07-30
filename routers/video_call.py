"""Video call API endpoints — LiveKit room scheduling and token generation.

Doctors schedule calls; both doctor and patient fetch tokens to join.
All routes require a valid JWT. Role enforcement is applied per-endpoint.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from core.config import LIVEKIT_URL
from core.security import get_current_user, require_role
from models.schemas import ScheduleVideoCall
from services import video_call as vc_service

router = APIRouter(prefix="/api/video-call", tags=["video-call"])


@router.post("/schedule", status_code=status.HTTP_201_CREATED)
async def schedule_video_call(
    body: ScheduleVideoCall,
    current_user: dict = Depends(require_role("doctor")),
):
    """Schedule a video call with an assigned patient and notify them via chat.

    Creates a LiveKit room session and sends a `video_call` message to the
    patient's chat inbox so they can see the invite and join at the right time.

    Returns the `room_name` the frontend uses to fetch a join token.

    **Access:** Doctor only.
    """
    result = vc_service.schedule_call(
        doctor_id=current_user["id"],
        patient_id=body.patient_id,
        scheduled_at=body.scheduled_at,
        note=body.note,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not in an active assignment with this patient.",
        )
    return {
        "message": "Video call scheduled. Patient has been notified.",
        "room_name": result["room_name"],
        "scheduled_at": result["scheduled_at"],
    }


@router.get("/token/{room_name}")
def get_join_token(
    room_name: str,
    current_user: dict = Depends(get_current_user),
):
    """Generate a LiveKit JWT for the caller to join the video call room.

    Both the doctor and the patient can call this endpoint.
    Returns 404 if the session does not exist.
    Returns 403 if the caller is not a participant in this session.

    The frontend uses the returned `token` + `livekit_url` to connect
    directly to LiveKit via the JS client SDK.

    **Access:** Any authenticated user (must be a session participant).
    """
    token = vc_service.generate_token(
        room_name=room_name,
        user_id=current_user["id"],
        username=current_user.get("display_name") or current_user["username"],
    )
    if token is None:
        # Distinguish "not found" from "not authorised" only loosely
        # (don't reveal whether the room exists to unauthorised callers)
        session = vc_service.get_session(room_name, current_user["id"])
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video call session not found.",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this video call.",
        )
    return {
        "token": token,
        "livekit_url": LIVEKIT_URL,
        "room_name": room_name,
    }


@router.get("/session/{room_name}")
def get_session(
    room_name: str,
    current_user: dict = Depends(get_current_user),
):
    """Return metadata for a video call session.

    Returns 404 if not found or caller is not a participant.

    **Access:** Any authenticated user (must be a session participant).
    """
    session = vc_service.get_session(room_name, current_user["id"])
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video call session not found or access denied.",
        )
    return session
