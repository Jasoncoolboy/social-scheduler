from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.post import PostType, PostStatus, MediaType


class PostMediaResponse(BaseModel):
    id: int
    file_name: str
    file_path: str
    media_type: MediaType
    mime_type: Optional[str]
    order: int

    class Config:
        from_attributes = True


class PostCreate(BaseModel):
    instagram_account_id: int
    caption: Optional[str] = None
    hashtags: Optional[str] = None
    location: Optional[str] = None
    post_type: PostType = PostType.FEED
    scheduled_at: Optional[datetime] = None


class PostUpdate(BaseModel):
    caption: Optional[str] = None
    hashtags: Optional[str] = None
    location: Optional[str] = None
    post_type: Optional[PostType] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[PostStatus] = None


class PostResponse(BaseModel):
    id: int
    instagram_account_id: int
    caption: Optional[str]
    hashtags: Optional[str]
    location: Optional[str]
    post_type: PostType
    status: PostStatus
    scheduled_at: Optional[datetime]
    published_at: Optional[datetime]
    error_message: Optional[str]
    retry_count: int
    created_at: datetime
    updated_at: datetime
    media_files: List[PostMediaResponse] = []

    class Config:
        from_attributes = True