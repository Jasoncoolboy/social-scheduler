from sqlalchemy import (
    Column, Integer, String, Boolean,
    DateTime, ForeignKey, Text, Enum
)
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class PostType(str, enum.Enum):
    FEED = "feed"
    STORY = "story"
    CAROUSEL = "carousel"


class PostStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class MediaType(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    instagram_account_id = Column(
        Integer,
        ForeignKey("instagram_accounts.id"),
        nullable=False
    )

    # Content
    caption = Column(Text, nullable=True)
    hashtags = Column(Text, nullable=True)      # comma-separated
    location = Column(String, nullable=True)

    # Type & Status
    post_type = Column(Enum(PostType), default=PostType.FEED)
    status = Column(Enum(PostStatus), default=PostStatus.DRAFT)

    # Scheduling
    scheduled_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    scheduler_job_id = Column(String, nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="posts")
    instagram_account = relationship("InstagramAccount", back_populates="posts")
    media_files = relationship(
        "PostMedia",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="PostMedia.order"
    )


class PostMedia(Base):
    __tablename__ = "post_media"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)

    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)   # local path
    media_type = Column(Enum(MediaType), nullable=False)
    mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    order = Column(Integer, default=0)           # for carousel order

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    post = relationship("Post", back_populates="media_files")