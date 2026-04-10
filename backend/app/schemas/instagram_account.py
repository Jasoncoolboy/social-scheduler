from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class InstagramLoginRequest(BaseModel):
    ig_username: str
    ig_password: str


class InstagramAccountResponse(BaseModel):
    id: int
    ig_username: str
    ig_user_id: Optional[str]
    ig_full_name: Optional[str]
    ig_profile_pic_url: Optional[str]
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class VerificationCodeRequest(BaseModel):
    ig_username: str
    code: str