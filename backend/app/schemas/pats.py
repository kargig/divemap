from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PATBase(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Human-readable name for the token",
    )
    expires_in_days: int | None = Field(
        None,
        description="Number of days until the token expires. If null, it never expires.",
    )


class PATCreate(PATBase):
    pass


class PATResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    expires_at: datetime | None
    last_used_at: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PATCreateResponse(PATResponse):
    token: str = Field(..., description="The actual plain text token (ONLY SHOWN ONCE)")
    warning: str = Field(
        "Store this token securely. It will not be shown again.",
        description="A warning message",
    )
