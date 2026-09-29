from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.finmentor import ChatRequest, MentorMessageOut
from app.services.audit import log_action
from app.services.mentor import HISTORY_TURNS, build_context, reply_stream, run_affordability
from app.services.snapshot import snapshot

router = APIRouter(prefix="/mentor", tags=["mentor"])


def _require_ai_consent(client: Client, user_id: str) -> None:
    resp = client.table("consent_records").select("granted").eq("user_id", user_id) \
        .eq("consent_key", "ai_recommendations").execute()
    if not (resp.data and resp.data[0]["granted"]):
        raise HTTPException(
            status_code=403,
            detail="The mentor needs your permission to use your data for recommendations. "
                   "Turn on 'Use my data for recommendations' in your privacy settings.",
        )


@router.post("/chat")
async def chat(payload: ChatRequest,
               user: CurrentUser = Depends(get_current_user),
               client: Client = Depends(get_scoped_client)):
    """
    Streams a plain-text reply grounded in the user's own numbers.
    Only the computed fact sheet (never raw rows or IDs) is sent to the
    configured LLM provider, and only with the user's AI consent.
    """
    await run_in_threadpool(_require_ai_consent, client, user.id)

    def prepare():
        snap = snapshot(client, user.id, for_ai=True)
        afford = run_affordability(snap.profile, payload.message)
        history = client.table("mentor_messages").select("role,content").eq("user_id", user.id) \
            .order("created_at", desc=True).limit(HISTORY_TURNS).execute().data or []
        client.table("mentor_messages").insert(
            {"user_id": user.id, "role": "user", "content": payload.message}).execute()
        return snap, afford, list(reversed(history))

    snap, afford, history = await run_in_threadpool(prepare)
    context = build_context(snap.profile, snap.health, snap.forecast, snap.plan, afford)

    async def body():
        parts: list[str] = []
        async for chunk in reply_stream(context, history, payload.message, snap.health, snap.plan, afford):
            parts.append(chunk)
            yield chunk
        await run_in_threadpool(lambda: client.table("mentor_messages").insert(
            {"user_id": user.id, "role": "assistant", "content": "".join(parts)}).execute())
        await run_in_threadpool(log_action, user.id, "mentor_chat", "mentor_message", None,
                                {"affordability_checked": afford is not None})

    return StreamingResponse(body(), media_type="text/plain; charset=utf-8",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/history", response_model=list[MentorMessageOut])
def history(user: CurrentUser = Depends(get_current_user),
            client: Client = Depends(get_scoped_client)):
    return client.table("mentor_messages").select("*").eq("user_id", user.id) \
        .order("created_at").limit(100).execute().data or []


@router.delete("/history", status_code=204)
def clear_history(user: CurrentUser = Depends(get_current_user),
                  client: Client = Depends(get_scoped_client)):
    client.table("mentor_messages").delete().eq("user_id", user.id).execute()
    log_action(user.id, "mentor_history_cleared", "mentor_message", None)
