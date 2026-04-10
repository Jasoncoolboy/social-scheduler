from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.instagram_account import InstagramAccount
from app.schemas.instagram_account import (
    InstagramLoginRequest,
    InstagramAccountResponse,
    VerificationCodeRequest,
)
from app.services.instagram_service import login_instagram, logout_instagram
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


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
def instagram_verify(
    data: VerificationCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit 2FA / challenge verification code."""
    result = login_instagram(
        ig_username=data.ig_username,
        ig_password="",  # not needed for verification
        db=db,
        user_id=current_user.id,
        verification_code=data.code,
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