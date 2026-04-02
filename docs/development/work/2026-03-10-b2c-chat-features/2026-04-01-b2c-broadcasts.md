# B2C Broadcast Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow diving center owners to explicitly broadcast new dive trips to their followers via the B2C chat system.

**Architecture:** We will create a new backend endpoint `/api/v1/diving-centers/{id}/broadcast` that generates a rich `TRIP_AD` message in the center's broadcast room. The frontend will include a "Broadcast" checkbox in the trip creation form that triggers this endpoint upon successful trip creation.

**Tech Stack:** Python (FastAPI, SQLAlchemy), React (Tailwind CSS, React Query).

---

### Task 1: Backend - Broadcast Endpoint

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Modify: `backend/app/routers/diving_centers.py`

- [ ] **Step 1: Create Broadcast Schema**

Add to `backend/app/schemas/__init__.py`:
```python
class BroadcastTripRequest(BaseModel):
    trip_id: int
```

- [ ] **Step 2: Create Broadcast Endpoint**

Add to `backend/app/routers/diving_centers.py` (below the follow endpoints):
```python
from app.models import ParsedDiveTrip, DivingCenterManager
from app.schemas import BroadcastTripRequest
from app.services.encryption_service import encrypt_message
import json

@router.post("/{diving_center_id}/broadcast", status_code=status.HTTP_201_CREATED)
async def broadcast_trip_to_followers(
    diving_center_id: int,
    request: BroadcastTripRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Broadcast a dive trip to all followers of the diving center."""
    # 1. Verify permissions (Owner or Manager)
    center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Diving center not found")
        
    is_owner = center.owner_id == current_user.id
    is_manager = db.query(DivingCenterManager).filter(
        DivingCenterManager.diving_center_id == diving_center_id,
        DivingCenterManager.user_id == current_user.id
    ).first() is not None
    
    if not is_owner and not is_manager:
        raise HTTPException(status_code=403, detail="Not authorized to broadcast for this center")
        
    # 2. Verify Trip exists and belongs to this center
    trip = db.query(ParsedDiveTrip).filter(
        ParsedDiveTrip.id == request.trip_id,
        ParsedDiveTrip.diving_center_id == diving_center_id
    ).first()
    
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or does not belong to this center")
        
    # 3. Find or Create Broadcast Room
    from app.services.encryption_service import generate_room_dek, encrypt_room_dek
    from app.models import UserChatRoom, UserChatRoomMember, UserChatMessage, DivingCenterFollower
    import uuid
    
    broadcast_room = db.query(UserChatRoom).filter(
        UserChatRoom.diving_center_id == diving_center_id,
        UserChatRoom.is_broadcast == True
    ).first()
    
    if not broadcast_room:
        # Create it
        plaintext_dek = generate_room_dek()
        encrypted_dek = encrypt_room_dek(plaintext_dek)
        broadcast_room = UserChatRoom(
            id=str(uuid.uuid4()),
            is_group=True, # Broadcasts act as groups
            name=f"{center.name} Announcements",
            encrypted_dek=encrypted_dek,
            created_by_id=current_user.id,
            diving_center_id=diving_center_id,
            is_broadcast=True
        )
        db.add(broadcast_room)
        db.flush()
        
        # Add Owner/Manager as Admin
        admin_member = UserChatRoomMember(
            room_id=broadcast_room.id,
            user_id=current_user.id,
            role="ADMIN"
        )
        db.add(admin_member)
        
        # Add all followers as Members
        followers = db.query(DivingCenterFollower).filter(DivingCenterFollower.diving_center_id == diving_center_id).all()
        for f in followers:
            if f.user_id != current_user.id:
                member = UserChatRoomMember(
                    room_id=broadcast_room.id,
                    user_id=f.user_id,
                    role="MEMBER"
                )
                db.add(member)
        db.flush()

    # 4. Construct and Encrypt TRIP_AD Message
    trip_payload = json.dumps({
        "trip_id": trip.id,
        "name": trip.trip_description[:50] + "..." if trip.trip_description else f"Dive Trip on {trip.trip_date}",
        "date": str(trip.trip_date),
        "price": f"{trip.trip_price} {trip.trip_currency}" if trip.trip_price else None
    })
    
    ciphertext = encrypt_message(trip_payload, broadcast_room.encrypted_dek)
    
    msg = UserChatMessage(
        room_id=broadcast_room.id,
        sender_id=current_user.id,
        content=ciphertext,
        message_type="TRIP_AD"
    )
    db.add(msg)
    
    # 5. Update room activity and unarchive for all members
    broadcast_room.last_activity_at = func.now()
    broadcast_room.is_archived = False
    
    db.query(UserChatRoomMember).filter(
        UserChatRoomMember.room_id == broadcast_room.id,
        UserChatRoomMember.left_at.is_(None)
    ).update({"is_archived": False, "last_read_at": func.now()}, synchronize_session=False)

    db.commit()
    
    return {"status": "success", "message": "Trip broadcasted successfully"}
```

