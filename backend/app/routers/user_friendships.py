from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from typing import List

from app.database import get_db
from app.models import User, UserFriendship
from app.auth import get_current_active_user
from app.schemas.user_friendship import FriendshipResponse, FriendshipRequestCreate

router = APIRouter()

@router.post("/requests", response_model=FriendshipResponse, status_code=status.HTTP_201_CREATED)
async def send_friend_request(
    req: FriendshipRequestCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Send a buddy request to another user."""
    if req.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send a buddy request to yourself")
        
    target_user = db.query(User).filter(User.id == req.friend_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Enforce order: user_id is the smaller ID
    uid1, uid2 = min(current_user.id, req.friend_id), max(current_user.id, req.friend_id)
    
    existing = db.query(UserFriendship).filter(
        UserFriendship.user_id == uid1,
        UserFriendship.friend_id == uid2
    ).first()
    
    if existing:
        if existing.status == "PENDING":
            if existing.initiator_id == current_user.id:
                raise HTTPException(status_code=400, detail="Friend request already sent")
            else:
                # They sent a request to us, we are sending one to them -> auto accept
                existing.status = "ACCEPTED"
                existing.updated_at = func.now()
                db.commit()
                db.refresh(existing)
                return existing
        elif existing.status == "ACCEPTED":
            raise HTTPException(status_code=400, detail="Already buddies")
        elif existing.status == "REJECTED":
            # Restart the request
            existing.status = "PENDING"
            existing.initiator_id = current_user.id
            existing.updated_at = func.now()
            db.commit()
            db.refresh(existing)
            return existing

    new_request = UserFriendship(
        user_id=uid1,
        friend_id=uid2,
        status="PENDING",
        initiator_id=current_user.id
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    return new_request

@router.get("", response_model=List[FriendshipResponse])
async def list_friends(
    status_filter: str = "ACCEPTED",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List buddies. Defaults to ACCEPTED. Can pass 'PENDING' to see requests."""
    query = db.query(UserFriendship).options(
        joinedload(UserFriendship.user),
        joinedload(UserFriendship.friend)
    ).filter(
        or_(
            UserFriendship.user_id == current_user.id,
            UserFriendship.friend_id == current_user.id
        ),
        UserFriendship.status == status_filter.upper()
    )
    return query.all()

@router.put("/requests/{friendship_id}/accept", response_model=FriendshipResponse)
async def accept_friend_request(
    friendship_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Accept a pending buddy request."""
    friendship = db.query(UserFriendship).filter(UserFriendship.id == friendship_id).first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if friendship.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Request is already {friendship.status}")
        
    # Ensure current user is the recipient, not the initiator
    if friendship.initiator_id == current_user.id:
        raise HTTPException(status_code=403, detail="You cannot accept your own request")
        
    is_involved = (friendship.user_id == current_user.id or friendship.friend_id == current_user.id)
    if not is_involved:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    friendship.status = "ACCEPTED"
    friendship.updated_at = func.now()
    db.commit()
    db.refresh(friendship)
    return friendship

@router.put("/requests/{friendship_id}/reject", response_model=FriendshipResponse)
async def reject_friend_request(
    friendship_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reject a pending buddy request."""
    friendship = db.query(UserFriendship).filter(UserFriendship.id == friendship_id).first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Request not found")
        
    # Check authorization
    is_involved = (friendship.user_id == current_user.id or friendship.friend_id == current_user.id)
    if not is_involved:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    friendship.status = "REJECTED"
    friendship.updated_at = func.now()
    db.commit()
    db.refresh(friendship)
    return friendship

@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    friendship_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a buddy."""
    friendship = db.query(UserFriendship).filter(UserFriendship.id == friendship_id).first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Buddy relationship not found")
        
    is_involved = (friendship.user_id == current_user.id or friendship.friend_id == current_user.id)
    if not is_involved:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db.delete(friendship)
    db.commit()
    return None
