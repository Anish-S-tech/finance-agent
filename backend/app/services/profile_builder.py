"""
Profile Builder.

Assembles one FinancialProfile from everything the user has on file,
so the engines never touch the database. Also owns the sample persona
used for demo mode and tests.
"""
import json
from datetime import date, timedelta
from pathlib import Path

from supabase import Client

from app.schemas.finmentor import (
    Debt, Expense, FinancialProfile, Goal, IncomeSource, Savings, UpcomingPayment,
)
from app.services.finance_math import add_months

SAMPLE_PATH = Path(__file__).resolve().parent.parent / "data" / "sample_profile.json"
SAVINGS_KEYS = {
    "current_savings": "savings",
    "emergency_fund": "savings",
    "investments": "savings",
    "health_insurance_cover": "insurance",
}


def load_profile(client: Client, user_id: str, as_of: date | None = None,
                 for_ai: bool = False) -> FinancialProfile:
    """
    for_ai=True drops any savings fact the user marked ai_allowed=false and
    records it in `hidden_from_ai`, so the mentor can say it doesn't know.
    """
    as_of = as_of or date.today()

    def rows(table: str) -> list[dict]:
        return client.table(table).select("*").eq("user_id", user_id).execute().data or []

    prof_resp = client.table("user_profile").select("*").eq("id", user_id).maybe_single().execute()
    prof = (prof_resp.data if prof_resp else None) or {}

    income = [IncomeSource(**_pick(r, IncomeSource)) for r in rows("income_sources")]
    if not income and prof.get("monthly_income"):
        # Onboarding only captures a single monthly income; use it until
        # the user adds structured income sources.
        income = [IncomeSource(label="Salary", amount=float(prof["monthly_income"]),
                               pay_day=prof.get("salary_day"), is_primary=True)]

    savings, hidden = Savings(), []
    items = client.table("financial_items").select("*").eq("user_id", user_id) \
        .in_("item_key", list(SAVINGS_KEYS)).execute().data or []
    for it in items:
        if for_ai and not it.get("ai_allowed", True):
            hidden.append(it["item_key"])
            continue
        if it.get("value_numeric") is not None:
            setattr(savings, it["item_key"], float(it["value_numeric"]))

    upcoming = [
        UpcomingPayment(id=r["id"], label=r["label"], event_type=r["event_type"],
                        amount=float(r.get("amount") or 0), due_date=r["due_date"],
                        is_recurring=r.get("is_recurring", False))
        for r in client.table("financial_calendar").select("*").eq("user_id", user_id)
        .eq("status", "upcoming").gte("due_date", as_of.isoformat()).order("due_date").execute().data or []
    ]

    return FinancialProfile(
        as_of=as_of,
        name=prof.get("name"),
        age=prof.get("age"),
        occupation=prof.get("occupation"),
        num_dependents=prof.get("num_dependents") or 0,
        salary_day=prof.get("salary_day"),
        income=income,
        expenses=[Expense(**_pick(r, Expense)) for r in rows("expenses")],
        debts=[Debt(**_pick(r, Debt)) for r in rows("debts")],
        goals=[Goal(**_pick(r, Goal)) for r in rows("goals")],
        savings=savings,
        upcoming=upcoming,
        hidden_from_ai=hidden,
    )


def _pick(row: dict, model) -> dict:
    """Keep only the fields the model knows about, dropping nulls so defaults apply."""
    return {k: v for k, v in row.items() if k in model.model_fields and v is not None}


# ---------- Sample persona ----------

def _read_sample() -> dict:
    return json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))


def sample_rows(as_of: date | None = None) -> dict:
    """Sample data shaped as table rows (relative dates resolved against as_of)."""
    as_of = as_of or date.today()
    data = _read_sample()
    goals = []
    for g in data["goals"]:
        g = dict(g)
        g["target_date"] = add_months(as_of, g.pop("target_in_months")).isoformat()
        goals.append(g)
    calendar = []
    for c in data["calendar"]:
        c = dict(c)
        c["due_date"] = (as_of + timedelta(days=c.pop("due_in_days"))).isoformat()
        calendar.append(c)
    return {**data, "goals": goals, "calendar": calendar}


def sample_profile(as_of: date | None = None) -> FinancialProfile:
    """The sample persona as a FinancialProfile — used by tests and offline demos."""
    as_of = as_of or date.today()
    d = sample_rows(as_of)
    return FinancialProfile(
        as_of=as_of,
        **d["profile"],
        income=[IncomeSource(**r) for r in d["income"]],
        expenses=[Expense(**r) for r in d["expenses"]],
        debts=[Debt(**r) for r in d["debts"]],
        goals=[Goal(**r) for r in d["goals"]],
        savings=Savings(**d["savings"]),
        upcoming=[UpcomingPayment(**r) for r in d["calendar"]],
    )
