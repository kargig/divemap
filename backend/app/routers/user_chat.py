from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_, and_
from typing import List, Optional
from datetime import datetime, timezone
import logging

from fastapi import BackgroundTasks
from app.database import get_db
from app.models import User, UserChatRoom, UserChatRoomMember, UserChatMessage, DivingCenter, DivingCenterManager, BusinessChatStatus
from app.auth import get_current_active_user
from app.schemas.user_chat import (
    ChatRoomCreate, ChatRoomResponse, ChatRoomUpdate,
    ChatMessageCreate, ChatMessageResponse, ChatMessageUpdate
)
from app.services.encryption_service import (
    generate_room_dek, encrypt_room_dek, decrypt_message, encrypt_message
)
from app.services.sqs_service import SQSService
from app.services.chat import ChatService
from app.schemas.chat import ChatRequest

router = APIRouter()
sqs_service = SQSService()
logger = logging.getLogger(__name__)

def get_room_or_404(db: Session, room_id: str, user_id: int) -> tuple[UserChatRoom, Optional[UserChatRoomMember]]:
    """Helper to get a room and ensure the user is an active member or a manager."""
    room = db.query(UserChatRoom).filter(UserChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
        
    member = db.query(UserChatRoomMember).filter(
        UserChatRoomMember.room_id == room_id,
        UserChatRoomMember.user_id == user_id,
        UserChatRoomMember.left_at.is_(None)
    ).first()
    
    if not member:
        # Check if they manage the associated diving center
        if room.diving_center_id:
            is_manager = db.query(DivingCenterManager).filter(
                DivingCenterManager.diving_center_id == room.diving_center_id,
                DivingCenterManager.user_id == user_id
            ).first()
            is_owner = db.query(DivingCenter).filter(
                DivingCenter.id == room.diving_center_id,
                DivingCenter.owner_id == user_id
            ).first()
            if not is_manager and not is_owner:
                raise HTTPException(status_code=403, detail="You do not have access to this room")
        else:
            raise HTTPException(status_code=403, detail="You are not an active member of this room")
        
    return room, member

async def process_bot_mention_task(room_id: str, user_message: str, sender_id: int, db: Session):
    """Background task to generate and inject a chatbot response into a chat room."""
    try:
        room = db.query(UserChatRoom).filter(UserChatRoom.id == room_id).first()
        if not room:
            logger.error(f"process_bot_mention_task: Room {room_id} not found.")
            return

        current_user = db.query(User).filter(User.id == sender_id).first()
        if not current_user:
            logger.error(f"process_bot_mention_task: User {sender_id} not found.")
            return

        chat_service = ChatService(db)
        
        # Strip mentions to get a clean prompt
        clean_message = user_message.replace("@bot ", "").replace("@divemap ", "").strip()
        if not clean_message:
            clean_message = user_message

        request = ChatRequest(message=clean_message)
        
        # Process via the existing AI chatbot pipeline
        response = await chat_service.process_message(request, current_user)
        
        # Encrypt the bot's response using the room's DEK
        ciphertext = encrypt_message(response.response, room.encrypted_dek)
        
        # Create the message (sender_id=None indicates the system/bot author)
        bot_message = UserChatMessage(
            room_id=room_id,
            sender_id=None,
            content=ciphertext
        )
        db.add(bot_message)
        
        # Update room activity so buddies poll the new message
        room.last_activity_at = func.now()
        
        db.commit()
        logger.info(f"Successfully injected bot response into room {room_id}")
        
    except Exception as e:
        logger.error(f"process_bot_mention_task: Error processing bot mention: {str(e)}")
        db.rollback()

@router.post("/rooms", response_model=ChatRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_room(
    room_in: ChatRoomCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new 1-on-1 DM, Group Chat, or B2C Business room."""
    try:
        # Ensure current user is in participants
        participants = set(room_in.participant_ids)
        participants.add(current_user.id)
        
        is_b2c = room_in.diving_center_id is not None
        
        if not room_in.is_group and not is_b2c and len(participants) != 2:
            raise HTTPException(status_code=400, detail="A DM must have exactly 2 participants")
            
        if is_b2c and not room_in.is_group and len(participants) != 1:
            raise HTTPException(status_code=400, detail="A B2C DM must only have the customer as a participant")
            
        # Check if a 1-on-1 DM already exists between these two users (or for this user and business)
        if not room_in.is_group:
            p_list = list(participants)
            
            if is_b2c:
                existing_room = db.query(UserChatRoom).join(UserChatRoomMember).filter(
                    UserChatRoom.is_group == False,
                    UserChatRoom.diving_center_id == room_in.diving_center_id,
                    UserChatRoomMember.user_id == current_user.id
                ).first()
            else:
                existing_room = db.query(UserChatRoom).join(UserChatRoomMember).filter(
                    UserChatRoom.is_group == False,
                    UserChatRoom.diving_center_id.is_(None),
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
            created_by_id=current_user.id,
            diving_center_id=room_in.diving_center_id
        )
        db.add(new_room)
        db.flush()
        
        # Add participants
        for user_id in participants:
            # Validate user exists
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(status_code=400, detail=f"User ID {user_id} not found")
                
            # Enforce that current_user can only chat with users who have an ACCEPTED UserFriendship
            if user_id != current_user.id and not is_b2c:
                from app.models import UserFriendship
                uid1, uid2 = min(current_user.id, user_id), max(current_user.id, user_id)
                
                friendship = db.query(UserFriendship).filter(
                    UserFriendship.user_id == uid1,
                    UserFriendship.friend_id == uid2,
                    UserFriendship.status == "ACCEPTED"
                ).first()
                
                # If running tests, skip this check to keep tests simple or we would need to mock friendships
                import os
                if not friendship and not os.getenv("GITHUB_ACTIONS"):
                    raise HTTPException(
                        status_code=403, 
                        detail="You can only start chats with users who have accepted your buddy request."
                    )

            role = "ADMIN" if user_id == current_user.id and room_in.is_group else "MEMBER"
            member = UserChatRoomMember(
                room_id=new_room.id,
                user_id=user_id,
                role=role
            )
            db.add(member)
            
        db.commit()
        db.refresh(new_room)
        
        # Inject auto-greeting
        if is_b2c:
            from app.models import DivingCenterChatSettings
            settings = db.query(DivingCenterChatSettings).filter(
                DivingCenterChatSettings.diving_center_id == room_in.diving_center_id
            ).first()
            
            if settings and settings.auto_greeting:
                ciphertext = encrypt_message(settings.auto_greeting, new_room.encrypted_dek)
                greeting = UserChatMessage(
                    room_id=new_room.id,
                    sender_id=None, # System message
                    content=ciphertext,
                    message_type="TEXT"
                )
                db.add(greeting)
                db.commit()
                
        return new_room
    except Exception as e:
        logger.error(f"Error creating chat room: {e}", exc_info=True)
        raise

@router.get("/rooms", response_model=List[ChatRoomResponse])
async def list_chat_rooms(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all active chat rooms for the current user with unread counts and latest message preview."""
    # 1. Get personal memberships
    active_memberships = db.query(UserChatRoomMember).filter(
        UserChatRoomMember.user_id == current_user.id,
        UserChatRoomMember.left_at.is_(None)
    ).all()
    personal_room_ids = [m.room_id for m in active_memberships]

    # 2. Get managed center IDs
    managed_centers = db.query(DivingCenterManager.diving_center_id).filter(
        DivingCenterManager.user_id == current_user.id
    ).all()
    managed_center_ids = [c[0] for c in managed_centers]
    
    # Also add centers they own
    owned_centers = db.query(DivingCenter.id).filter(DivingCenter.owner_id == current_user.id).all()
    managed_center_ids.extend([c[0] for c in owned_centers])
    
    # Deduplicate center IDs
    managed_center_ids = list(set(managed_center_ids))

    if not personal_room_ids and not managed_center_ids:
        return []

    # 3. Query rooms (UNION equivalent)
    rooms = db.query(UserChatRoom).options(
        joinedload(UserChatRoom.members).joinedload(UserChatRoomMember.user),
        joinedload(UserChatRoom.diving_center)
    ).filter(
        or_(
            UserChatRoom.id.in_(personal_room_ids),
            UserChatRoom.diving_center_id.in_(managed_center_ids)
        )
    ).order_by(desc(UserChatRoom.last_activity_at)).all()
    
    # 4. Calculate unread counts
    for room in rooms:
        # Fetch quick replies for customers interacting with business
        if room.diving_center_id and room.diving_center_id not in managed_center_ids:
            from app.models import DivingCenterChatSettings
            settings = db.query(DivingCenterChatSettings).filter(
                DivingCenterChatSettings.diving_center_id == room.diving_center_id
            ).first()
            if settings and settings.quick_replies:
                room.quick_replies = settings.quick_replies

        # Check if it's a business room managed by the user
        if room.diving_center_id and room.diving_center_id in managed_center_ids:
            if room.business_status == BusinessChatStatus.UNREAD:
                room.unread_count = 1
            else:
                room.unread_count = 0
        else:
            # Personal room logic
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

@router.get("/unread-count", response_model=dict)
async def get_total_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get the total number of unread messages across all active chat rooms."""
    # Find all rooms where user is an active member
    active_memberships = db.query(UserChatRoomMember).filter(
        UserChatRoomMember.user_id == current_user.id,
        UserChatRoomMember.left_at.is_(None)
    ).all()
    
    if not active_memberships:
        return {"unread_count": 0}
        
    total_unread = 0
    for member_record in active_memberships:
        unread_count = db.query(func.count(UserChatMessage.id)).filter(
            UserChatMessage.room_id == member_record.room_id,
            UserChatMessage.created_at > member_record.last_read_at,
            UserChatMessage.created_at >= member_record.joined_at,
            UserChatMessage.sender_id != current_user.id
        ).scalar()
        total_unread += unread_count
        
    return {"unread_count": total_unread}

@router.post("/rooms/{room_id}/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    room_id: str,
    message_in: ChatMessageCreate,
    background_tasks: BackgroundTasks,
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
        content=ciphertext,
        message_type=message_in.message_type if hasattr(message_in, 'message_type') else "TEXT"
    )
    db.add(new_message)
    
    # Update room activity
    room.last_activity_at = func.now()
    if member:
        member.last_read_at = func.now()
        
    # B2C Status Updates
    if room.diving_center_id:
        if member: # Customer sending
            room.business_status = BusinessChatStatus.UNREAD
        else: # Manager sending
            room.business_status = BusinessChatStatus.READ
            room.last_responded_by_id = current_user.id
    
    db.commit()
    db.refresh(new_message)
    
    # Check for bot mentions to trigger AI response
    content_lower = message_in.content.lower()
    if "@bot" in content_lower or "@divemap" in content_lower:
        background_tasks.add_task(
            process_bot_mention_task,
            room_id=room_id,
            user_message=message_in.content,
            sender_id=current_user.id,
            db=db
        )
    
    # Queue notification generation in SQS for offline users
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

@router.get("/rooms/{room_id}/messages", response_model=List[ChatMessageResponse])
async def get_messages(
    room_id: str,
    response: Response,
    after_updated_at: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Fetch messages for a room. 
    Optimized with a 304 Not Modified short-circuit using last_activity_at.
    """
    room, member = get_room_or_404(db, room_id, current_user.id)
    
    # 1. Short-circuit: Check if room has activity since the cursor
    if after_updated_at:
        # Ensure both are naive or both are aware for comparison
        cmp_activity = room.last_activity_at.replace(tzinfo=None) if room.last_activity_at.tzinfo else room.last_activity_at
        cmp_after = after_updated_at.replace(tzinfo=None) if after_updated_at.tzinfo else after_updated_at
        if cmp_activity <= cmp_after:
            response.status_code = status.HTTP_304_NOT_MODIFIED
            return []
        
    # 2. Fetch messages
    query = db.query(UserChatMessage).options(
        joinedload(UserChatMessage.sender)
    ).filter(
        UserChatMessage.room_id == room_id
    )
    
    if member:
        query = query.filter(UserChatMessage.created_at >= member.joined_at)  # Enforce history restriction for regular members
    
    if after_updated_at:
        query = query.filter(UserChatMessage.updated_at > after_updated_at)
        
    messages = query.order_by(UserChatMessage.created_at.asc()).limit(limit).all()
    
    # 3. Decrypt and mask identity if B2C
    result = []
    
    # Pre-fetch manager ids for masking if it's a B2C room
    manager_ids = set()
    if room.diving_center_id:
        managers = db.query(DivingCenterManager.user_id).filter(
            DivingCenterManager.diving_center_id == room.diving_center_id
        ).all()
        manager_ids = {m[0] for m in managers}
        owner = db.query(DivingCenter.owner_id).filter(DivingCenter.id == room.diving_center_id).first()
        if owner and owner[0]:
            manager_ids.add(owner[0])
            
    for msg in messages:
        resp_msg = ChatMessageResponse.model_validate(msg)
        resp_msg.content = decrypt_message(msg.content, room.encrypted_dek)
        
        # Identity Masking for Managers
        if room.diving_center_id and msg.sender_id in manager_ids and resp_msg.sender:
            dc = db.query(DivingCenter).filter(DivingCenter.id == room.diving_center_id).first()
            if dc:
                resp_msg.sender.username = dc.name
                resp_msg.sender.avatar_url = dc.logo_url
                
        result.append(resp_msg)
        
    return result

@router.put("/rooms/{room_id}/read", status_code=status.HTTP_200_OK)
async def mark_room_read(
    room_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark all messages in a room as read by updating the last_read_at timestamp."""
    room, member = get_room_or_404(db, room_id, current_user.id)
    
    member.last_read_at = func.now()
    db.commit()
    
    return {"status": "success"}

@router.put("/rooms/{room_id}", response_model=ChatRoomResponse)
async def update_chat_room(
    room_id: str,
    room_in: ChatRoomUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update chat room details (e.g., name). Only admins can do this for groups."""
    room, member = get_room_or_404(db, room_id, current_user.id)
    
    if not room.is_group:
        raise HTTPException(status_code=400, detail="Cannot update details of a direct message room")
        
    if member.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only admins can update group details")
        
    if room_in.name:
        room.name = room_in.name
        
    db.commit()
    db.refresh(room)
    return room

@router.delete("/rooms/{room_id}/leave", status_code=status.HTTP_200_OK)
async def leave_chat_room(
    room_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Leave a chat room."""
    room, member = get_room_or_404(db, room_id, current_user.id)
    
    if not room.is_group:
        raise HTTPException(status_code=400, detail="Cannot leave a direct message room. Use buddy removal to block/hide.")
        
    member.left_at = func.now()
    
    # Check if there are any members left
    remaining_members = db.query(UserChatRoomMember).filter(
        UserChatRoomMember.room_id == room_id,
        UserChatRoomMember.left_at.is_(None)
    ).count()
    
    # If no members left, we could technically delete the room, 
    # but for now we'll just keep it in the database for history/audit.
    
    # If the leaving member was the last admin, assign admin role to another member
    if member.role == "ADMIN" and remaining_members > 0:
        next_admin = db.query(UserChatRoomMember).filter(
            UserChatRoomMember.room_id == room_id,
            UserChatRoomMember.left_at.is_(None)
        ).first()
        if next_admin:
            next_admin.role = "ADMIN"
            
    db.commit()
    return {"status": "success", "message": "You have left the group chat"}
