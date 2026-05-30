from fastapi import Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from .dives_shared import router, get_db, get_current_user, User, Dive, r2_storage, joinedload
from app.models import DiveMedia, SiteMedia
from app.services.social_image_service import SocialImageService
from app.services.dive_profile_parser import DiveProfileParser
from app.utils import slugify
import httpx
import orjson
import os
from urllib.parse import urlparse
from typing import Set

# SSRF Protection Constants
ALLOWED_MEDIA_URL_SCHEMES: Set[str] = {"https"}

def _is_allowed_media_host(hostname: str) -> bool:
    """Check if the hostname is one of our trusted R2 domains."""
    hostname = hostname.lower()
    trusted_domains = []
    
    account_id = os.getenv("R2_ACCOUNT_ID")
    if account_id:
        trusted_domains.append(f"{account_id}.r2.cloudflarestorage.com")
        trusted_domains.append(f"pub-{account_id}.r2.dev")
        
    public_domain = os.getenv("R2_PUBLIC_DOMAIN")
    if public_domain:
        trusted_domains.append(public_domain.lower())
        
    return hostname in trusted_domains

def _build_canonical_media_url(validated_media_url: str) -> str:
    """
    Build a canonical outbound URL from an already validated media URL.
    This avoids using a fully user-controlled URL string at the request sink.
    """
    parsed = urlparse(validated_media_url)
    if parsed.scheme.lower() not in ALLOWED_MEDIA_URL_SCHEMES or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid media_url")
    
    # Reject URL features we do not need for media retrieval.
    if parsed.username or parsed.password or parsed.params or parsed.fragment:
        raise HTTPException(status_code=400, detail="Invalid media_url format")
    
    # Reconstruct canonical URL. We include query because R2 presigned URLs need it.
    canonical_url = f"https://{parsed.hostname}{parsed.path or ''}"
    if parsed.query:
        canonical_url += f"?{parsed.query}"
    return canonical_url

def _validate_media_url(media_url: str) -> str:
    """
    Validate the media_url to prevent SSRF.
    Allows trusted R2 domains and local /uploads paths.
    """
    # Allow local relative paths for development
    if media_url.startswith("/uploads/"):
        # Prevent path traversal
        if ".." in media_url or media_url.startswith("//"):
             raise HTTPException(status_code=400, detail="Invalid local media_url path")
        return media_url
        
    parsed = urlparse(media_url)
    
    if parsed.scheme.lower() not in ALLOWED_MEDIA_URL_SCHEMES:
        raise HTTPException(status_code=400, detail="Invalid media_url scheme")
        
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid media_url host")
        
    if not _is_allowed_media_host(parsed.hostname):
        raise HTTPException(status_code=400, detail="Invalid media_url: untrusted domain")
        
    return media_url

@router.post("/{dive_id}/social-image")
async def generate_social_image(
    dive_id: int,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates a social-media-friendly image for a dive.
    Payload: {"media_url": str, "crop": dict}
    """
    dive = db.query(Dive).options(joinedload(Dive.dive_site)).filter(Dive.id == dive_id).first()
    if not dive:
        raise HTTPException(status_code=404, detail="Dive not found")
    
    # Access control
    if dive.is_private and dive.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    media_url = payload.get("media_url")
    media_id = payload.get("media_id")
    crop = payload.get("crop")
    
    if not media_url and not media_id:
        raise HTTPException(status_code=400, detail="media_url or media_id is required")

    # SSRF Protection Step 1: Validate/Lookup the media
    dive_media_record = None
    site_media_record = None
    
    if media_id:
        # Preferred: Lookup by ID
        dive_media_record = db.query(DiveMedia).filter(
            DiveMedia.id == media_id,
            DiveMedia.dive_id == dive_id
        ).first()
        
        if not dive_media_record and dive.dive_site_id:
            site_media_record = db.query(SiteMedia).filter(
                SiteMedia.id == media_id,
                SiteMedia.dive_site_id == dive.dive_site_id
            ).first()
    else:
        # Fallback: Lookup by URL (format-aware)
        from sqlalchemy import literal
        validated_url = _validate_media_url(media_url)
        
        # Check if the URL matches the record. We handle R2 paths vs presigned URLs by checking both
        dive_media_record = db.query(DiveMedia).filter(
            DiveMedia.dive_id == dive_id
        ).filter(
            (DiveMedia.url == validated_url) | 
            (literal(media_url).like('%' + DiveMedia.url + '%')) # Handle presigned URL containing the path
        ).first()
        
        if not dive_media_record and dive.dive_site_id:
            site_media_record = db.query(SiteMedia).filter(
                SiteMedia.dive_site_id == dive.dive_site_id
            ).filter(
                (SiteMedia.url == validated_url) |
                (literal(media_url).like('%' + SiteMedia.url + '%'))
            ).first()
        
    if not dive_media_record and not site_media_record:
        raise HTTPException(status_code=403, detail="Not authorized: media does not belong to this dive or site")

    # Use the URL from our database as the trusted source
    trusted_media_url = dive_media_record.url if dive_media_record else site_media_record.url
    
    # If it's a relative R2 path, we need to generate a full URL to fetch it
    # BUT wait, the SocialImageService needs the image bytes.
    # We can fetch it via R2 storage service directly if it's an R2 path
    
    # SSRF Protection Step 3: Validate and Canonicalize the trusted URL
    # Hardening: Build canonical outbound URL from trusted components
    if trusted_media_url.startswith("user_"):
        # It's an R2 path, generate a presigned URL for internal fetching
        # We use a short expiry
        fetch_url = r2_storage.get_photo_url(trusted_media_url, expires_in=60)
        outbound_media_url = fetch_url
    else:
        trusted_validated_url = _validate_media_url(trusted_media_url)
        outbound_media_url = trusted_validated_url if trusted_validated_url.startswith("/") else _build_canonical_media_url(trusted_validated_url)

    # Fetch image from R2 or local storage
    try:
        if outbound_media_url.startswith("/"):
            # Internal fetch for local files
            full_media_url = f"http://localhost:8000{outbound_media_url}"
            async with httpx.AsyncClient() as client:
                resp = await client.get(full_media_url, follow_redirects=False)
        else:
            async with httpx.AsyncClient() as client:
                # follow_redirects=False is a critical security measure against redirect-based SSRF
                resp = await client.get(outbound_media_url, follow_redirects=False)
                
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Could not fetch image")
        image_bytes = resp.content
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching image: {str(e)}")

    # Fetch and parse profile
    profile_data = None
    if dive.profile_xml_path:
        profile_content = r2_storage.download_profile(dive.user_id, dive.profile_xml_path)
        if profile_content:
            if dive.profile_xml_path.endswith('.json'):
                profile_data = orjson.loads(profile_content)
            else:
                parser = DiveProfileParser()
                profile_data = parser.parse_xml_content(
                    profile_content.decode('utf-8') if isinstance(profile_content, bytes) else profile_content
                )

    # Generate image
    social_service = SocialImageService()
    
    # Construct short shareable URL
    base_url = f"{request.url.scheme}://{request.url.netloc}"
    full_url = f"{base_url}/dives/{dive.id}"
    
    metrics = payload.get("metrics")
    image_data = social_service.generate(dive, profile_data, image_bytes, crop, full_url=full_url, requested_metrics=metrics)

    return Response(
        content=image_data,
        media_type="image/jpeg",
        headers={"Content-Disposition": f"attachment; filename=dive_{dive_id}_social.jpg"}
    )
