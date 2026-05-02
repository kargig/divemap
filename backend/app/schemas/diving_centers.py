from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class CenterMediaCreate(BaseModel):
    media_type: str = Field(..., pattern=r"^(photo|video|external_link)$")
    url: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    medium_url: Optional[str] = Field(None, max_length=500)

class CenterMediaUpdate(BaseModel):
    description: Optional[str] = None

class CenterMediaResponse(BaseModel):
    id: int
    diving_center_id: int
    media_type: str
    url: str
    description: Optional[str] = None
    created_at: datetime
    user_id: Optional[int] = None
    user_username: Optional[str] = None
    thumbnail_url: Optional[str] = None
    medium_url: Optional[str] = None
    download_url: Optional[str] = None
    
    # Computed full URLs
    full_url: Optional[str] = None
    full_thumbnail_url: Optional[str] = None
    full_medium_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
