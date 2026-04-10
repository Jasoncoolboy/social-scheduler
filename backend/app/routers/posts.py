from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.post import Post, PostMedia, PostStatus, PostType
from app.models.instagram_account import InstagramAccount
from app.schemas.post import PostCreate, PostUpdate, PostResponse
from app.services.media_service import save_upload_file, delete_media_file
from app.services.scheduler_service import schedule_post, cancel_post_job
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/posts", tags=["posts"])


def _get_post_or_404(post_id: int, user_id: int, db: Session) -> Post:
    post = (
        db.query(Post)
        .filter(Post.id == post_id, Post.user_id == user_id)
        .first()
    )
    if not post:
        raise HTTPException(404, "Post not found")
    return post


@router.get("/", response_model=List[PostResponse])
def list_posts(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Post).filter(Post.user_id == current_user.id)
    if status:
        query = query.filter(Post.status == status)
    return query.order_by(Post.created_at.desc()).all()


@router.post("/", response_model=PostResponse, status_code=201)
def create_post(
    data: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify account belongs to user
    account = (
        db.query(InstagramAccount)
        .filter(
            InstagramAccount.id == data.instagram_account_id,
            InstagramAccount.user_id == current_user.id,
        )
        .first()
    )
    if not account:
        raise HTTPException(404, "Instagram account not found")

    post = Post(
        user_id=current_user.id,
        instagram_account_id=data.instagram_account_id,
        caption=data.caption,
        hashtags=data.hashtags,
        location=data.location,
        post_type=data.post_type,
        scheduled_at=data.scheduled_at,
        status=PostStatus.DRAFT,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_post_or_404(post_id, current_user.id, db)


@router.patch("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: int,
    data: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(post_id, current_user.id, db)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(post, field, value)

    db.commit()
    db.refresh(post)
    return post


@router.post("/{post_id}/media", response_model=PostResponse)
async def upload_media(
    post_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(post_id, current_user.id, db)

    try:
        file_data = await save_upload_file(file)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Determine order
    order = len(post.media_files)

    media = PostMedia(
        post_id=post.id,
        file_name=file_data["file_name"],
        file_path=file_data["file_path"],
        media_type=file_data["media_type"],
        mime_type=file_data["mime_type"],
        file_size=file_data["file_size"],
        order=order,
    )
    db.add(media)
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}/media/{media_id}")
def delete_media(
    post_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(post_id, current_user.id, db)
    media = (
        db.query(PostMedia)
        .filter(PostMedia.id == media_id, PostMedia.post_id == post.id)
        .first()
    )
    if not media:
        raise HTTPException(404, "Media not found")

    delete_media_file(media.file_path)
    db.delete(media)
    db.commit()
    return {"message": "Media deleted"}


@router.post("/{post_id}/schedule", response_model=PostResponse)
def schedule(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(post_id, current_user.id, db)

    if not post.media_files:
        raise HTTPException(400, "Post must have at least one media file")
    if not post.scheduled_at:
        raise HTTPException(400, "Post must have a scheduled_at time")
    if post.scheduled_at < datetime.utcnow():
        raise HTTPException(400, "Scheduled time must be in the future")

    job_id = schedule_post(post.id, post.scheduled_at)
    post.status = PostStatus.SCHEDULED
    post.scheduler_job_id = job_id
    db.commit()
    db.refresh(post)
    return post


@router.post("/{post_id}/publish-now", response_model=PostResponse)
def publish_now(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.instagram_service import publish_post

    post = _get_post_or_404(post_id, current_user.id, db)

    if not post.media_files:
        raise HTTPException(400, "Post must have at least one media file")

    account = db.query(InstagramAccount).filter(
        InstagramAccount.id == post.instagram_account_id
    ).first()

    result = publish_post(account, post)

    if result["status"] == "success":
        post.status = PostStatus.PUBLISHED
        post.published_at = datetime.utcnow()
    else:
        post.status = PostStatus.FAILED
        post.error_message = result.get("message")

    db.commit()
    db.refresh(post)
    return post


@router.post("/{post_id}/cancel", response_model=PostResponse)
def cancel_schedule(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(post_id, current_user.id, db)

    if post.status != PostStatus.SCHEDULED:
        raise HTTPException(400, "Post is not scheduled")

    cancel_post_job(post.id)
    post.status = PostStatus.DRAFT
    post.scheduler_job_id = None
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(post_id, current_user.id, db)

    # Cancel any scheduled job
    if post.status == PostStatus.SCHEDULED:
        cancel_post_job(post.id)

    # Delete media files
    for media in post.media_files:
        delete_media_file(media.file_path)

    db.delete(post)
    db.commit()
    return {"message": "Post deleted"}