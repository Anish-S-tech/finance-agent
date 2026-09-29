from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.finmentor import (
    Debt, DebtIn, Expense, ExpenseIn, Goal, GoalIn, IncomeSource, IncomeSourceIn, Savings, SavingsIn,
)
from app.services.audit import log_action
from app.services.profile_builder import SAVINGS_KEYS, sample_rows

router = APIRouter(prefix="/finances", tags=["finances"])


def _register_crud(path: str, table: str, model_in: type[BaseModel], model_out: type[BaseModel]) -> None:
    """GET list / POST / PUT / DELETE for one structured-profile table."""

    @router.get(f"/{path}", response_model=list[model_out], name=f"list_{path}")
    def list_rows(user: CurrentUser = Depends(get_current_user),
                  client: Client = Depends(get_scoped_client)):
        return client.table(table).select("*").eq("user_id", user.id).order("created_at").execute().data or []

    @router.post(f"/{path}", response_model=model_out, name=f"create_{path}")
    def create_row(payload: model_in,  # type: ignore[valid-type]
                   user: CurrentUser = Depends(get_current_user),
                   client: Client = Depends(get_scoped_client)):
        data = {**payload.model_dump(mode="json"), "user_id": user.id}
        resp = client.table(table).insert(data).execute()
        log_action(user.id, f"{table}_created", table, resp.data[0]["id"])
        return resp.data[0]

    @router.put(f"/{path}/{{row_id}}", response_model=model_out, name=f"update_{path}")
    def update_row(row_id: str, payload: model_in,  # type: ignore[valid-type]
                   user: CurrentUser = Depends(get_current_user),
                   client: Client = Depends(get_scoped_client)):
        resp = client.table(table).update(payload.model_dump(mode="json")) \
            .eq("id", row_id).eq("user_id", user.id).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Not found")
        log_action(user.id, f"{table}_updated", table, row_id)
        return resp.data[0]

    @router.delete(f"/{path}/{{row_id}}", status_code=204, name=f"delete_{path}")
    def delete_row(row_id: str,
                   user: CurrentUser = Depends(get_current_user),
                   client: Client = Depends(get_scoped_client)):
        client.table(table).delete().eq("id", row_id).eq("user_id", user.id).execute()
        log_action(user.id, f"{table}_deleted", table, row_id)


_register_crud("income", "income_sources", IncomeSourceIn, IncomeSource)
_register_crud("expenses", "expenses", ExpenseIn, Expense)
_register_crud("debts", "debts", DebtIn, Debt)
_register_crud("goals", "goals", GoalIn, Goal)


# ---------- Savings (stored as financial_items facts) ----------

@router.get("/savings", response_model=Savings)
def get_savings(user: CurrentUser = Depends(get_current_user),
                client: Client = Depends(get_scoped_client)):
    items = client.table("financial_items").select("item_key,value_numeric").eq("user_id", user.id) \
        .in_("item_key", list(SAVINGS_KEYS)).execute().data or []
    return Savings(**{i["item_key"]: i["value_numeric"] for i in items if i["value_numeric"] is not None})


@router.put("/savings", response_model=Savings)
def update_savings(payload: SavingsIn,
                   user: CurrentUser = Depends(get_current_user),
                   client: Client = Depends(get_scoped_client)):
    _upsert_savings(client, user.id, payload.model_dump(exclude_none=True))
    log_action(user.id, "financial_item_updated", "financial_item", None,
               {"item_keys": list(payload.model_dump(exclude_none=True))})
    return get_savings(user, client)


def _upsert_savings(client: Client, user_id: str, values: dict[str, float]) -> None:
    rows = [{"user_id": user_id, "item_key": k, "item_category": SAVINGS_KEYS[k],
             "value_numeric": v, "source": "user", "confidence": 1.0}
            for k, v in values.items() if k in SAVINGS_KEYS]
    if rows:
        client.table("financial_items").upsert(rows, on_conflict="user_id,item_key").execute()


# ---------- Demo persona ----------

@router.post("/load-sample")
def load_sample(user: CurrentUser = Depends(get_current_user),
                client: Client = Depends(get_scoped_client)):
    """
    Replaces the user's structured profile with the fictional sample
    persona so every feature can be explored without entering real data.
    """
    data = sample_rows()

    for table in ["income_sources", "expenses", "debts", "goals", "action_items", "financial_calendar"]:
        client.table(table).delete().eq("user_id", user.id).execute()

    def insert(table: str, rows: list[dict]) -> None:
        if rows:
            client.table(table).insert([{**r, "user_id": user.id} for r in rows]).execute()

    insert("income_sources", data["income"])
    insert("expenses", data["expenses"])
    insert("debts", data["debts"])
    insert("goals", data["goals"])
    insert("financial_calendar", [{**c, "is_recurring": False, "status": "upcoming"} for c in data["calendar"]])

    profile = data["profile"]
    existing = client.table("user_profile").select("name").eq("id", user.id).maybe_single().execute()
    has_name = bool(existing and existing.data and existing.data.get("name"))
    primary = next(i for i in data["income"] if i.get("is_primary"))
    client.table("user_profile").upsert({
        "id": user.id,
        **({} if has_name else {"name": profile["name"], "age": profile["age"],
                                "occupation": profile["occupation"]}),
        "monthly_income": primary["amount"],
        "salary_day": profile["salary_day"],
        "num_dependents": profile["num_dependents"],
        "onboarding_completed": True,
    }).execute()

    _upsert_savings(client, user.id, data["savings"])
    client.table("financial_items").upsert([
        {"user_id": user.id, "item_key": "monthly_income", "item_category": "income",
         "value_numeric": primary["amount"], "source": "user", "confidence": 1.0},
        {"user_id": user.id, "item_key": "num_dependents", "item_category": "dependents",
         "value_numeric": profile["num_dependents"], "source": "user", "confidence": 1.0},
    ], on_conflict="user_id,item_key").execute()

    log_action(user.id, "sample_data_loaded", "profile", user.id)
    return {"status": "loaded"}
