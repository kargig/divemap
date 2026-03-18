from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class PATBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name for the token")
    expires_in_days: Optional[int] = Field(None, description="Number of days until the token expires. If null, it never expires.")

class PATCreate(PATBase):
    pass

class PATResponse(BaseModel):
    id: int
    name: str
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PATCreateResponse(PATResponse):
    token: str = Field(..., description="The actual plain text token (ONLY SHOWN ONCE)")
    warning: str = Field("Store this token securely. It will not be shown again.", description="A warning message")
