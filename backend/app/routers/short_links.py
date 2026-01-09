from fastapi import APIRouter, Depends, HTTPException, status, Path, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import string
import os
from urllib.parse import urlparse

from app.database import get_db
from app.models import ShortLink
from pydantic import BaseModel, HttpUrl

api_router = APIRouter()
redirect_router = APIRouter()

class ShortLinkCreate(BaseModel):
    url: HttpUrl

class ShortLinkResponse(BaseModel):
    short_url: str
    expires_at: datetime

def generate_short_id(length=6):
    """Generate a random short ID"""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

@api_router.post("/create", response_model=ShortLinkResponse)
async def create_short_link(
    link_data: ShortLinkCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Create a shortened URL for the given original URL.
    The link will expire in 1 week.
    The protocol and domain are stripped, storing only the relative path.
    """
    # Parse URL and strip scheme/domain to ensure safety (relative redirect)
    parsed_url = urlparse(str(link_data.url))
    
    # Reconstruct relative URL (path + params + query + fragment)
    relative_url = parsed_url.path
    if not relative_url:
        relative_url = "/"
    elif not relative_url.startswith("/"):
        relative_url = "/" + relative_url
        
    if parsed_url.params:
        relative_url += f";{parsed_url.params}"
    if parsed_url.query:
        relative_url += f"?{parsed_url.query}"
    if parsed_url.fragment:
        relative_url += f"#{parsed_url.fragment}"

    # 1 week TTL
    expires_at = datetime.now(timezone.utc) + timedelta(weeks=1)
    
    # Try to generate a unique ID (retrying if collision occurs, though unlikely)
    for _ in range(5):
        short_id = generate_short_id()
        existing = db.query(ShortLink).filter(ShortLink.id == short_id).first()
        if not existing:
            new_link = ShortLink(
                id=short_id,
                original_url=relative_url,
                expires_at=expires_at
            )
            db.add(new_link)
            db.commit()
            db.refresh(new_link)
            
            # Construct the full short URL
            # Use X-Forwarded-Proto/Host if available for correct scheme/domain
            scheme = request.headers.get("X-Forwarded-Proto", request.url.scheme)
            host = request.headers.get("Host", request.url.netloc)
            
            short_url = f"{scheme}://{host}/l/{short_id}"
            
            return ShortLinkResponse(short_url=short_url, expires_at=expires_at)
            
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate a unique short link ID"
    )


@redirect_router.get("/{short_id}")
async def redirect_short_link(
    short_id: str = Path(..., title="The short link ID"),
    db: Session = Depends(get_db)
):
    """
    Redirect to the original URL.
    """
    link = db.query(ShortLink).filter(ShortLink.id == short_id).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Short link not found")
    
    # Check expiration (ensure timezone awareness)
    now = datetime.now(timezone.utc)
    # Ensure link.expires_at is timezone-aware.
    # If it was stored without timezone info in DB but is UTC, we might need to fix it.
    # SQLAlchemy DateTime(timezone=True) should handle this, but let's be safe.
    
    if link.expires_at.tzinfo is None:
        # Assume UTC if naive
        link_expires_at = link.expires_at.replace(tzinfo=timezone.utc)
    else:
        link_expires_at = link.expires_at

    if now > link_expires_at:
        # Clean up expired link
        db.delete(link)
        db.commit()
        raise HTTPException(status_code=410, detail="Short link expired")
        
    return RedirectResponse(url=link.original_url)
