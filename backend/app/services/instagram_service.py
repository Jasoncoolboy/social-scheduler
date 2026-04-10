import json
import logging
from typing import Optional
from pathlib import Path
from instagrapi import Client
from instagrapi.exceptions import (
    LoginRequired,
    ChallengeRequired,
    TwoFactorRequired,
    BadPassword,
)
from sqlalchemy.orm import Session
from app.models.instagram_account import InstagramAccount
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory client cache {account_id: Client}
_clients: dict[int, Client] = {}


def _get_client(account: InstagramAccount) -> Client:
    """Get or create an instagrapi client for an account."""
    if account.id in _clients:
        return _clients[account.id]

    cl = Client()
    cl.delay_range = [2, 5]  # human-like delays between requests

    if account.session_data:
        try:
            session = json.loads(account.session_data)
            cl.set_settings(session)
            cl.get_timeline_feed()  # test if session is valid
            _clients[account.id] = cl
            return cl
        except Exception:
            logger.warning(
                f"Session invalid for {account.ig_username}, need re-login"
            )

    raise LoginRequired("No valid session, please login again")


def login_instagram(
    ig_username: str,
    ig_password: str,
    db: Session,
    user_id: int,
    verification_code: Optional[str] = None,
) -> dict:
    """
    Login to Instagram and save session.
    Returns dict with status and info.
    """
    cl = Client()
    cl.delay_range = [2, 5]

    try:
        if verification_code:
            cl.login(ig_username, ig_password, verification_code=verification_code)
        else:
            cl.login(ig_username, ig_password)

        # Get account info
        user_info = cl.account_info()
        session_data = json.dumps(cl.get_settings())

        # Save or update account in DB
        account = (
            db.query(InstagramAccount)
            .filter(
                InstagramAccount.ig_username == ig_username,
                InstagramAccount.user_id == user_id,
            )
            .first()
        )

        if account:
            account.session_data = session_data
            account.ig_user_id = str(user_info.pk)
            account.ig_full_name = user_info.full_name
            account.ig_profile_pic_url = str(user_info.profile_pic_url)
            account.last_login = datetime.utcnow()
            account.is_active = True
        else:
            account = InstagramAccount(
                user_id=user_id,
                ig_username=ig_username,
                ig_user_id=str(user_info.pk),
                ig_full_name=user_info.full_name,
                ig_profile_pic_url=str(user_info.profile_pic_url),
                session_data=session_data,
                last_login=datetime.utcnow(),
            )
            db.add(account)

        db.commit()
        db.refresh(account)

        # Cache client
        _clients[account.id] = cl

        return {
            "status": "success",
            "account_id": account.id,
            "ig_username": account.ig_username,
            "ig_full_name": account.ig_full_name,
        }

    except BadPassword:
        return {"status": "error", "message": "Invalid Instagram password"}
    except TwoFactorRequired:
        return {
            "status": "two_factor_required",
            "message": "Two-factor authentication required",
        }
    except ChallengeRequired:
        return {
            "status": "challenge_required",
            "message": "Instagram challenge required — check your email/SMS",
        }
    except Exception as e:
        logger.error(f"Instagram login error: {e}")
        return {"status": "error", "message": str(e)}


def publish_post(account: InstagramAccount, post) -> dict:
    """
    Publish a post or story to Instagram.
    Returns dict with status.
    """
    try:
        cl = _get_client(account)
        media_files = post.media_files

        if not media_files:
            return {"status": "error", "message": "No media files found"}

        caption = post.caption or ""
        if post.hashtags:
            caption = f"{caption}\n\n{post.hashtags}"

        # STORY
        if post.post_type == "story":
            media = media_files[0]
            if media.media_type == "video":
                cl.video_upload_to_story(media.file_path, caption=caption)
            else:
                cl.photo_upload_to_story(media.file_path, caption=caption)

        # CAROUSEL
        elif post.post_type == "carousel":
            paths = [Path(m.file_path) for m in media_files]
            cl.album_upload(paths, caption=caption)

        # SINGLE FEED (image or video)
        else:
            media = media_files[0]
            if media.media_type == "video":
                cl.video_upload(Path(media.file_path), caption=caption)
            else:
                cl.photo_upload(Path(media.file_path), caption=caption)

        return {"status": "success"}

    except LoginRequired:
        return {"status": "error", "message": "Session expired, please re-login"}
    except Exception as e:
        logger.error(f"Publish error for post {post.id}: {e}")
        return {"status": "error", "message": str(e)}


def logout_instagram(account_id: int):
    """Remove cached client."""
    if account_id in _clients:
        try:
            _clients[account_id].logout()
        except Exception:
            pass
        del _clients[account_id]