import json
import logging
from typing import Optional
from pathlib import Path
import uuid
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

# In-memory stores
_clients: dict[int, Client] = {}
_pending_clients: dict[str, dict] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_pending_usernames() -> list:
    return [data.get("ig_username") for data in _pending_clients.values() if data.get("ig_username")]


def _get_pending(flow_id: Optional[str], user_id: int, ig_username: Optional[str] = None) -> Optional[dict]:
    """Resolve a pending login by flow id and owner."""
    if flow_id:
        pending = _pending_clients.get(flow_id)
        if pending and pending.get("user_id") == user_id:
            if ig_username and pending.get("ig_username") != ig_username:
                return None
            return pending
        return None

    # Backward compatibility: allow lookup by username for old clients.
    if ig_username:
        for pending in _pending_clients.values():
            if (
                pending.get("user_id") == user_id
                and pending.get("ig_username") == ig_username
            ):
                return pending
    return None


def _new_flow_id() -> str:
    return uuid.uuid4().hex


def _detect_challenge_type(cl: Client) -> str:
    """Detect if Instagram wants a code or app approval."""
    try:
        last      = cl.last_json or {}
        step_name = last.get("step_name", "")
        api_path  = last.get("challenge", {}).get("api_path", "")

        logger.info(f"Challenge step_name={step_name} api_path={api_path}")

        if step_name in ("delta_login_review", "select_verify_method"):
            return "approve"
        if step_name in ("verify_code", "submit_phone", "verify_email"):
            return "code"
        if "review" in api_path.lower():
            return "approve"
        if "code" in api_path.lower() or "verify" in api_path.lower():
            return "code"

        return "approve"

    except Exception as e:
        logger.warning(f"Could not detect challenge type: {e}")
        return "approve"


# ── Session validation on startup ────────────────────────────────────────────

def validate_all_sessions(db: Session):
    """Validate all saved Instagram sessions on app startup."""
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
            logger.info(f"✅ Session valid: @{account.ig_username}")
        except Exception as e:
            logger.warning(
                f"❌ Session expired: @{account.ig_username} — {e}"
            )
            account.is_active = False
            db.commit()


# ── Get cached client ─────────────────────────────────────────────────────────

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

    raise LoginRequired("Session expired — please re-login in Settings")


# ── Login ─────────────────────────────────────────────────────────────────────

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
        cl.login(ig_username, ig_password)
        return _save_session(cl, ig_username, db, user_id)

    except BadPassword:
        return {
            "status": "error",
            "message": "Incorrect Instagram password",
        }

    except TwoFactorRequired:
        last = cl.last_json or {}
        tfi  = last.get("two_factor_info", {})
        logger.info(f"TwoFactorRequired for @{ig_username} | tfi: {tfi}")

        available_methods = []
        if tfi.get("sms_two_factor_on"):
            available_methods.append("sms")
        if tfi.get("whatsapp_two_factor_on"):
            available_methods.append("whatsapp")
        if tfi.get("totp_two_factor_on"):
            available_methods.append("totp")

        if tfi.get("totp_two_factor_on"):
            hint   = "Enter the code from your authenticator app"
            method = "totp"
        elif tfi.get("whatsapp_two_factor_on"):
            hint   = f"Enter the WhatsApp code sent to {tfi.get('obfuscated_phone_number_2', 'your phone')}"
            method = "whatsapp"
        else:
            hint   = f"Enter the SMS code sent to {tfi.get('obfuscated_phone_number_2', 'your phone')}"
            method = "sms"

        flow_id = _new_flow_id()
        _pending_clients[flow_id] = {
            "flow_id":   flow_id,
            "user_id":   user_id,
            "ig_username": ig_username,
            "client":    cl,
            "password":  ig_password,
            "type":      "2fa",
            "last_json": last,
        }

        return {
            "status":      "two_factor_required",
            "message":     hint,
            "ig_username": ig_username,
            "flow_id": flow_id,
            "method":      method,
            "available_methods": available_methods,
            "phone_hint":  tfi.get("obfuscated_phone_number_2", ""),
        }

    except ChallengeRequired:
        challenge_type = _detect_challenge_type(cl)
        logger.info(f"ChallengeRequired ({challenge_type}) for @{ig_username}")

        try:
            cl.challenge_resolve(cl.last_json)
            logger.info(f"Auto-resolve succeeded for @{ig_username}")
            return _save_session(cl, ig_username, db, user_id)
        except Exception as e:
            logger.info(f"Auto-resolve failed: {e}")

        flow_id = _new_flow_id()
        _pending_clients[flow_id] = {
            "flow_id":   flow_id,
            "user_id":   user_id,
            "ig_username": ig_username,
            "client":    cl,
            "password":  ig_password,
            "type":      challenge_type,
            "last_json": cl.last_json or {},
        }

        if challenge_type == "code":
            return {
                "status":         "challenge_code_required",
                "message":        "Instagram sent a code to your email or phone",
                "ig_username":    ig_username,
                "flow_id": flow_id,
                "challenge_type": "code",
            }
        else:
            return {
                "status":         "challenge_required",
                "message":        "Check the Instagram app and approve the login",
                "ig_username":    ig_username,
                "flow_id": flow_id,
                "challenge_type": "approve",
            }

    except Exception as e:
        logger.error(f"Login error for @{ig_username}: {e}")
        return {"status": "error", "message": str(e)}


