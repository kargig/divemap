from fastapi import Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from .dives_shared import router, get_db, get_current_user, User, Dive, r2_storage, joinedload
from app.services.social_image_service import SocialImageService
from app.services.dive_profile_parser import DiveProfileParser
from app.utils import slugify
import httpx
import orjson

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
    crop = payload.get("crop")
    
    if not media_url:
        raise HTTPException(status_code=400, detail="media_url is required")

    # Fetch image from R2 or external URL
    # For now, let's assume it's an R2 URL or full URL
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(media_url)
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
    
    image_data = social_service.generate(dive, profile_data, image_bytes, crop, full_url=full_url)

    return Response(
        content=image_data,
        media_type="image/jpeg",
        headers={"Content-Disposition": f"attachment; filename=dive_{dive_id}_social.jpg"}
    )
