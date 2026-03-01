from pydantic import BaseModel, Field, constr
from typing import Optional, List, Dict
from datetime import datetime

# --- Common/Shared ---
class UserBasicInfo(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True

# --- Members ---
class ChatRoomMemberBase(BaseModel):
    user_id: int
    role: str = "MEMBER"

class ChatRoomMemberResponse(ChatRoomMemberBase):
    joined_at: datetime
    left_at: Optional[datetime] = None
    last_read_at: datetime
    user: Optional[UserBasicInfo] = None
    
    class Config:
        from_attributes = True

# --- Rooms ---
class ChatRoomCreate(BaseModel):
    is_group: bool = False
    name: Optional[constr(max_length=100)] = None
    participant_ids: List[int] = Field(default_factory=list, description="IDs of users to add. Current user is added automatically.")

class ChatRoomUpdate(BaseModel):
    name: Optional[constr(max_length=100)] = None

class ChatRoomResponse(BaseModel):
    id: int
    is_group: bool
    name: Optional[str] = None
    created_by_id: Optional[int] = None
    last_activity_at: datetime
    created_at: datetime
    
    # Metadata added by the endpoint
    members: List[ChatRoomMemberResponse] = []
    unread_count: int = 0
    latest_message: Optional[str] = None
    
    class Config:
        from_attributes = True

# --- Messages ---
class ChatMessageCreate(BaseModel):
    content: constr(min_length=1, max_length=5000)

class ChatMessageUpdate(BaseModel):
    content: constr(min_length=1, max_length=5000)

class ChatMessageResponse(BaseModel):
    id: int
    room_id: int
    sender_id: Optional[int] = None
    content: str  # Decrypted plaintext
    is_edited: bool
    updated_at: datetime
    created_at: datetime
    sender: Optional[UserBasicInfo] = None
    
    class Config:
        from_attributes = True