# ── Submit 2FA code ───────────────────────────────────────────────────────────

def submit_two_factor_code(
    ig_username: str,
    code: str,
    db: Session,
    user_id: int,
    flow_id: Optional[str] = None,
    method: Optional[str] = None,
) -> dict:
    pending = _get_pending(flow_id=flow_id, user_id=user_id, ig_username=ig_username)
    if not pending:
        return {
            "status":  "error",
            "message": f"No pending login for @{ig_username} — please start over",
        }

    cl        = pending["client"]
    last_json = pending.get("last_json") or cl.last_json or {}
    pending_flow_id = pending.get("flow_id")

    clean_code = code.strip().replace(" ", "").replace("-", "")
    logger.info(
        f"2FA submit @{ig_username} | code={clean_code} | len={len(clean_code)}"
    )

    tfi                  = last_json.get("two_factor_info", {})
    two_factor_identifier = tfi.get("two_factor_identifier", "")
    device_id            = tfi.get("device_id", "")

    # Pick verification method from explicit user choice.
    # API values: SMS=1, TOTP=3, WhatsApp=4
    method_map = {
        "sms": "1",
        "totp": "3",
        "whatsapp": "4",
    }
    requested_method = (method or "").strip().lower()

    if requested_method:
        verification_method = method_map.get(requested_method, "1")
    elif tfi.get("totp_two_factor_on"):
        verification_method = "3"
    elif tfi.get("whatsapp_two_factor_on") and not tfi.get("sms_two_factor_on"):
        verification_method = "4"
    else:
        verification_method = "1"

    logger.info(
        f"2FA method={verification_method} | "
        f"identifier={two_factor_identifier[:20] if two_factor_identifier else 'MISSING'}"
    )

    # ── Attempt 1: private_request with saved identifier ─────────────────────
    try:
        data = {
            "verification_code":     clean_code,
            "two_factor_identifier": two_factor_identifier,
            "username":              ig_username,
            "verification_method":   verification_method,
            "device_id":             device_id,
            "trust_signal":          False,
        }
        result = cl.private_request(
            "accounts/two_factor_login/",
            data,
            login=True,
        )
        logger.info(f"2FA attempt 1 success for @{ig_username}: {result}")

        # ── Give instagrapi a moment to set user state ────────────────────────
        import time
        time.sleep(1)

        # Try to set user_id from result if instagrapi didn't set it
        if not cl.user_id and result:
            logged_in = result.get("logged_in_user", {})
            if logged_in.get("pk"):
                try:
                    cl.user_id = int(logged_in["pk"])
                    logger.info(f"Manually set cl.user_id={cl.user_id}")
                except Exception:
                    pass

        saved = _save_session(cl, ig_username, db, user_id)
        if pending_flow_id:
            _pending_clients.pop(pending_flow_id, None)
        return saved    

    except Exception as e1:
        logger.error(f"2FA verification failed for @{ig_username}: {e1}")
        return {
            "status":  "error",
            "message": (
                "Code rejected by Instagram.\n"
                "Important: each code should be verified only once.\n"
                "If you received the code on WhatsApp, choose WhatsApp in the app before submitting.\n"
                "Tips:\n"
                "• Enter the code immediately after receiving it\n"
                "• Make sure no spaces or dashes\n"
                f"• Code should be sent to {tfi.get('obfuscated_phone_number_2', 'your phone')}"
            ),
        }


# ── Submit challenge code (SMS/email from challenge) ──────────────────────────

def submit_challenge_code(
    ig_username: str,
    code: str,
    db: Session,
    user_id: int,
    flow_id: Optional[str] = None,
) -> dict:
    pending = _get_pending(flow_id=flow_id, user_id=user_id, ig_username=ig_username)
    if not pending:
        return {
            "status":  "error",
            "message": f"No pending login for @{ig_username} — please start over",
        }

    cl      = pending["client"]
    pending_flow_id = pending.get("flow_id")

    try:
        cl.challenge_send_security_code(code.strip())
        saved = _save_session(cl, ig_username, db, user_id)
        if pending_flow_id:
            _pending_clients.pop(pending_flow_id, None)
        return saved
    except Exception as e:
        logger.error(f"Challenge code error for @{ig_username}: {e}")
        return {"status": "error", "message": f"Code failed: {str(e)}"}


# ── Retry after app approval ──────────────────────────────────────────────────

