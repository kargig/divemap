from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.schemas.user_chat import UserBasicInfo

class FriendshipBase(BaseModel):
    user_id: int
    friend_id: int
    status: str
    initiator_id: int

class FriendshipResponse(FriendshipBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    # We want to be able to show who the friend is relative to the current user
    # So we might not just return user and friend, but the "other user"
    user: Optional[UserBasicInfo] = None
    friend: Optional[UserBasicInfo] = None
    
    class Config:
        from_attributes = True

class FriendshipRequestCreate(BaseModel):
    friend_id: int
