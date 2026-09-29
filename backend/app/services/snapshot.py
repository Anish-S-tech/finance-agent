"""
One call that runs the whole analysis pipeline for a user, plus the
persistence side of the action planner.
"""
from dataclasses import dataclass
from datetime import datetime, timezone

from supabase import Client

from app.schemas.finmentor import FinancialProfile, Forecast, HealthReport, PlannedAction
from app.services.action_planner import build_plan
from app.services.forecast import DEFAULT_MONTHS, forecast
from app.services.health_engine import health_report
from app.services.profile_builder import load_profile

OPEN_STATUSES = ("todo", "doing")


@dataclass
class Snapshot:
    profile: FinancialProfile
    forecast: Forecast
    health: HealthReport
    plan: list[PlannedAction]


def snapshot(client: Client, user_id: str, for_ai: bool = False, months: int = DEFAULT_MONTHS) -> Snapshot:
    profile = load_profile(client, user_id, for_ai=for_ai)
    fc = forecast(profile, months)
    report = health_report(profile, fc)
    return Snapshot(profile=profile, forecast=fc, health=report, plan=build_plan(profile, report, fc))


def sync_actions(client: Client, user_id: str, plan: list[PlannedAction]) -> list[dict]:
    """
    Upserts the freshly generated plan. Status is never sent, so a step
    the user marked done/dismissed keeps that status. Open steps that no
    longer apply are removed; completed ones stay as history.
    """
    now = datetime.now(timezone.utc).isoformat()
    if plan:
        client.table("action_items").upsert(
            [{**a.model_dump(), "user_id": user_id, "updated_at": now} for a in plan],
            on_conflict="user_id,action_key",
        ).execute()

    keys = {a.action_key for a in plan}
    existing = client.table("action_items").select("*").eq("user_id", user_id).execute().data or []
    stale = [r["id"] for r in existing if r["action_key"] not in keys and r["status"] in OPEN_STATUSES]
    if stale:
        client.table("action_items").delete().in_("id", stale).execute()

    rows = [r for r in existing if r["id"] not in stale]
    return sorted(rows, key=lambda r: (r["status"] not in OPEN_STATUSES, r["priority"],
                                       -(r.get("impact_amount") or 0)))
