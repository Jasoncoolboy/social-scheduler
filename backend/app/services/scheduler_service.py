import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
from sqlalchemy.orm import Session
from app.config import settings
from app.database import SessionLocal

logger = logging.getLogger(__name__)

# ── Scheduler singleton ──────────────────────────────────────────────────────
jobstores = {
    "default": SQLAlchemyJobStore(url=settings.DATABASE_URL)
}
executors = {
    "default": ThreadPoolExecutor(max_workers=5)
}

scheduler = BackgroundScheduler(
    jobstores=jobstores,
    executors=executors,
    timezone="UTC"
)


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        logger.info("APScheduler started")


def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler shutdown")


# ── Job function ─────────────────────────────────────────────────────────────
def _execute_post_job(post_id: int):
    """
    This function runs in a background thread at scheduled time.
    """
    from app.models.post import Post, PostStatus
    from app.models.instagram_account import InstagramAccount
    from app.services.instagram_service import publish_post

    db: Session = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            logger.error(f"Post {post_id} not found")
            return

        if post.status != PostStatus.SCHEDULED:
            logger.info(f"Post {post_id} is not scheduled, skipping")
            return

        account = db.query(InstagramAccount).filter(
            InstagramAccount.id == post.instagram_account_id
        ).first()

        if not account:
            logger.error(f"Account not found for post {post_id}")
            return

        logger.info(f"Publishing post {post_id} for @{account.ig_username}")
        result = publish_post(account, post)

        if result["status"] == "success":
            post.status = PostStatus.PUBLISHED
            post.published_at = datetime.utcnow()
            post.error_message = None
            logger.info(f"Post {post_id} published successfully")
        else:
            post.status = PostStatus.FAILED
            post.error_message = result.get("message", "Unknown error")
            post.retry_count += 1
            logger.error(f"Post {post_id} failed: {post.error_message}")

        db.commit()

    except Exception as e:
        logger.error(f"Job error for post {post_id}: {e}")
        try:
            post = db.query(Post).filter(Post.id == post_id).first()  # type: ignore
            if post:
                from app.models.post import PostStatus
                post.status = PostStatus.FAILED
                post.error_message = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def schedule_post(post_id: int, run_at: datetime) -> str:
    """Schedule a post job, return job_id."""
    job_id = f"post_{post_id}"

    # Remove existing job if any
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    scheduler.add_job(
        _execute_post_job,
        trigger="date",
        run_date=run_at,
        args=[post_id],
        id=job_id,
        replace_existing=True,
        misfire_grace_time=300,  # allow 5min grace period
    )
    logger.info(f"Scheduled post {post_id} for {run_at}")
    return job_id


def cancel_post_job(post_id: int):
    """Remove a scheduled job."""
    job_id = f"post_{post_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"Cancelled job for post {post_id}")


def get_scheduled_jobs() -> list:
    """Return list of all scheduled jobs."""
    jobs = scheduler.get_jobs()
    return [
        {
            "job_id": job.id,
            "next_run": job.next_run_time,
        }
        for job in jobs
    ]