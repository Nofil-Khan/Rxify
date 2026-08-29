"""FastAPI router for doctor-patient direct messaging."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.security import get_current_user
from services import chat as chat_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


class SendMessageSchema(BaseModel):
    receiver_id: int = Field(..., description="User ID of the recipient")
    message_text: str = Field(..., min_length=1, max_length=5000, description="Text content of the message")


@router.get("/conversations")
def list_conversations(
    current_user: dict = Depends(get_current_user),
):
    """Return all active chat conversations for the logged-in user."""
    return {"conversations": chat_service.get_conversations(current_user["id"])}


@router.get("/messages/{other_user_id}")
def get_chat_messages(
    other_user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Return message trajectory between logged-in user and other_user_id."""
    messages = chat_service.get_chat_history(current_user["id"], other_user_id)
    return {
        "user_id": current_user["id"],
        "other_user_id": other_user_id,
        "messages": messages,
    }


@router.post("/send", status_code=status.HTTP_201_CREATED)
def send_message(
    body: SendMessageSchema,
    current_user: dict = Depends(get_current_user),
):
    """Send a message to a connected user."""
    if body.receiver_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send a message to yourself.",
        )

    try:
        msg = chat_service.send_chat_message(
            sender_id=current_user["id"],
            receiver_id=body.receiver_id,
            message_text=body.message_text,
        )
        return {"message": "Message sent successfully.", "data": msg}
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
