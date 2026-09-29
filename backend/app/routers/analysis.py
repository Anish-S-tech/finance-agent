from fastapi import APIRouter, Depends, Query
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.finmentor import Forecast, HealthReport, Overview
from app.services.forecast import forecast
from app.services.profile_builder import load_profile
from app.services.snapshot import OPEN_STATUSES, snapshot, sync_actions

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/health", response_model=HealthReport)
def get_health(user: CurrentUser = Depends(get_current_user),
               client: Client = Depends(get_scoped_client)):
    return snapshot(client, user.id).health


@router.get("/forecast", response_model=Forecast)
def get_forecast(months: int = Query(default=6, ge=1, le=36),
                 user: CurrentUser = Depends(get_current_user),
                 client: Client = Depends(get_scoped_client)):
    return forecast(load_profile(client, user.id), months)


@router.get("/overview", response_model=Overview)
def get_overview(user: CurrentUser = Depends(get_current_user),
                 client: Client = Depends(get_scoped_client)):
    """Everything the dashboard needs in one round-trip. Also refreshes the action plan."""
    snap = snapshot(client, user.id)
    actions = sync_actions(client, user.id, snap.plan)
    p = snap.profile
    return Overview(
        name=p.name,
        health=snap.health,
        forecast=snap.forecast,
        top_actions=[a for a in actions if a["status"] in OPEN_STATUSES][:3],
        upcoming=p.upcoming[:5],
        has_data=bool(p.income and (p.expenses or p.debts)),
    )
