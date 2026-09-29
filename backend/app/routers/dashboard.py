from datetime import date
from fastapi import APIRouter, Depends
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.misc import DashboardOut
from app.services.completeness_engine import calculate_overall_profile_completeness

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def get_dashboard(user: CurrentUser = Depends(get_current_user),
                   client: Client = Depends(get_scoped_client)):
    profile_resp = client.table("user_profile").select("monthly_income").eq("id", user.id).single().execute()
    monthly_income = (profile_resp.data or {}).get("monthly_income")

    savings_resp = (
        client.table("financial_items")
        .select("value_numeric")
        .eq("user_id", user.id)
        .eq("item_key", "current_savings")
        .maybe_single()
        .execute()
    )
    current_savings = (savings_resp.data or {}).get("value_numeric") if savings_resp.data else None

    upcoming_resp = (
        client.table("financial_calendar")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "upcoming")
        .gte("due_date", date.today().isoformat())
        .order("due_date")
        .execute()
    )
    upcoming_events = upcoming_resp.data or []
    upcoming_total = sum(e.get("amount") or 0 for e in upcoming_events)

    docs_resp = client.table("uploaded_documents").select("id", count="exact").eq("user_id", user.id).execute()
    docs_count = docs_resp.count or 0

    completeness = calculate_overall_profile_completeness(client, user.id)

    return DashboardOut(
        monthly_income=monthly_income,
        current_savings=current_savings,
        upcoming_bills_total=upcoming_total,
        upcoming_bills_count=len(upcoming_events),
        profile_completeness_percent=completeness["overall_percent"],
        documents_uploaded_count=docs_count,
        next_calendar_event=upcoming_events[0] if upcoming_events else None,
    )