- [ ] **Step 3: Run Backend Tests**

Run: `cd backend && ./docker-test-github-actions.sh`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/__init__.py backend/app/routers/diving_centers.py
git commit -m "feat(api): add trip broadcast endpoint for diving centers"
```

### Task 2: Frontend - Trip Broadcasting UI

**Files:**
- Modify: `frontend/src/services/divingCenters.js`
- Modify: `frontend/src/components/TripFormModal.jsx`
- Modify: `frontend/src/pages/CreateTrip.jsx`

- [ ] **Step 1: Add API client method**

In `frontend/src/services/divingCenters.js`:
```javascript
export const broadcastTrip = async (id, tripId) => {
  const response = await api.post(`/api/v1/diving-centers/${id}/broadcast`, { trip_id: tripId });
  return response.data;
};
```

- [ ] **Step 2: Add Checkbox to TripFormModal**

In `frontend/src/components/TripFormModal.jsx`, add `broadcast_to_followers` to the form state.
```javascript
// In getDefaultValues():
broadcast_to_followers: false,

// In the JSX (e.g. at the bottom of the form before the submit button):
          {/* Broadcast Option (Only for new trips) */}
          {!trip && (
            <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-200">
              <input
                type="checkbox"
                id="broadcast"
                {...register('broadcast_to_followers')}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="broadcast" className="text-sm font-medium text-gray-700">
                Broadcast this trip to followers
              </label>
            </div>
          )}
```

- [ ] **Step 3: Handle Broadcast in CreateTrip.jsx**

In `frontend/src/pages/CreateTrip.jsx`, import `broadcastTrip` and update the `createMutation`:
```javascript
import { broadcastTrip } from '../services/divingCenters';

// Update createMutation.mutate call in onSubmit:
  const createMutation = useMutation(createParsedTrip, {
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries('dive-trips');
      toast.success('Trip created successfully');
      
      // Handle broadcast if checked
      if (variables.broadcast_to_followers && data.diving_center_id) {
        try {
          await broadcastTrip(data.diving_center_id, data.id);
          toast.success('Trip broadcasted to followers!');
        } catch (err) {
          toast.error('Failed to broadcast trip');
        }
      }
      
      navigate('/dive-trips');
    },
    onError: error => {
      toast.error(extractErrorMessage(error, 'Failed to create trip'));
    },
  });

  const onSubmit = data => {
    // We pass the broadcast flag along with the trip data. 
    // The backend `ParsedDiveTripCreate` schema ignores unknown fields.
    createMutation.mutate(data);
  };
```

- [ ] **Step 4: Run Frontend Linter**

Run: `make lint-frontend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/divingCenters.js frontend/src/components/TripFormModal.jsx frontend/src/pages/CreateTrip.jsx
git commit -m "feat(ui): add broadcast to followers option when creating trips"
```
