"""
Supabase client factory.

Two flavors:
- get_service_client(): full access, server-side only. Used for audit
  log writes and any operation that legitimately needs to bypass RLS.
- get_user_client(access_token): scoped to the requesting user's JWT,
  so Postgres RLS policies apply automatically. Use this for almost
  everything — it's the safer default.
"""
from supabase import create_client, Client
from app.core.config import get_settings

settings = get_settings()


def get_service_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def get_user_client(access_token: str) -> Client:
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    # Attach the user's JWT so PostgREST requests carry their identity,
    # and RLS policies (auth.uid() = user_id) apply correctly.
    client.postgrest.auth(access_token)
    return client
