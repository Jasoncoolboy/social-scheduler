from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.user import User
from app.models.post import Post, PostStatus
from app.services.scheduler_service import get_scheduled_jobs
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base = db.query(Post).filter(Post.user_id == current_user.id)

    return {
        "total": base.count(),
        "draft": base.filter(Post.status == PostStatus.DRAFT).count(),
        "scheduled": base.filter(Post.status == PostStatus.SCHEDULED).count(),
        "published": base.filter(Post.status == PostStatus.PUBLISHED).count(),
        "failed": base.filter(Post.status == PostStatus.FAILED).count(),
        "scheduled_jobs": get_scheduled_jobs(),
    }


@router.get("/calendar")
def get_calendar_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return scheduled + published posts for calendar view."""
    posts = (
        db.query(Post)
        .filter(
            Post.user_id == current_user.id,
            Post.status.in_([PostStatus.SCHEDULED, PostStatus.PUBLISHED]),
        )
        .all()
    )

    return [
        {
            "id": p.id,
            "title": (p.caption or "No caption")[:50],
            "start": p.scheduled_at or p.published_at,
            "status": p.status,
            "post_type": p.post_type,
        }
        for p in posts
        if p.scheduled_at or p.published_at
    ]