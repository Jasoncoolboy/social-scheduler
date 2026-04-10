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

_clients: dict[int, Client] = {}
_pending_clients: dict[str, tuple] = {}


def _detect_challenge_type(cl: Client) -> str:
    """
    Detect what kind of challenge Instagram is asking for.
    Returns: 'code' | 'approve' | 'unknown'
    """
    try:
        last = cl.last_json or {}
        logger.info(f"Challenge last_json: {last}")

        step_name = last.get("step_name", "")
        challenge = last.get("challenge", {})
        api_path = challenge.get("api_path", "")

        # Instagram sends a push notification to the app — no code needed
        if step_name in ("select_verify_method", "delta_login_review"):
            return "approve"

        # Instagram will send a code via SMS or email
        if step_name in ("verify_code", "submit_phone", "verify_email"):
            return "code"

        # Check api_path for hints
        if "review" in api_path.lower():
            return "approve"
        if "code" in api_path.lower() or "verify" in api_path.lower():
            return "code"

        # Check bloks data (newer Instagram API format)
        bloks = last.get("challenge", {})
        if "url" in bloks:
            url = bloks["url"]
            if "review" in url:
                return "approve"
            if "code" in url or "verify" in url:
                return "code"

        return "approve"  # default to approve if unsure

    except Exception as e:
        logger.warning(f"Could not detect challenge type: {e}")
        return "approve"


def validate_all_sessions(db: Session):
    """Validate all saved sessions on startup."""
    accounts = db.query(InstagramAccount).filter(
        InstagramAccount.session_data.isnot(None),
        InstagramAccount.is_active == True,
    ).all()

    for account in accounts:
        try:
            cl = Client()
            cl.delay_range = [1, 2]
            session = json.loads(account.session_data)
            cl.set_settings(session)
            cl.get_timeline_feed()
            _clients[account.id] = cl
            logger.info(f" Session valid: @{account.ig_username}")
        except Exception as e:
            logger.warning(f" Session expired: @{account.ig_username} — {e}")
            account.is_active = False
            db.commit()


def _get_client(account: InstagramAccount) -> Client:
    if account.id in _clients:
        return _clients[account.id]

    cl = Client()
    cl.delay_range = [2, 5]

    if account.session_data:
        try:
            session = json.loads(account.session_data)
            cl.set_settings(session)
            cl.get_timeline_feed()
            _clients[account.id] = cl
            return cl
        except Exception:
            logger.warning(f"Session invalid for @{account.ig_username}")

    raise LoginRequired("Session expired — please re-login")


def login_instagram(
    ig_username: str,
    ig_password: str,
    db: Session,
    user_id: int,
    verification_code: Optional[str] = None,
) -> dict:
    cl = Client()
    cl.delay_range = [2, 5]

    try:
        if verification_code:
            cl.login(ig_username, ig_password, verification_code=verification_code)
        else:
            cl.login(ig_username, ig_password)

        return _save_session(cl, ig_username, db, user_id)

    except BadPassword:
        return {"status": "error", "message": "Incorrect Instagram password"}

    except TwoFactorRequired:
        _pending_clients[ig_username] = (cl, ig_password)
        logger.info(f"2FA required for @{ig_username}")
        return {
            "status": "two_factor_required",
            "message": "Enter the 6-digit code from your authenticator app or SMS",
        }

    except ChallengeRequired:
        challenge_type = _detect_challenge_type(cl)
        logger.info(f"Challenge type for @{ig_username}: {challenge_type}")

        # Try auto-resolve first
        try:
            cl.challenge_resolve(cl.last_json)
            # If auto-resolve worked, try saving session
            return _save_session(cl, ig_username, db, user_id)
        except Exception as e:
            logger.info(f"Auto-resolve failed ({e}), storing pending client")

        _pending_clients[ig_username] = (cl, ig_password)

        if challenge_type == "code":
            return {
                "status": "challenge_code_required",
                "message": "Instagram sent a verification code to your email or phone",
                "ig_username": ig_username,
                "challenge_type": "code",
            }
        else:
            return {
                "status": "challenge_required",
                "message": "Instagram sent a login approval to your app",
                "ig_username": ig_username,
                "challenge_type": "approve",
            }

    except Exception as e:
        logger.error(f"Login error for @{ig_username}: {e}")
        return {"status": "error", "message": str(e)}


def submit_challenge_code(
    ig_username: str,
    code: str,
    db: Session,
    user_id: int,
) -> dict:
    """Submit a verification code sent by Instagram via SMS/email."""
    if ig_username not in _pending_clients:
        return {
            "status": "error",
            "message": "No pending login — please try connecting again",
        }

    cl, ig_password = _pending_clients[ig_username]

    try:
        cl.challenge_send_security_code(code)
        result = _save_session(cl, ig_username, db, user_id)
        _pending_clients.pop(ig_username, None)
        return result
    except Exception as e:
        logger.error(f"Challenge code error for @{ig_username}: {e}")
        return {"status": "error", "message": f"Invalid code: {str(e)}"}


def retry_after_challenge(
    ig_username: str,
    db: Session,
    user_id: int,
) -> dict:
    """Retry after user approved login in Instagram app."""
    if ig_username not in _pending_clients:
        return {
            "status": "error",
            "message": "No pending login — please try connecting again",
        }

    cl, ig_password = _pending_clients[ig_username]

    # Test if challenge was approved
    try:
        cl.get_timeline_feed()
        result = _save_session(cl, ig_username, db, user_id)
        _pending_clients.pop(ig_username, None)
        return result
    except Exception:
        pass

    # Try re-login
    try:
        cl2 = Client()
        cl2.delay_range = [2, 5]
        cl2.login(ig_username, ig_password)
        result = _save_session(cl2, ig_username, db, user_id)
        _pending_clients.pop(ig_username, None)
        return result
    except Exception as e:
        return {
            "status": "error",
            "message": "Still blocked — approve in Instagram app then try again",
        }


def _save_session(
    cl: Client,
    ig_username: str,
    db: Session,
    user_id: int,
) -> dict:
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
                cl.video_upload_to_story(media.file_path)
            else:
                cl.photo_upload_to_story(media.file_path)
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
        return {"status": "error", "message": "Session expired — please re-login"}
    except Exception as e:
        logger.error(f"Publish error for post {post.id}: {e}")
        return {"status": "error", "message": str(e)}