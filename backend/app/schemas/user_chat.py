from datetime import datetime

from pydantic import BaseModel, Field, constr


# --- Common/Shared ---
class UserBasicInfo(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    avatar_type: str | None = "google"
    avatar_full_url: str | None = None

    class Config:
        from_attributes = True


class DivingCenterBasic(BaseModel):
    id: int
    name: str
    logo_url: str | None = None

    class Config:
        from_attributes = True


# --- Members ---
class ChatRoomMemberBase(BaseModel):
    user_id: int
    role: str = "MEMBER"


class ChatRoomMemberResponse(ChatRoomMemberBase):
    joined_at: datetime
    left_at: datetime | None = None
    last_read_at: datetime
    user: UserBasicInfo | None = None

    class Config:
        from_attributes = True


# --- Rooms ---
class ChatRoomCreate(BaseModel):
    is_group: bool = False
    name: constr(max_length=100) | None = None
    participant_ids: list[int] = Field(
        default_factory=list,
        description="IDs of users to add. Current user is added automatically.",
    )
    diving_center_id: int | None = None


class ChatRoomUpdate(BaseModel):
    name: constr(max_length=100) | None = None


class ChatRoomArchiveUpdate(BaseModel):
    is_archived: bool


class ChatRoomResponse(BaseModel):
    id: str
    is_group: bool
    name: str | None = None
    created_by_id: int | None = None
    diving_center_id: int | None = None
    diving_center: DivingCenterBasic | None = None
    is_broadcast: bool = False
    is_archived: bool = False
    business_status: str | None = None
    is_manager_view: bool = False
    quick_replies: list[str] | None = None
    last_activity_at: datetime
    created_at: datetime

    # Metadata added by the endpoint
    members: list[ChatRoomMemberResponse] = []
    unread_count: int = 0
    latest_message: str | None = None

    class Config:
        from_attributes = True


# --- Messages ---
class ChatMessageCreate(BaseModel):
    content: constr(min_length=1, max_length=5000)
    message_type: str = "TEXT"


class ChatMessageUpdate(BaseModel):
    content: constr(min_length=1, max_length=5000)


class ChatMessageBaseResponse(BaseModel):
    id: int
    room_id: str
    sender_id: int | None = None
    content: str  # Decrypted plaintext
    message_type: str = "TEXT"
    is_edited: bool
    updated_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessageResponse(ChatMessageBaseResponse):
    sender: UserBasicInfo | None = None


class RoomMessagesResponse(BaseModel):
    messages: list[ChatMessageBaseResponse]
    users: dict[int, UserBasicInfo]
