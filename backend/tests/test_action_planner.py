from app.services.action_planner import build_plan
from app.services.forecast import forecast
from app.services.health_engine import health_report


def plan_for(profile):
    fc = forecast(profile)
    return build_plan(profile, health_report(profile, fc), fc)


def test_persona_plan(persona):
    plan = plan_for(persona)
    keys = [a.action_key for a in plan]
    assert "save_emergency_3m" in keys
    assert "debt_prepay_credit_card" in keys
    assert "spend_trim_wants" in keys
    assert "goal_home_down_payment" in keys
    assert "protect_health_cover" in keys
    assert [a.priority for a in plan] == sorted(a.priority for a in plan)


def test_actions_carry_concrete_amounts(persona):
    trim = next(a for a in plan_for(persona) if a.action_key == "spend_trim_wants")
    assert trim.impact_amount == 2000
    assert "Shopping ₹9,000 → ₹7,000" in trim.detail


def test_keys_are_stable_across_runs(persona):
    assert [a.action_key for a in plan_for(persona)] == [a.action_key for a in plan_for(persona)]


def test_deficit_plan_leads_with_spending(stressed):
    plan = plan_for(stressed)
    assert plan[0].priority == 1
    assert {"spend_trim_wants", "debt_no_new_emis"} <= {a.action_key for a in plan}


def test_healthy_plan_suggests_investing(healthy):
    keys = {a.action_key for a in plan_for(healthy)}
    assert "grow_invest_surplus" in keys
    assert "save_emergency_3m" not in keys


def test_empty_profile_asks_for_data(persona):
    empty = persona.model_copy(update={"income": [], "expenses": []})
    keys = [a.action_key for a in plan_for(empty)]
    assert keys == ["profile_add_income", "profile_add_expenses"]
