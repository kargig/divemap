import re
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.models import DiveSiteList, DiveSiteListItem, DiveSite, User, DiveSiteTag, DiveSiteListCollaborator, UserFriendship
from app.auth import get_current_active_user, get_current_user_optional, get_current_admin_user
from app.utils import increment_view_count
from app.schemas import (
    UserDiveSiteListResponse, UserDiveSiteListCreate, UserDiveSiteListUpdate,
    DiveSiteListItemResponse, DiveSiteListItemCreate, DiveSiteListItemUpdate,
    UserDiveSiteListReorder, UserDiveSiteListMembershipResponse,
    CollaboratorResponse, AddCollaboratorRequest, UpdateCollaboratorPreference
)

router = APIRouter()

def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_-]+', '-', s)
    return s.strip('-')

def sanitize_list_for_response(lst: Optional[DiveSiteList]) -> Optional[DiveSiteList]:
    """Sanitize nested dive site tags list objects to match Pydantic schema validation expectation"""
    return lst

def check_list_write_permission(list_id: int, user: User, db: Session) -> DiveSiteList:
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    
    # 1. Owner & Admin check
    if lst.user_id == user.id or user.is_admin:
        return lst
        
    # 2. Collaborator check
    collab = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.list_id == list_id,
        DiveSiteListCollaborator.user_id == user.id,
        DiveSiteListCollaborator.role == "editor"
    ).first()
    
    if not collab:
        raise HTTPException(status_code=403, detail="You do not have write access to this list")
        
    return lst

def notify_collaborative_list_activity(list_id: int, initiator_id: int, action: str, details: str, db: Session):
    # Fetch list and collaborators
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        return
        
    initiator = db.query(User).filter(User.id == initiator_id).first()
    initiator_username = initiator.username if initiator else "Someone"
    
    # Participants
    participants = {lst.user_id} | {c.user_id for c in lst.collaborators}
    target_users = participants - {initiator_id}
    
    owner = db.query(User).filter(User.id == lst.user_id).first()
    owner_username = owner.username if owner else "unknown"
    
    message_body = ""
    if action == "add":
        message_body = f"{initiator_username} added {details} to the list '{lst.title}'."
    elif action == "edit_notes":
        message_body = f"{initiator_username} updated notes for {details} in the list '{lst.title}'."
    elif action == "remove":
        message_body = f"{initiator_username} removed {details} from the list '{lst.title}'."
    elif action == "reorder":
        message_body = f"{initiator_username} reordered the dive sites in the list '{lst.title}'."
        
    from app.services.notification_service import NotificationService
    notif_service = NotificationService()
    
    for uid in target_users:
        notif_service.create_notification(
            user_id=uid,
            category="collaborative_list",
            title=f"List Updated: {lst.title}",
            message=message_body,
            link_url=f"/users/{owner_username}/lists/{lst.id}/{lst.slug}",
            entity_type="dive_site",
            db=db
        )

