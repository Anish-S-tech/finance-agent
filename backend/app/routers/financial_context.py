from fastapi import APIRouter, Depends
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.financial_context import FinancialItemIn, FinancialItemOut, CompletenessCheck
from app.services.completeness_engine import check_completeness
from app.services.audit import log_action

router = APIRouter(prefix="/financial-context", tags=["financial-context"])


@router.get("", response_model=list[FinancialItemOut])
def list_financial_items(user: CurrentUser = Depends(get_current_user),
                          client: Client = Depends(get_scoped_client)):
    resp = client.table("financial_items").select("*").eq("user_id", user.id).execute()
    return resp.data or []


@router.post("", response_model=FinancialItemOut)
def upsert_financial_item(payload: FinancialItemIn,
                           user: CurrentUser = Depends(get_current_user),
                           client: Client = Depends(get_scoped_client)):
    data = {**payload.model_dump(), "user_id": user.id, "confidence": 1.0 if payload.source == "user" else 0.7}
    resp = client.table("financial_items").upsert(data, on_conflict="user_id,item_key").execute()
    log_action(user.id, "financial_item_updated", "financial_item", None,
               {"item_key": payload.item_key})
    return resp.data[0]


@router.get("/completeness", response_model=CompletenessCheck)
def get_completeness(query_context: str,
                      user: CurrentUser = Depends(get_current_user),
                      client: Client = Depends(get_scoped_client)):
    """
    Module 6 — Context Completeness Engine.
    e.g. GET /financial-context/completeness?query_context=afford_surgery
    """
    return check_completeness(client, user.id, query_context)
