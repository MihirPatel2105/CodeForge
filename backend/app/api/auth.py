"""Auth routes. CodeForge issues its own JWTs and verifies them itself."""

from fastapi import APIRouter, status

from app.core.deps import CurrentUser
from app.core.exceptions import AuthError, ConflictError
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.api import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> TokenResponse:
    if await User.find_one(User.email == payload.email) is not None:
        raise ConflictError("An account with that email already exists")

    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    await user.insert()
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    user = await User.find_one(User.email == payload.email)
    # Same message whether the email is unknown or the password is wrong, so the endpoint
    # cannot be used to enumerate registered addresses.
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise AuthError("Incorrect email or password")

    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser) -> UserResponse:
    return UserResponse(id=str(user.id), email=user.email, created_at=user.created_at)
