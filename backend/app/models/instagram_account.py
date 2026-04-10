from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class InstagramAccount(Base):
    __tablename__ = "instagram_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Instagram info
    ig_username = Column(String, nullable=False)
    ig_user_id = Column(String, nullable=True)
    ig_full_name = Column(String, nullable=True)
    ig_profile_pic_url = Column(String, nullable=True)

    # Session (encrypted ideally, for now plain)
    session_data = Column(Text, nullable=True)  # JSON string of session
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="instagram_accounts")
    posts = relationship(
        "Post",
        back_populates="instagram_account",
        cascade="all, delete-orphan"
    )