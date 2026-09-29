from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.misc import CalendarEventIn, CalendarEventOut

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("", response_model=list[CalendarEventOut])
def list_events(user: CurrentUser = Depends(get_current_user),
                 client: Client = Depends(get_scoped_client)):
    resp = (
        client.table("financial_calendar")
        .select("*")
        .eq("user_id", user.id)
        .gte("due_date", date.today().isoformat())
        .order("due_date")
        .execute()
    )
    return resp.data or []


@router.post("", response_model=CalendarEventOut)
def create_event(payload: CalendarEventIn,
                  user: CurrentUser = Depends(get_current_user),
                  client: Client = Depends(get_scoped_client)):
    data = {**payload.model_dump(mode="json"), "user_id": user.id}
    resp = client.table("financial_calendar").insert(data).execute()
    return resp.data[0]


@router.put("/{event_id}", response_model=CalendarEventOut)
def update_event(event_id: str, payload: CalendarEventIn,
                  user: CurrentUser = Depends(get_current_user),
                  client: Client = Depends(get_scoped_client)):
    resp = client.table("financial_calendar").update(payload.model_dump(mode="json")) \
        .eq("id", event_id).eq("user_id", user.id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return resp.data[0]


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: str,
                  user: CurrentUser = Depends(get_current_user),
                  client: Client = Depends(get_scoped_client)):
    client.table("financial_calendar").delete().eq("id", event_id).eq("user_id", user.id).execute()
