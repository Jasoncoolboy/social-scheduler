from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.instagram_account import InstagramAccount
from app.schemas.instagram_account import (
    InstagramLoginRequest,
    InstagramAccountResponse,
    VerificationCodeRequest,
)
from app.services.instagram_service import (
    login_instagram,
    logout_instagram,
    retry_after_challenge,
    submit_challenge_code,
    submit_two_factor_code,
)
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class RetryRequest(BaseModel):
    ig_username: str
    flow_id: Optional[str] = None


class ChallengeCodeRequest(BaseModel):
    ig_username: str
    code: str
    flow_id: Optional[str] = None


class TwoFactorRequest(BaseModel):
    ig_username: str
    code: str
    flow_id: Optional[str] = None
    method: Optional[str] = None


@router.post("/login")
def instagram_login(
    data: InstagramLoginRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = login_instagram(
        ig_username=data.ig_username,
        ig_password=data.ig_password,
        db=db,
        user_id=current_user.id,
    )
    if result["status"] == "error":
        raise HTTPException(400, result["message"])
    return result


@router.post("/verify")
def instagram_two_factor(
    data: TwoFactorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit 2FA code from authenticator app or SMS.
    Uses the pending client stored during login attempt.
    """
    result = submit_two_factor_code(
        ig_username=data.ig_username,
        code=data.code,
        db=db,
        user_id=current_user.id,
        flow_id=data.flow_id,
        method=data.method,
    )
    if result["status"] == "error":
        raise HTTPException(400, result["message"])
    return result


@router.post("/challenge-code")
def submit_challenge(
    data: ChallengeCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit code sent by Instagram via SMS or email."""
    result = submit_challenge_code(
        ig_username=data.ig_username,
        code=data.code,
        db=db,
        user_id=current_user.id,
        flow_id=data.flow_id,
    )
    if result["status"] == "error":
        raise HTTPException(400, result["message"])
    return result


@router.post("/retry-challenge")
def retry_challenge(
    data: RetryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Called after user approved login in Instagram app."""
    result = retry_after_challenge(
        ig_username=data.ig_username,
        db=db,
        user_id=current_user.id,
        flow_id=data.flow_id,
    )
    if result["status"] == "error":
        raise HTTPException(400, result["message"])
    return result


@router.get("/", response_model=List[InstagramAccountResponse])
def list_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(InstagramAccount)
        .filter(InstagramAccount.user_id == current_user.id)
        .all()
    )


@router.delete("/{account_id}")
def disconnect_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        db.query(InstagramAccount)
        .filter(
            InstagramAccount.id == account_id,
            InstagramAccount.user_id == current_user.id,
        )
        .first()
    )
    if not account:
        raise HTTPException(404, "Account not found")
    logout_instagram(account_id)
    db.delete(account)
    db.commit()
    return {"message": "Account disconnected"}