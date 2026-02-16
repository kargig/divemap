from pydantic import BaseModel, Field

class PasswordResetRequest(BaseModel):
    """Request to initiate password reset."""
    email_or_username: str = Field(..., min_length=1, max_length=255, description="Email or username")

class PasswordResetConfirm(BaseModel):
    """Request to complete password reset."""
    token: str = Field(..., min_length=1, description="Password reset token")
    new_password: str = Field(..., min_length=8, max_length=128)
