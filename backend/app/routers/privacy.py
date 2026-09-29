from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.misc import ConsentUpdate, ConsentOut, PrivacyExportOut
from app.services.audit import log_action

router = APIRouter(prefix="/privacy", tags=["privacy"])

FINMENTOR_TABLES = ["income_sources", "expenses", "debts", "goals",
                    "action_items", "mentor_messages", "simulations"]


@router.get("", response_model=list[ConsentOut])
def get_consents(user: CurrentUser = Depends(get_current_user),
                  client: Client = Depends(get_scoped_client)):
    resp = client.table("consent_records").select("*").eq("user_id", user.id).execute()
    return resp.data or []


@router.put("", response_model=ConsentOut)
def update_consent(payload: ConsentUpdate,
                    user: CurrentUser = Depends(get_current_user),
                    client: Client = Depends(get_scoped_client)):
    now = datetime.now(timezone.utc).isoformat()
    data = {
        "user_id": user.id,
        "consent_key": payload.consent_key,
        "granted": payload.granted,
        "granted_at": now if payload.granted else None,
        "revoked_at": None if payload.granted else now,
    }
    resp = client.table("consent_records").upsert(data, on_conflict="user_id,consent_key").execute()
    log_action(user.id, "consent_granted" if payload.granted else "consent_revoked",
               "consent_record", None, {"consent_key": payload.consent_key})
    return resp.data[0]


@router.get("/export", response_model=PrivacyExportOut)
def export_my_data(user: CurrentUser = Depends(get_current_user),
                    client: Client = Depends(get_scoped_client)):
    """Module 10 — user can download everything stored about them."""
    profile = client.table("user_profile").select("*").eq("id", user.id).single().execute()
    items = client.table("financial_items").select("*").eq("user_id", user.id).execute()
    consents = client.table("consent_records").select("*").eq("user_id", user.id).execute()
    docs = client.table("uploaded_documents").select("*").eq("user_id", user.id).execute()
    events = client.table("financial_calendar").select("*").eq("user_id", user.id).execute()
    finmentor = {t: client.table(t).select("*").eq("user_id", user.id).execute().data or []
                 for t in FINMENTOR_TABLES}

    log_action(user.id, "data_exported", "profile", user.id)

    return PrivacyExportOut(
        profile=profile.data or {},
        financial_items=items.data or [],
        consents=consents.data or [],
        documents=docs.data or [],
        calendar=events.data or [],
        **finmentor,
        exported_at=datetime.now(timezone.utc),
    )


@router.delete("")
def delete_my_data(user: CurrentUser = Depends(get_current_user),
                    client: Client = Depends(get_scoped_client)):
    """
    Module 10 — full account data deletion.
    Deletes application tables; auth.users deletion (which cascades
    everything via FK) should be triggered via Supabase Admin API
    from a confirmed, separate step in the frontend — not silently here.
    """
    for table in ["financial_items", "consent_records", "financial_calendar",
                  "uploaded_documents", "profile_completeness", *FINMENTOR_TABLES]:
        client.table(table).delete().eq("user_id", user.id).execute()
    client.table("user_profile").delete().eq("id", user.id).execute()

    log_action(user.id, "data_deleted", "profile", user.id)
    return {"status": "deleted"}
