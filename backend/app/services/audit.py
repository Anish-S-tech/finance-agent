"""
Audit log writer. Uses the service-role client so writes always
succeed regardless of the acting user's RLS scope, and so a user
can't tamper with their own audit trail via the anon key.
"""
from app.core.supabase_client import get_service_client


def log_action(user_id: str, action: str, entity_type: str | None = None,
                entity_id: str | None = None, metadata: dict | None = None) -> None:
    client = get_service_client()
    client.table("audit_logs").insert({
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "metadata": metadata or {},
    }).execute()
