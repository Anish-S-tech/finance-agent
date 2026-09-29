"""
End-to-end HTTP tests for the FinMentor routes, with auth and Supabase
replaced by in-memory fakes.
"""
import pytest
from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user, get_scoped_client
from app.main import app
from app.services import mentor
from app.services.llm.client import LLMUnavailable
from tests.fake_supabase import FakeSupabase

USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(USER_ID, "demo@example.com", "token")
    app.dependency_overrides[get_scoped_client] = lambda: fake
    # Audit logs go through the service-role client; send them to the fake too.
    monkeypatch.setattr("app.services.audit.get_service_client", lambda: fake)
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture
def api(db):
    return TestClient(app)


def grant_ai(db, granted=True):
    db.table("consent_records").upsert({"user_id": USER_ID, "consent_key": "ai_recommendations",
                                        "granted": granted}, on_conflict="user_id,consent_key").execute()


def test_overview_after_loading_sample(api):
    assert api.post("/finances/load-sample").status_code == 200
    body = api.get("/analysis/overview").json()
    assert body["has_data"] is True
    assert body["health"]["band"] == "Fair"
    assert len(body["forecast"]["points"]) == 6
    assert len(body["top_actions"]) == 3
    assert body["upcoming"][0]["label"] == "Laptop repair"


def test_empty_user_gets_data_prompts(api):
    body = api.get("/analysis/overview").json()
    assert body["has_data"] is False
    assert body["top_actions"][0]["action_key"] == "profile_add_income"


def test_action_status_survives_regeneration(api):
    api.post("/finances/load-sample")
    actions = api.get("/actions").json()
    target = next(a for a in actions if a["action_key"] == "debt_prepay_credit_card")
    assert api.patch(f"/actions/{target['id']}", json={"status": "done"}).json()["status"] == "done"
    again = api.get("/actions").json()
    assert next(a for a in again if a["action_key"] == "debt_prepay_credit_card")["status"] == "done"
    assert api.patch(f"/actions/{target['id']}", json={"status": "bogus"}).status_code == 422


def test_crud_and_savings(api):
    created = api.post("/finances/expenses", json={"label": "Netflix", "category": "entertainment",
                                                   "amount": 649, "is_essential": False}).json()
    assert api.get("/finances/expenses").json()[0]["label"] == "Netflix"
    updated = api.put(f"/finances/expenses/{created['id']}",
                      json={"label": "Netflix", "category": "entertainment", "amount": 199,
                            "is_essential": False}).json()
    assert updated["amount"] == 199
    assert api.delete(f"/finances/expenses/{created['id']}").status_code == 204
    assert api.get("/finances/expenses").json() == []

    goal = api.post("/finances/goals", json={"label": "Bike", "target_amount": 90000,
                                             "target_date": "2027-06-01"}).json()
    assert goal["target_date"] == "2027-06-01"

    saved = api.put("/finances/savings", json={"current_savings": 50000, "emergency_fund": 20000}).json()
    assert saved["current_savings"] == 50000 and saved["emergency_fund"] == 20000


def test_affordability_and_simulation(api):
    api.post("/finances/load-sample")
    r = api.post("/simulate/afford", json={"item": "phone", "cost": 60000}).json()
    assert r["verdict"] == "no"
    assert r["simulation"]["scenario_forecast"]["points"]

    sim = api.post("/simulate", json={"months": 12, "changes": [
        {"type": "income_change", "percent": -20},
        {"type": "expense_change", "category": "shopping", "percent": -50},
    ]}).json()
    assert len(sim["scenario_forecast"]["points"]) == 12
    assert sim["delta"]["score"] < 0

    saved = api.post("/simulate/saved", json={"name": "Pay cut", "scenario": {"changes": [
        {"type": "income_change", "percent": -20}]}}).json()
    assert saved["result_summary"]["score"] < 0
    assert len(api.get("/simulate/saved").json()) == 1

    bad = api.post("/simulate", json={"changes": [{"type": "teleport"}]})
    assert bad.status_code == 422


def test_mentor_requires_consent(api, db):
    api.post("/finances/load-sample")
    assert api.post("/mentor/chat", json={"message": "hi"}).status_code == 403
    grant_ai(db, granted=False)
    assert api.post("/mentor/chat", json={"message": "hi"}).status_code == 403


def test_mentor_streams_grounded_reply_and_saves_history(api, db, monkeypatch):
    api.post("/finances/load-sample")
    grant_ai(db)
    seen = {}

    async def fake_llm(messages, **_kw):
        seen["system"] = messages[0]["content"]
        for word in ["Not ", "right ", "now."]:
            yield word

    monkeypatch.setattr(mentor, "stream_chat", fake_llm)
    r = api.post("/mentor/chat", json={"message": "Why is my score what it is?"})
    assert r.status_code == 200
    assert r.text == "Not right now."
    assert "₹95,000" in seen["system"] and "WEAKEST AREAS" in seen["system"]

    # Affordability questions are answered by the engine, not the model.
    seen.clear()
    r = api.post("/mentor/chat", json={"message": "Can I afford a ₹60,000 phone?"})
    assert r.text.startswith("**No — this phone")
    assert "system" not in seen

    history = api.get("/mentor/history").json()
    assert [h["role"] for h in history] == ["user", "assistant", "user", "assistant"]
    assert api.delete("/mentor/history").status_code == 204
    assert api.get("/mentor/history").json() == []


def test_mentor_offline_fallback(api, db, monkeypatch):
    api.post("/finances/load-sample")
    grant_ai(db)

    async def offline(*_a, **_kw):
        raise LLMUnavailable("No Gemini API key set")
        yield

    monkeypatch.setattr(mentor, "stream_chat", offline)
    text = api.post("/mentor/chat", json={"message": "How am I doing?"}).text
    assert "health score" in text and "AI explanations unavailable" in text


def test_ai_hidden_savings_are_not_sent_to_mentor(api, db, monkeypatch):
    api.post("/finances/load-sample")
    grant_ai(db)
    for row in db.tables["financial_items"]:
        if row["item_key"] == "investments":
            row["ai_allowed"] = False
    seen = {}

    async def fake_llm(messages, **_kw):
        seen["system"] = messages[0]["content"]
        yield "ok"

    monkeypatch.setattr(mentor, "stream_chat", fake_llm)
    api.post("/mentor/chat", json={"message": "hello"})
    assert "₹1,20,000" not in seen["system"]
    assert "chose not to share with AI: investments" in seen["system"]


def test_completeness_counts_structured_tables(api):
    api.post("/finances/load-sample")
    body = api.get("/financial-context/completeness", params={"query_context": "take_loan"}).json()
    assert body["missing_categories"] == []


def test_privacy_export_and_delete_cover_new_tables(api, db):
    api.post("/finances/load-sample")
    export = api.get("/privacy/export").json()
    assert len(export["goals"]) == 2 and len(export["debts"]) == 2
    api.delete("/privacy")
    assert not db.tables["goals"] and not db.tables["expenses"]
