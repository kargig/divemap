from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CenterMediaCreate(BaseModel):
    media_type: str = Field(..., pattern=r"^(photo|video|external_link)$")
    url: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    thumbnail_url: str | None = Field(None, max_length=500)
    medium_url: str | None = Field(None, max_length=500)


class CenterMediaUpdate(BaseModel):
    description: str | None = None


class CenterMediaResponse(BaseModel):
    id: int
    diving_center_id: int
    media_type: str
    url: str
    description: str | None = None
    created_at: datetime
    user_id: int | None = None
    user_username: str | None = None
    thumbnail_url: str | None = None
    medium_url: str | None = None
    download_url: str | None = None

    # Computed full URLs
    full_url: str | None = None
    full_thumbnail_url: str | None = None
    full_medium_url: str | None = None

    model_config = ConfigDict(from_attributes=True)
