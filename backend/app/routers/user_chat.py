from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_, and_
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models import User, UserChatRoom, UserChatRoomMember, UserChatMessage
from app.auth import get_current_active_user
from app.schemas.user_chat import (
    ChatRoomCreate, ChatRoomResponse, 
    ChatMessageCreate, ChatMessageResponse, ChatMessageUpdate
)
from app.services.encryption_service import (
    generate_room_dek, encrypt_room_dek, decrypt_message, encrypt_message
)
from app.services.sqs_service import SQSService

router = APIRouter()
sqs_service = SQSService()

def get_room_or_404(db: Session, room_id: int, user_id: int) -> UserChatRoom:
    """Helper to get a room and ensure the user is an active member."""
    room = db.query(UserChatRoom).filter(UserChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
        
    member = db.query(UserChatRoomMember).filter(
        UserChatRoomMember.room_id == room_id,
        UserChatRoomMember.user_id == user_id,
        UserChatRoomMember.left_at.is_(None)
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="You are not an active member of this room")
        
    return room, member

@router.post("/rooms", response_model=ChatRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_room(
    room_in: ChatRoomCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new 1-on-1 DM or Group Chat room."""
    # Ensure current user is in participants
    participants = set(room_in.participant_ids)
    participants.add(current_user.id)
    
    if not room_in.is_group and len(participants) != 2:
        raise HTTPException(status_code=400, detail="A DM must have exactly 2 participants")
        
    # Check if a 1-on-1 DM already exists between these two users
    if not room_in.is_group:
        p_list = list(participants)
        # Find rooms that have exactly these two users and are not groups
        existing_room = db.query(UserChatRoom).join(UserChatRoomMember).filter(
            UserChatRoom.is_group == False,
            UserChatRoom.id.in_(
                db.query(UserChatRoomMember.room_id)
                .filter(UserChatRoomMember.user_id.in_(p_list))
                .group_by(UserChatRoomMember.room_id)
                .having(func.count(UserChatRoomMember.user_id) == 2)
            )
        ).first()
        
        if existing_room:
            # Re-activate if someone had left
            for p_id in p_list:
                member = db.query(UserChatRoomMember).filter_by(room_id=existing_room.id, user_id=p_id).first()
                if member and member.left_at:
                    member.left_at = None
                    member.joined_at = func.now()
            db.commit()
            db.refresh(existing_room)
            return existing_room

    # Generate and encrypt the unique Room DEK
    plaintext_dek = generate_room_dek()
    encrypted_dek = encrypt_room_dek(plaintext_dek)
    
    # Create the room
    new_room = UserChatRoom(
        is_group=room_in.is_group,
        name=room_in.name if room_in.is_group else None,
        encrypted_dek=encrypted_dek,
        created_by_id=current_user.id
    )
    db.add(new_room)
    db.flush()
    
    # Add participants
    for user_id in participants:
        # Validate user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=400, detail=f"User ID {user_id} not found")
            
        role = "ADMIN" if user_id == current_user.id and room_in.is_group else "MEMBER"
        member = UserChatRoomMember(
            room_id=new_room.id,
            user_id=user_id,
            role=role
        )
        db.add(member)
        
    db.commit()
    db.refresh(new_room)
    return new_room

@router.get("/rooms", response_model=List[ChatRoomResponse])
async def list_chat_rooms(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all active chat rooms for the current user with unread counts."""
    # Find all rooms where user is an active member
    active_memberships = db.query(UserChatRoomMember).filter(
        UserChatRoomMember.user_id == current_user.id,
        UserChatRoomMember.left_at.is_(None)
    ).all()
    
    room_ids = [m.room_id for m in active_memberships]
    if not room_ids:
        return []
        
    rooms = db.query(UserChatRoom).options(
        joinedload(UserChatRoom.members).joinedload(UserChatRoomMember.user)
    ).filter(UserChatRoom.id.in_(room_ids)).order_by(desc(UserChatRoom.last_activity_at)).all()
    
    # Calculate unread counts
    for room in rooms:
        member_record = next((m for m in active_memberships if m.room_id == room.id), None)
        if member_record:
            unread_count = db.query(func.count(UserChatMessage.id)).filter(
                UserChatMessage.room_id == room.id,
                UserChatMessage.created_at > member_record.last_read_at,
                UserChatMessage.created_at >= member_record.joined_at, # Don't count messages before they joined
                UserChatMessage.sender_id != current_user.id # Don't count own messages
            ).scalar()
            room.unread_count = unread_count
            
    return rooms

@router.post("/rooms/{room_id}/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    room_id: int,
    message_in: ChatMessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Send a new encrypted message to a room."""
    room, member = get_room_or_404(db, room_id, current_user.id)
    
    # Encrypt the message content
    ciphertext = encrypt_message(message_in.content, room.encrypted_dek)
    
    # Create the message
    new_message = UserChatMessage(
        room_id=room_id,
        sender_id=current_user.id,
        content=ciphertext
    )
    db.add(new_message)
    
    # Update room activity and user's read receipt
    room.last_activity_at = func.now()
    member.last_read_at = func.now()
    
    db.commit()
    db.refresh(new_message)
    
    # Queue notification generation in SQS for offline users
    # We pass only metadata, NOT the plaintext message
    if sqs_service.sqs_available:
        sqs_service.sqs_client.send_message(
            QueueUrl=sqs_service.queue_url,
            MessageBody=f'{{"type": "new_chat_message", "room_id": {room_id}, "sender_id": {current_user.id}, "message_id": {new_message.id}}}',
            DelaySeconds=0
        )
    
    # Decrypt content for the response
    response_msg = ChatMessageResponse.model_validate(new_message)
    response_msg.content = message_in.content
    return response_msg

@router.put("/messages/{message_id}", response_model=ChatMessageResponse)
async def edit_message(
    message_id: int,
    message_in: ChatMessageUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Edit an existing message."""
    message = db.query(UserChatMessage).filter(UserChatMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
        
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
        
    room = db.query(UserChatRoom).filter(UserChatRoom.id == message.room_id).first()
    
    # Encrypt the new content
    new_ciphertext = encrypt_message(message_in.content, room.encrypted_dek)
    
    message.content = new_ciphertext
    message.is_edited = True
    # The updated_at column will automatically update via `onupdate=func.now()`
    
    # Update room activity so it syncs to clients
    room.last_activity_at = func.now()
    
    db.commit()
    db.refresh(message)
    
    # Return decrypted
    response_msg = ChatMessageResponse.model_validate(message)
    response_msg.content = message_in.content
    return response_msg