@router.get("/my-lists", response_model=List[UserDiveSiteListResponse])
async def get_my_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all curated lists of the authenticated user (including system lists and collaborative lists)"""
    ensure_default_lists(db, current_user.id)
    
    # Query lists owned by the current user
    owned_lists = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == current_user.id
    ).options(
        joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site).options(
            selectinload(DiveSite.tags).joinedload(DiveSiteTag.tag)
        ),
        joinedload(DiveSiteList.collaborators).joinedload(DiveSiteListCollaborator.user)
    ).all()
    
    # Query mappings where current user is a collaborator
    collab_mappings = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.user_id == current_user.id
    ).options(
        joinedload(DiveSiteListCollaborator.list).joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site).options(
            selectinload(DiveSite.tags).joinedload(DiveSiteTag.tag)
        ),
        joinedload(DiveSiteListCollaborator.list).joinedload(DiveSiteList.collaborators).joinedload(DiveSiteListCollaborator.user)
    ).all()
    
    collab_lists = [mapping.list for mapping in collab_mappings if mapping.list]
    
    all_lists = owned_lists + collab_lists
    
    # Set helper properties for response serialization
    for lst in all_lists:
        owner = db.query(User).filter(User.id == lst.user_id).first()
        lst.username = owner.username if owner else "unknown"
        lst.is_collaborator = (lst.user_id != current_user.id)
        lst.role = "owner" if lst.user_id == current_user.id else "editor"
        sanitize_list_for_response(lst)
        
    return all_lists

@router.post("", response_model=UserDiveSiteListResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    data: UserDiveSiteListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new custom curated list"""
    slug = slugify(data.title) or "list"
    
    new_list = DiveSiteList(
        user_id=current_user.id,
        title=data.title,
        slug=slug,
        description=data.description,
        is_public=data.is_public,
        show_on_profile=data.show_on_profile,
        system_type=None
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    new_list.username = current_user.username
    new_list.items = []
    sanitize_list_for_response(new_list)
    return new_list

@router.get("/{list_id}", response_model=UserDiveSiteListResponse)
async def get_list_by_id(
    list_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Retrieve details of a curated list with its items, tracked asynchronously on other user visits"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).options(
        joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site).options(
            selectinload(DiveSite.tags).joinedload(DiveSiteTag.tag)
        ),
        joinedload(DiveSiteList.collaborators).joinedload(DiveSiteListCollaborator.user)
    ).first()

    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    owner = db.query(User).filter(User.id == lst.user_id).first()
    lst.username = owner.username if owner else "unknown"

    # Privacy enforcement
    is_owner = current_user and current_user.id == lst.user_id
    is_collab = False
    collab_role = None
    if current_user:
        collab_entry = db.query(DiveSiteListCollaborator).filter(
            DiveSiteListCollaborator.list_id == list_id,
            DiveSiteListCollaborator.user_id == current_user.id
        ).first()
        if collab_entry:
            is_collab = True
            collab_role = collab_entry.role

    if not lst.is_public and not is_owner and not is_collab and not (current_user and current_user.is_admin):
        raise HTTPException(status_code=403, detail="This list is private")

    lst.is_collaborator = is_collab
    lst.role = "owner" if is_owner else collab_role

    # Track views
    if not is_owner:
        background_tasks.add_task(increment_view_count, db, DiveSiteList, list_id)

    sanitize_list_for_response(lst)
    return lst

@router.put("/{list_id}", response_model=UserDiveSiteListResponse)
async def update_list(
    list_id: int,
    data: UserDiveSiteListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update list details. Block renaming system types"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    if lst.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if data.title is not None:
        if lst.system_type:
            raise HTTPException(status_code=403, detail="Cannot rename system-generated lists")
        lst.title = data.title
        lst.slug = slugify(data.title)

    if data.description is not None:
        lst.description = data.description
    if data.is_public is not None:
        lst.is_public = data.is_public
        # Enforce logical dependency: if private, it cannot be displayed on public profile
        if not data.is_public:
            lst.show_on_profile = False

    if data.show_on_profile is not None:
        # Enforce logical dependency: can only show on profile if list is public
        lst.show_on_profile = data.show_on_profile if lst.is_public else False

    db.commit()
    db.refresh(lst)
    lst.username = current_user.username
    sanitize_list_for_response(lst)
    return lst

@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a custom list. Prevent system list deletion"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    if lst.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized")
    if lst.system_type:
        raise HTTPException(status_code=403, detail="System-generated lists cannot be deleted")

    db.delete(lst)
    db.commit()
    return None

