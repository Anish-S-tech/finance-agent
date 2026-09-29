from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.profile import (
    ProfileOut, ProfileUpdate, ProfileStepBasic, ProfileStepIncome, ProfileStepHousehold,
)
from app.services.audit import log_action

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
def get_profile(user: CurrentUser = Depends(get_current_user),
                 client: Client = Depends(get_scoped_client)):
    resp = client.table("user_profile").select("*").eq("id", user.id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Profile not found. Complete onboarding first.")
    return resp.data


@router.put("", response_model=ProfileOut)
def update_profile(payload: ProfileUpdate,
                    user: CurrentUser = Depends(get_current_user),
                    client: Client = Depends(get_scoped_client)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    resp = client.table("user_profile").update(updates).eq("id", user.id).execute()
    log_action(user.id, "profile_updated", "profile", user.id, updates)
    return resp.data[0]


# ---------- Progressive onboarding (Module 4) ----------

@router.post("/onboarding/basic", response_model=ProfileOut)
def onboarding_step_basic(payload: ProfileStepBasic,
                           user: CurrentUser = Depends(get_current_user),
                           client: Client = Depends(get_scoped_client)):
    data = {**payload.model_dump(), "id": user.id, "onboarding_step": 1}
    resp = client.table("user_profile").upsert(data).execute()
    return resp.data[0]


@router.post("/onboarding/income", response_model=ProfileOut)
def onboarding_step_income(payload: ProfileStepIncome,
                            user: CurrentUser = Depends(get_current_user),
                            client: Client = Depends(get_scoped_client)):
    data = {**payload.model_dump(), "id": user.id, "onboarding_step": 2}
    resp = client.table("user_profile").upsert(data).execute()

    # Also record this as a financial_item so it flows into the
    # Context Layer (Module 5) and Completeness Engine (Module 6).
    client.table("financial_items").upsert({
        "user_id": user.id,
        "item_key": "monthly_income",
        "item_category": "income",
        "value_numeric": payload.monthly_income,
        "source": "user",
        "confidence": 1.0,
    }, on_conflict="user_id,item_key").execute()

    return resp.data[0]


@router.post("/onboarding/household", response_model=ProfileOut)
def onboarding_step_household(payload: ProfileStepHousehold,
                               user: CurrentUser = Depends(get_current_user),
                               client: Client = Depends(get_scoped_client)):
    data = {**payload.model_dump(), "id": user.id, "onboarding_step": 3,
            "onboarding_completed": True}
    resp = client.table("user_profile").upsert(data).execute()

    if payload.num_dependents > 0:
        client.table("financial_items").upsert({
            "user_id": user.id,
            "item_key": "num_dependents",
            "item_category": "dependents",
            "value_numeric": payload.num_dependents,
            "source": "user",
            "confidence": 1.0,
        }, on_conflict="user_id,item_key").execute()

    log_action(user.id, "onboarding_completed", "profile", user.id)
    return resp.data[0]
