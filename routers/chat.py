"""Chat API endpoints — doctor ↔ patient messaging.

All routes require a valid JWT (any role).
Assignment enforcement happens inside the service layer.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from core.security import get_current_user
from models.schemas import SendMessage
from services import chat as chat_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/send", status_code=status.HTTP_201_CREATED)
def send_message(
    body: SendMessage,
    current_user: dict = Depends(get_current_user),
):
    """Send a message to another user.

    The sender and receiver must share an active doctor-patient assignment.
    Returns the created message on success, 403 if not assigned.

    **Access:** Any authenticated user.
    """
    message = chat_service.send_message(
        sender_id=current_user["id"],
        receiver_id=body.receiver_id,
        body=body.body,
    )
    if message is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not in an active assignment with this user.",
        )
    return message


@router.get("/conversation/{other_user_id}")
def get_conversation(
    other_user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Fetch the last 15 messages between you and another user, oldest-first.

    Calling this endpoint automatically marks all incoming messages from
    that user as read.

    Returns 403 if no active assignment exists with that user.

    **Access:** Any authenticated user.
    """
    if not chat_service._are_assigned(current_user["id"], other_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not in an active assignment with this user.",
        )
    messages = chat_service.get_conversation(
        user_a=current_user["id"],
        user_b=other_user_id,
    )
    return {"messages": messages, "total": len(messages)}


@router.get("/unread/{other_user_id}")
def check_unread(
    other_user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Check whether the other user has sent you any unread messages.

    Returns `{ "has_unread": true/false }`.
    Intended to be polled by the frontend every few seconds.

    Returns 403 if no active assignment exists with that user.

    **Access:** Any authenticated user.
    """
    # If not assigned, the service returns False — but we want a 403 in that case
    if not chat_service._are_assigned(current_user["id"], other_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not in an active assignment with this user.",
        )
    return {"has_unread": chat_service.has_unread(current_user["id"], other_user_id)}
