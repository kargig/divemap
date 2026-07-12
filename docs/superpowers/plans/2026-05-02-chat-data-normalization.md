# Chat Data Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize chat message retrieval by returning a flat list of messages with a separate `users` dictionary, reducing network payload size and avoiding redundant avatar processing. This plan includes refactoring schemas with inheritance for long-term maintainability.

**Architecture:** 
1. **Schema Refactoring**: Split the existing `ChatMessageResponse` into a `ChatMessageBaseResponse` (no sender data) and a subclass `ChatMessageResponse` (with sender).
2. **Endpoint Refactoring**: Update `get_messages` to return a new `RoomMessagesResponse` containing a list of base messages and a `users` dictionary.
3. **Frontend Normalization**: Update the frontend `api.js` to stitch the users back onto the messages, ensuring zero changes are needed in React components.

**Tech Stack:** FastAPI, Pydantic v2, React.

---

### Task 1: Refactor Backend Schemas

**Files:**
- Modify: `backend/app/schemas/user_chat.py`

- [ ] **Step 1: Refactor ChatMessageResponse with inheritance**

Replace the existing `ChatMessageResponse` with a base version and a subclass. Add the `RoomMessagesResponse` model at the bottom.

```python
class ChatMessageBaseResponse(BaseModel):
    id: int
    room_id: str
    sender_id: Optional[int] = None
    content: str  # Decrypted plaintext
    message_type: str = "TEXT"
    is_edited: bool
    updated_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatMessageResponse(ChatMessageBaseResponse):
    sender: Optional[UserBasicInfo] = None

class RoomMessagesResponse(BaseModel):
    messages: List[ChatMessageBaseResponse]
    users: Dict[int, UserBasicInfo]
```

### Task 2: Refactor `get_messages` Router Endpoint

**Files:**
- Modify: `backend/app/routers/user_chat.py`

- [ ] **Step 1: Update imports**

Include the new schemas in the import block.

```python
from app.schemas.user_chat import (
    ChatRoomCreate, ChatRoomResponse, ChatRoomUpdate,
    ChatMessageCreate, ChatMessageResponse, ChatMessageUpdate,
    ChatRoomArchiveUpdate, RoomMessagesResponse, ChatMessageBaseResponse
)
```

- [ ] **Step 2: Update get_messages logic**

Refactor the function to populate the dictionary and use the normalized schema.

```python
@router.get("/rooms/{room_id}/messages", response_model=RoomMessagesResponse)
async def get_messages(
    room_id: str,
    after_updated_at: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get messages for a chat room with cursor-based pagination.
    Returns normalized data: a list of messages and a dictionary of unique users.
    """
    room, member = get_room_or_404(db, room_id, current_user.id)
    
    # 1. Short-circuit: Check if room has activity since the cursor
    if after_updated_at:
        cmp_activity = room.last_activity_at.replace(tzinfo=None) if room.last_activity_at.tzinfo else room.last_activity_at
        cmp_after = after_updated_at.replace(tzinfo=None) if after_updated_at.tzinfo else after_updated_at
        if cmp_activity <= cmp_after:
            return Response(status_code=status.HTTP_304_NOT_MODIFIED)
        
    # 2. Fetch messages
    query = db.query(UserChatMessage).options(
        joinedload(UserChatMessage.sender)
    ).filter(
        UserChatMessage.room_id == room_id
    )
    
    if member:
        query = query.filter(UserChatMessage.created_at >= member.joined_at)
    
    if after_updated_at:
        query = query.filter(UserChatMessage.updated_at > after_updated_at)
        
    messages = query.order_by(UserChatMessage.created_at.asc()).limit(limit).all()
    
    # 3. Decrypt and normalize
    result_messages = []
    users_dict = {}
    
    manager_ids = set()
    if room.diving_center_id:
        managers = db.query(DivingCenterManager.user_id).filter(DivingCenterManager.diving_center_id == room.diving_center_id).all()
        manager_ids = {m[0] for m in managers}
        owner = db.query(DivingCenter.owner_id).filter(DivingCenter.id == room.diving_center_id).first()
        if owner and owner[0]:
            manager_ids.add(owner[0])
            
    for msg in messages:
        # Use Base schema to exclude 'sender' field from message list
        resp_msg = ChatMessageBaseResponse.model_validate(msg)
        resp_msg.content = decrypt_message(msg.content, room.encrypted_dek)
        
        # Populate users dictionary
        if msg.sender_id and msg.sender_id not in users_dict:
            # Identity Masking for Managers
            if room.diving_center_id and msg.sender_id in manager_ids and msg.sender:
                dc = db.query(DivingCenter).filter(DivingCenter.id == room.diving_center_id).first()
                if dc:
                    # Create masked user info
                    users_dict[msg.sender_id] = UserBasicInfo(
                        id=msg.sender_id,
                        username=dc.name,
                        avatar_url=dc.logo_url,
                        avatar_full_url=dc.logo_url
                    )
            elif msg.sender:
                # Regular user
                temp_data = {}
                populate_avatar_full_url(msg.sender, temp_data)
                user_info = UserBasicInfo.model_validate(msg.sender)
                user_info.avatar_full_url = temp_data.get("avatar_full_url")
                users_dict[msg.sender_id] = user_info
                
        result_messages.append(resp_msg)
        
    return RoomMessagesResponse(messages=result_messages, users=users_dict)
```

### Task 3: Update Backend Tests

**Files:**
- Modify: `backend/tests/test_user_chat_api.py`

- [ ] **Step 1: Update the test expectations**

```python
    # Find test_get_messages_short_circuit or similar fetch tests
    get_res = client.get(f"/api/v1/user-chat/rooms/{room_id}/messages", headers=auth_headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert "messages" in data
    assert "users" in data
    assert isinstance(data["messages"], list)
    assert len(data["messages"]) >= 1
```

- [ ] **Step 2: Run verification tests**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_user_chat_api.py`

### Task 4: Update Frontend API Layer

**Files:**
- Modify: `frontend/src/api.js`

- [ ] **Step 1: Remap normalized data to existing UI structure**

```javascript
export const getChatMessages = async (roomId, afterUpdatedAt = null) => {
  const params = {};
  if (afterUpdatedAt) {
    params.after_updated_at = afterUpdatedAt;
  }
  try {
    const response = await api.get(`/api/v1/user-chat/rooms/${roomId}/messages`, { params });
    const { messages, users } = response.data;
    
    // Stitch users back onto messages so UI components (MessageBubble) don't need changes
    return messages.map(msg => ({
      ...msg,
      sender: msg.sender_id && users[msg.sender_id] ? users[msg.sender_id] : null
    }));
  } catch (error) {
    if (error.response && error.response.status === 304) {
      return [];
    }
    throw error;
  }
};
```

### Task 5: Final Verification

- [ ] **Step 1: Verify via linting**
Run: `make lint-frontend`

- [ ] **Step 2: Browser verification**
Navigate to `http://localhost/messages`, select a chat, and verify messages load correctly with avatars.

- [ ] **Step 3: Commit**
```bash
git add backend/app/schemas/user_chat.py backend/app/routers/user_chat.py backend/tests/test_user_chat_api.py frontend/src/api.js
git commit -m "Refactor chat history to normalized schema with inheritance"
```
