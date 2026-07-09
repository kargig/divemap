import re
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import DiveSiteList, DiveSiteListItem, DiveSite, User
from app.auth import get_current_active_user, get_current_user_optional, get_current_admin_user
from app.utils import increment_view_count
from app.schemas import (
    UserDiveSiteListResponse, UserDiveSiteListCreate, UserDiveSiteListUpdate,
    DiveSiteListItemResponse, DiveSiteListItemCreate, DiveSiteListItemUpdate,
    UserDiveSiteListReorder, UserDiveSiteListMembershipResponse
)

router = APIRouter()

def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_-]+', '-', s)
    return s.strip('-')

def sanitize_list_for_response(lst: Optional[DiveSiteList]) -> Optional[DiveSiteList]:
    """Sanitize nested dive site tags list objects to match Pydantic schema validation expectation"""
    if lst and lst.items:
        for item in lst.items:
            if item.dive_site:
                item.dive_site.tags = []
    return lst

@router.get("/my-lists", response_model=List[UserDiveSiteListResponse])
async def get_my_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all curated lists of the authenticated user (including system lists)"""
    ensure_default_lists(db, current_user.id)
    lists = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == current_user.id
    ).options(joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site)).all()
    
    # Map usernames and sanitize tags
    for lst in lists:
        lst.username = current_user.username
        sanitize_list_for_response(lst)
    return lists

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
        joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site)
    ).first()

    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    owner = db.query(User).filter(User.id == lst.user_id).first()
    lst.username = owner.username if owner else "unknown"

    # Privacy enforcement
    is_owner = current_user and current_user.id == lst.user_id
    if not lst.is_public and not is_owner and not (current_user and current_user.is_admin):
        raise HTTPException(status_code=403, detail="This list is private")

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a site to a list with optional notes"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst or lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

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
    return db_item

@router.put("/{list_id}/items/{item_id}", response_model=DiveSiteListItemResponse)
async def update_list_item(
    list_id: int,
    item_id: int,
    data: DiveSiteListItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update custom notes or individual order of a list item"""
    item = db.query(DiveSiteListItem).filter(
        DiveSiteListItem.id == item_id,
        DiveSiteListItem.list_id == list_id
    ).first()
    if not item or item.list.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if data.notes is not None:
        item.notes = data.notes
    if data.display_order is not None:
        item.display_order = data.display_order

    db.commit()
    db.refresh(item)
    return item

@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_list_item(
    list_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove a site from a list"""
    item = db.query(DiveSiteListItem).filter(
        DiveSiteListItem.id == item_id,
        DiveSiteListItem.list_id == list_id
    ).first()
    if not item or item.list.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db.delete(item)
    db.commit()
    return None

@router.put("/{list_id}/reorder")
async def reorder_list_items(
    list_id: int,
    data: UserDiveSiteListReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Bulk reorder items of a list securely in a single transaction"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst or lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    items = db.query(DiveSiteListItem).filter(DiveSiteListItem.list_id == list_id).all()
    item_map = {item.id: item for item in items}

    for index, item_id in enumerate(data.item_ids):
        if item_id in item_map:
            item_map[item_id].display_order = index

    db.commit()
    return {"status": "success"}

@router.get("/dive-site/{dive_site_id}/my-status", response_model=List[UserDiveSiteListMembershipResponse])
async def get_dive_site_membership_status(
    dive_site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve bookmark checkmarks state across all user lists"""
    ensure_default_lists(db, current_user.id)
    lists = db.query(DiveSiteList).filter(DiveSiteList.user_id == current_user.id).all()
    
    results = []
    for lst in lists:
        item = db.query(DiveSiteListItem).filter(
            DiveSiteListItem.list_id == lst.id,
            DiveSiteListItem.dive_site_id == dive_site_id
        ).first()
        
        results.append(UserDiveSiteListMembershipResponse(
            list_id=lst.id,
            title=lst.title,
            system_type=lst.system_type,
            is_in_list=item is not None,
            item_id=item.id if item else None
        ))
    return results

def ensure_default_lists(db: Session, user_id: int):
    """Verify and initialize standard My Favorites and My Wishlist files securely"""
    fav = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == user_id,
        DiveSiteList.system_type == "favorites"
    ).first()
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

    wish = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == user_id,
        DiveSiteList.system_type == "wishlist"
    ).first()
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
        joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site)
    ).order_by(DiveSiteList.view_count.desc()).limit(50).all()

    # Resolve owners' usernames and sanitize
    for lst in lists:
        owner = db.query(User).filter(User.id == lst.user_id).first()
        lst.username = owner.username if owner else "unknown"
        sanitize_list_for_response(lst)

    return lists
