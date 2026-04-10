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
    SelectContactPointRecoveryForm,
    RecaptchaChallengeForm,
)
from sqlalchemy.orm import Session
from app.models.instagram_account import InstagramAccount
from datetime import datetime

logger = logging.getLogger(__name__)

_clients: dict[int, Client] = {}


def _challenge_code_handler(username, choice):
    """
    Called by instagrapi when challenge requires selecting contact point.
    Returns 0 to select email, 1 for phone.
    """
    logger.info(f"Challenge choice for {username}: {choice}")
    return 0  # select email by default


def _change_password_handler(username):
    """Called if Instagram requires password change — we skip."""
    return None


def _get_client(account: InstagramAccount) -> Client:
    if account.id in _clients:
        return _clients[account.id]

    cl = Client()
    cl.delay_range = [2, 5]
    cl.challenge_code_handler = _challenge_code_handler
    cl.change_password_handler = _change_password_handler

    if account.session_data:
        try:
            session = json.loads(account.session_data)
            cl.set_settings(session)
            cl.get_timeline_feed()
            _clients[account.id] = cl
            return cl
        except Exception:
            logger.warning(f"Session invalid for {account.ig_username}")

    raise LoginRequired("No valid session, please login again")


def login_instagram(
    ig_username: str,
    ig_password: str,
    db: Session,
    user_id: int,
    verification_code: Optional[str] = None,
) -> dict:
    cl = Client()
    cl.delay_range = [2, 5]
    cl.challenge_code_handler = _challenge_code_handler
    cl.change_password_handler = _change_password_handler

    try:
        if verification_code:
            cl.login(
                ig_username,
                ig_password,
                verification_code=verification_code
            )
        else:
            cl.login(ig_username, ig_password)

        return _save_session(cl, ig_username, ig_password, db, user_id)

    except BadPassword:
        return {"status": "error", "message": "Invalid Instagram password"}

    except TwoFactorRequired:
        # Store the partial client so we can complete login later
        _pending_clients[ig_username] = (cl, ig_password)
        return {
            "status": "two_factor_required",
            "message": "Two-factor authentication required",
        }

    except ChallengeRequired:
        # Try to resolve challenge automatically
        try:
            logger.info(f"Attempting to resolve challenge for {ig_username}")
            cl.challenge_resolve(cl.last_json)
            # If resolved, save session
            return _save_session(cl, ig_username, ig_password, db, user_id)
        except Exception as challenge_err:
            logger.warning(f"Auto challenge resolve failed: {challenge_err}")
            # Store client for manual resolution
            _pending_clients[ig_username] = (cl, ig_password)
            return {
                "status": "challenge_required",
                "message": "Instagram requires verification. Check your Instagram app, email, or SMS for an approval notification. Once approved, click 'Try Again'.",
                "ig_username": ig_username,
            }

    except SelectContactPointRecoveryForm:
        _pending_clients[ig_username] = (cl, ig_password)
        return {
            "status": "challenge_required",
            "message": "Instagram requires contact point verification. Check your email or SMS.",
            "ig_username": ig_username,
        }

    except Exception as e:
        logger.error(f"Instagram login error: {e}")
        return {"status": "error", "message": str(e)}


# Store pending (mid-challenge) clients
_pending_clients: dict[str, tuple] = {}


def retry_after_challenge(
    ig_username: str,
    db: Session,
    user_id: int,
) -> dict:
    """
    Called when user has approved challenge in Instagram app
    and clicks 'Try Again' — no code needed.
    """
    if ig_username not in _pending_clients:
        return {
            "status": "error",
            "message": "No pending login found. Please try connecting again.",
        }

    cl, ig_password = _pending_clients[ig_username]

    try:
        # Try to get timeline — if challenge was approved, this works
        cl.get_timeline_feed()
        result = _save_session(cl, ig_username, ig_password, db, user_id)
        del _pending_clients[ig_username]
        return result
    except Exception:
        pass

    # Try re-login
    try:
        cl.login(ig_username, ig_password)
        result = _save_session(cl, ig_username, ig_password, db, user_id)
        del _pending_clients[ig_username]
        return result
    except Exception as e:
        return {
            "status": "error",
            "message": f"Still blocked: {str(e)}. Try again in a few minutes.",
        }


def _save_session(
    cl: Client,
    ig_username: str,
    ig_password: str,
    db: Session,
    user_id: int,
) -> dict:
    """Save Instagram session to database."""
    user_info = cl.account_info()
    session_data = json.dumps(cl.get_settings())

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
    _clients[account.id] = cl

    return {
        "status": "success",
        "account_id": account.id,
        "ig_username": account.ig_username,
        "ig_full_name": account.ig_full_name,
    }


def logout_instagram(account_id: int):
    if account_id in _clients:
        try:
            _clients[account_id].logout()
        except Exception:
            pass
        del _clients[account_id]


def publish_post(account: InstagramAccount, post) -> dict:
    try:
        cl = _get_client(account)
        media_files = post.media_files

        if not media_files:
            return {"status": "error", "message": "No media files found"}

        caption = post.caption or ""
        if post.hashtags:
            caption = f"{caption}\n\n{post.hashtags}"

        if post.post_type == "story":
            media = media_files[0]
            if media.media_type == "video":
                cl.video_upload_to_story(media.file_path, caption=caption)
            else:
                cl.photo_upload_to_story(media.file_path, caption=caption)
        elif post.post_type == "carousel":
            paths = [Path(m.file_path) for m in media_files]
            cl.album_upload(paths, caption=caption)
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