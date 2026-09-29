from fastapi import APIRouter, Depends
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.finmentor import (
    AffordabilityResult, AffordRequest, SavedSimulationIn, SavedSimulationOut, SimulateRequest,
    SimulationResult,
)
from app.services.affordability import can_afford
from app.services.profile_builder import load_profile
from app.services.simulator import simulate

router = APIRouter(prefix="/simulate", tags=["simulate"])


@router.post("", response_model=SimulationResult)
def run_simulation(payload: SimulateRequest,
                   user: CurrentUser = Depends(get_current_user),
                   client: Client = Depends(get_scoped_client)):
    return simulate(load_profile(client, user.id), payload.changes, payload.months)


@router.post("/afford", response_model=AffordabilityResult)
def afford(payload: AffordRequest,
           user: CurrentUser = Depends(get_current_user),
           client: Client = Depends(get_scoped_client)):
    return can_afford(load_profile(client, user.id), payload)


@router.get("/saved", response_model=list[SavedSimulationOut])
def list_saved(user: CurrentUser = Depends(get_current_user),
               client: Client = Depends(get_scoped_client)):
    return client.table("simulations").select("*").eq("user_id", user.id) \
        .order("created_at", desc=True).execute().data or []


@router.post("/saved", response_model=SavedSimulationOut)
def save_simulation(payload: SavedSimulationIn,
                    user: CurrentUser = Depends(get_current_user),
                    client: Client = Depends(get_scoped_client)):
    result = simulate(load_profile(client, user.id), payload.scenario.changes, payload.scenario.months)
    summary = {**result.delta.model_dump(), "scenario_score": result.scenario.score}
    resp = client.table("simulations").insert({
        "user_id": user.id,
        "name": payload.name,
        "scenario": payload.scenario.model_dump(mode="json"),
        "result_summary": summary,
    }).execute()
    return resp.data[0]


@router.delete("/saved/{sim_id}", status_code=204)
def delete_saved(sim_id: str,
                 user: CurrentUser = Depends(get_current_user),
                 client: Client = Depends(get_scoped_client)):
    client.table("simulations").delete().eq("id", sim_id).eq("user_id", user.id).execute()
