"""
FastAPI dependencies for auth.

Supabase issues JWTs on login. The frontend sends them as
`Authorization: Bearer <token>`. We verify the token and hand routes
a Supabase client that's scoped to that user (so RLS applies), plus
the user's id for convenience.
"""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client

from app.core.config import get_settings
from app.core.supabase_client import get_user_client

settings = get_settings()
bearer_scheme = HTTPBearer()


class CurrentUser:
    def __init__(self, user_id: str, email: str | None, access_token: str):
        self.id = user_id
        self.email = email
        self.access_token = access_token


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    return CurrentUser(user_id=user_id, email=email, access_token=token)


def get_scoped_client(user: CurrentUser = Depends(get_current_user)) -> Client:
    """Returns a Supabase client scoped to the requesting user's identity."""
    return get_user_client(user.access_token)