@router.post("/{list_id}/items", response_model=DiveSiteListItemResponse, status_code=status.HTTP_201_CREATED)
async def add_list_item(
    list_id: int,
    data: DiveSiteListItemCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a site to a list with optional notes"""
    lst = check_list_write_permission(list_id, current_user, db)

    # Check site exists
    site = db.query(DiveSite).filter(DiveSite.id == data.dive_site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Dive site not found")

    # Prevent duplicate
    duplicate = db.query(DiveSiteListItem).filter(
        DiveSiteListItem.list_id == list_id,
        DiveSiteListItem.dive_site_id == data.dive_site_id
    ).first()
    if duplicate:
         raise HTTPException(status_code=400, detail="Dive site already in list")

    # Set display order as count
    item_count = db.query(DiveSiteListItem).filter(DiveSiteListItem.list_id == list_id).count()

    item = DiveSiteListItem(
        list_id=list_id,
        dive_site_id=data.dive_site_id,
        notes=data.notes,
        display_order=item_count
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    # Ensure dive_site relation is loaded for response model
    db_item = db.query(DiveSiteListItem).options(joinedload(DiveSiteListItem.dive_site)).filter(DiveSiteListItem.id == item.id).first()
    if db_item and db_item.dive_site:
        db_item.dive_site.tags = []
        
    background_tasks.add_task(notify_collaborative_list_activity, list_id, current_user.id, "add", site.name, db)
    return db_item

@router.put("/{list_id}/items/{item_id}", response_model=DiveSiteListItemResponse)
async def update_list_item(
    list_id: int,
    item_id: int,
    data: DiveSiteListItemUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update custom notes or individual order of a list item"""
    item = db.query(DiveSiteListItem).filter(
        DiveSiteListItem.id == item_id,
        DiveSiteListItem.list_id == list_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="List item not found")
    check_list_write_permission(list_id, current_user, db)

    if data.notes is not None:
        item.notes = data.notes
    if data.display_order is not None:
        item.display_order = data.display_order

    db.commit()
    db.refresh(item)
    
    site_name = item.dive_site.name if item.dive_site else "a site"
    background_tasks.add_task(notify_collaborative_list_activity, list_id, current_user.id, "edit_notes", site_name, db)
    return item

@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_list_item(
    list_id: int,
    item_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove a site from a list"""
    item = db.query(DiveSiteListItem).filter(
        DiveSiteListItem.id == item_id,
        DiveSiteListItem.list_id == list_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="List item not found")
    check_list_write_permission(list_id, current_user, db)

    site_name = item.dive_site.name if item.dive_site else "a site"
    db.delete(item)
    db.commit()
    
    background_tasks.add_task(notify_collaborative_list_activity, list_id, current_user.id, "remove", site_name, db)
    return None

@router.put("/{list_id}/reorder")
async def reorder_list_items(
    list_id: int,
    data: UserDiveSiteListReorder,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Bulk reorder items of a list securely in a single transaction"""
    lst = check_list_write_permission(list_id, current_user, db)

    items = db.query(DiveSiteListItem).filter(DiveSiteListItem.list_id == list_id).all()
    item_map = {item.id: item for item in items}

    for index, item_id in enumerate(data.item_ids):
        if item_id in item_map:
            item_map[item_id].display_order = index

    db.commit()
    background_tasks.add_task(notify_collaborative_list_activity, list_id, current_user.id, "reorder", "", db)
    return {"status": "success"}

@router.post("/{list_id}/collaborators", response_model=CollaboratorResponse, status_code=status.HTTP_201_CREATED)
async def add_list_collaborator(
    list_id: int,
    data: AddCollaboratorRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst or lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only list owners can manage collaborators")

    if lst.system_type:
        raise HTTPException(status_code=403, detail="System lists cannot have collaborators")

    target_user = db.query(User).filter(User.username == data.username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Enforce accepted friendships
    friendship = db.query(UserFriendship).filter(
        ((UserFriendship.user_id == current_user.id) & (UserFriendship.friend_id == target_user.id)) |
        ((UserFriendship.user_id == target_user.id) & (UserFriendship.friend_id == current_user.id)),
        UserFriendship.status == "ACCEPTED"
    ).first()
    if not friendship:
        raise HTTPException(status_code=400, detail="You can only collaborate with accepted buddies")

    # Check already exists
    exists = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.list_id == list_id,
        DiveSiteListCollaborator.user_id == target_user.id
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="User is already a collaborator")

    collab = DiveSiteListCollaborator(
        list_id=list_id,
        user_id=target_user.id,
        role="editor",
        show_on_profile=True
    )
    db.add(collab)
    db.commit()
    db.refresh(collab)
    
    # 1. Trigger Web Push System Notification and Email
    from app.services.notification_service import NotificationService
    notif_service = NotificationService()
    notification = notif_service.create_notification(
        user_id=target_user.id,
        category="collaborative_list",
        title="New Shared List",
        message=f"{current_user.username} added you as an editor on '{lst.title}'",
        link_url=f"/users/{current_user.username}/lists/{lst.id}/{lst.slug}",
        db=db
    )
    if notification:
        # Trigger email delivery logic 
        notif_service._queue_email_notification(notification, target_user, 'shared_list', db)
    
    # 2. Inject interactive shared list card inside DM chat if room exists
    try:
        from app.models import UserChatRoom, UserChatRoomMember, UserChatMessage
        from sqlalchemy import func
        from app.services.encryption_service import encrypt_message
        import json
        
        room_ids_subquery = db.query(UserChatRoomMember.room_id).filter(
            UserChatRoomMember.user_id.in_([current_user.id, target_user.id])
        ).group_by(UserChatRoomMember.room_id).having(func.count(UserChatRoomMember.user_id) == 2).subquery()

        room = db.query(UserChatRoom).filter(
            UserChatRoom.id.in_(room_ids_subquery),
            UserChatRoom.is_group == False,
            UserChatRoom.diving_center_id.is_(None)
        ).first()
        
        if room:
            payload = json.dumps({
                "list_id": lst.id,
                "list_slug": lst.slug,
                "list_title": lst.title,
                "text": f"{current_user.username} added you as a collaborator on the list '{lst.title}'."
            })
            ciphertext = encrypt_message(payload, room.encrypted_dek)
            msg = UserChatMessage(
                room_id=room.id,
                sender_id=current_user.id,
                content=ciphertext,
                message_type="system_shared_list"
            )
            db.add(msg)
            db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to inject shared list card in DM chat: {e}")
    
    # Dynamic fields for response mapping
    collab.username = target_user.username
    return collab

@router.delete("/{list_id}/collaborators/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_list_collaborator(
    list_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    if lst.user_id != current_user.id and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    collab = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.list_id == list_id,
        DiveSiteListCollaborator.user_id == user_id
    ).first()
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    db.delete(collab)
    db.commit()
    return None

@router.put("/{list_id}/collaborators/preference", response_model=CollaboratorResponse)
async def update_collaborator_profile_preference(
    list_id: int,
    data: UpdateCollaboratorPreference,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    collab = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.list_id == list_id,
        DiveSiteListCollaborator.user_id == current_user.id
    ).first()
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    collab.show_on_profile = data.show_on_profile
    db.commit()
    db.refresh(collab)
    return collab

@router.get("/dive-site/{dive_site_id}/my-status", response_model=List[UserDiveSiteListMembershipResponse])
async def get_dive_site_membership_status(
    dive_site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve bookmark checkmarks state across all user lists with single-query join efficiency"""
    ensure_default_lists(db, current_user.id)
    lists = db.query(DiveSiteList).filter(DiveSiteList.user_id == current_user.id).all()
    list_ids = [lst.id for lst in lists]

    # Batch query all items matching lists & dive site to resolve N+1 overhead
    items = []
    if list_ids:
        items = db.query(DiveSiteListItem).filter(
            DiveSiteListItem.list_id.in_(list_ids),
            DiveSiteListItem.dive_site_id == dive_site_id
        ).all()

    # Map by list ID for O(1) in-memory resolution
    item_map = {item.list_id: item for item in items}

    results = []
    for lst in lists:
        item = item_map.get(lst.id)
        results.append(UserDiveSiteListMembershipResponse(
            list_id=lst.id,
            title=lst.title,
            system_type=lst.system_type,
            is_in_list=item is not None,
            item_id=item.id if item else None
        ))
    return results

def ensure_default_lists(db: Session, user_id: int):
    """Verify and initialize standard My Favorites and My Wishlist files securely without side-effects during GET queries"""
    fav = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == user_id,
        DiveSiteList.system_type == "favorites"
    ).first()
    wish = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == user_id,
        DiveSiteList.system_type == "wishlist"
    ).first()

    if fav and wish:
        return

    if not fav:
        fav_list = DiveSiteList(
            user_id=user_id,
            title="My Favorites",
            slug="my-favorites",
            description="My favorite dive sites that I highly recommend!",
            is_public=True,
            show_on_profile=True,
            system_type="favorites"
        )
        db.add(fav_list)

    if not wish:
        wish_list = DiveSiteList(
            user_id=user_id,
            title="My Wishlist",
            slug="my-wishlist",
            description="Dive sites I would love to visit in the future.",
            is_public=False,
            show_on_profile=False,
            system_type="wishlist"
        )
        db.add(wish_list)
    db.commit()


@router.get("/admin/popular-lists", response_model=List[UserDiveSiteListResponse])
async def get_popular_lists_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Retrieve lists sorted by popularity (views) for site administrators"""
    lists = db.query(DiveSiteList).options(
        joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site).options(
            selectinload(DiveSite.tags).joinedload(DiveSiteTag.tag)
        )
    ).order_by(DiveSiteList.view_count.desc()).limit(50).all()

    # Resolve owners' usernames and sanitize
    for lst in lists:
        owner = db.query(User).filter(User.id == lst.user_id).first()
        lst.username = owner.username if owner else "unknown"
        sanitize_list_for_response(lst)

    return lists
