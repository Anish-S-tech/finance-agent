from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.finmentor import ActionItemOut, ActionStatusUpdate
from app.services.audit import log_action
from app.services.snapshot import snapshot, sync_actions

router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("", response_model=list[ActionItemOut])
def list_actions(user: CurrentUser = Depends(get_current_user),
                 client: Client = Depends(get_scoped_client)):
    """Always regenerated from the latest profile; saved statuses are kept."""
    return sync_actions(client, user.id, snapshot(client, user.id).plan)


@router.patch("/{action_id}", response_model=ActionItemOut)
def update_action(action_id: str, payload: ActionStatusUpdate,
                  user: CurrentUser = Depends(get_current_user),
                  client: Client = Depends(get_scoped_client)):
    resp = client.table("action_items").update({
        "status": payload.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", action_id).eq("user_id", user.id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Action not found")
    log_action(user.id, "action_status_changed", "action_item", action_id, {"status": payload.status})
    return resp.data[0]