def retry_after_challenge(
    ig_username: str,
    db: Session,
    user_id: int,
    flow_id: Optional[str] = None,
) -> dict:
    pending = _get_pending(flow_id=flow_id, user_id=user_id, ig_username=ig_username)
    if not pending:
        return {
            "status":  "error",
            "message": f"No pending login for @{ig_username} — please start over",
        }

    cl       = pending["client"]
    password = pending["password"]
    pending_flow_id = pending.get("flow_id")

    # Test if approval worked
    try:
        cl.get_timeline_feed()
        saved = _save_session(cl, ig_username, db, user_id)
        if pending_flow_id:
            _pending_clients.pop(pending_flow_id, None)
        return saved
    except Exception:
        pass

    # Try fresh login
    try:
        cl2 = Client()
        cl2.delay_range = [2, 5]
        cl2.login(ig_username, password)
        saved = _save_session(cl2, ig_username, db, user_id)
        if pending_flow_id:
            _pending_clients.pop(pending_flow_id, None)
        return saved
    except Exception as e:
        logger.error(f"Retry challenge failed for @{ig_username}: {e}")
        return {
            "status":  "error",
            "message": "Still blocked — approve in the Instagram app then try again",
        }


# ── Save session to DB ────────────────────────────────────────────────────────

def _save_session(
    cl: Client,
    ig_username: str,
    db: Session,
    user_id: int,
) -> dict:
    """Save Instagram session to DB after successful login."""

    # ── Get account info safely ───────────────────────────────────────────────
    ig_user_id         = None
    ig_full_name       = None
    ig_profile_pic_url = None

    try:
        user_info = cl.account_info()
        if user_info:
            ig_user_id         = str(user_info.pk)        if user_info.pk             else None
            ig_full_name       = user_info.full_name       if user_info.full_name       else None
            ig_profile_pic_url = str(user_info.profile_pic_url) if user_info.profile_pic_url else None
    except Exception as e:
        logger.warning(f"Could not get account_info for @{ig_username}: {e}")

    # Fallback — try getting user id from last_json or authenticated_user_id
    if not ig_user_id:
        try:
            ig_user_id = str(cl.user_id) if cl.user_id else None
        except Exception:
            pass

    if not ig_user_id:
        try:
            ig_user_id = str(cl.authenticated_user_id) if cl.authenticated_user_id else None
        except Exception:
            pass

    logger.info(
        f"Saving session for @{ig_username} | "
        f"user_id={ig_user_id} | full_name={ig_full_name}"
    )

    # ── Save session settings ─────────────────────────────────────────────────
    try:
        session_data = json.dumps(cl.get_settings())
    except Exception as e:
        logger.error(f"Could not get session settings: {e}")
        return {
            "status":  "error",
            "message": f"Failed to save session: {str(e)}",
        }

    # ── Upsert account in DB ──────────────────────────────────────────────────
    try:
        account = (
            db.query(InstagramAccount)
            .filter(
                InstagramAccount.ig_username == ig_username,
                InstagramAccount.user_id     == user_id,
            )
            .first()
        )

        if account:
            # Update existing
            account.session_data = session_data
            account.last_login   = datetime.utcnow()
            account.is_active    = True
            if ig_user_id:
                account.ig_user_id = ig_user_id
            if ig_full_name:
                account.ig_full_name = ig_full_name
            if ig_profile_pic_url:
                account.ig_profile_pic_url = ig_profile_pic_url
        else:
            # Create new
            account = InstagramAccount(
                user_id            = user_id,
                ig_username        = ig_username,
                ig_user_id         = ig_user_id,
                ig_full_name       = ig_full_name,
                ig_profile_pic_url = ig_profile_pic_url,
                session_data       = session_data,
                last_login         = datetime.utcnow(),
                is_active          = True,
            )
            db.add(account)

        db.commit()
        db.refresh(account)
        _clients[account.id] = cl

        logger.info(f"✅ Session saved for @{ig_username} (account.id={account.id})")

        return {
            "status":       "success",
            "account_id":   account.id,
            "ig_username":  account.ig_username,
            "ig_full_name": account.ig_full_name or ig_username,
        }

    except Exception as e:
        logger.error(f"DB error saving session for @{ig_username}: {e}")
        db.rollback()
        return {
            "status":  "error",
            "message": f"Database error: {str(e)}",
        }


# ── Logout ────────────────────────────────────────────────────────────────────

def logout_instagram(account_id: int):
    if account_id in _clients:
        try:
            _clients[account_id].logout()
        except Exception:
            pass
        del _clients[account_id]


# ── Publish post ──────────────────────────────────────────────────────────────

def publish_post(account: InstagramAccount, post) -> dict:
    try:
        cl          = _get_client(account)
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
        return {
            "status":  "error",
            "message": "Session expired — please re-login in Settings",
        }
    except Exception as e:
        logger.error(f"Publish error for post {post.id}: {e}")
        return {"status": "error", "message": str(e)}