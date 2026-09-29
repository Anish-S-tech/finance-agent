from app.services.health_engine import band_for, health_report


def ids(report):
    return {r.id for r in report.risks}


def test_persona_metrics(persona):
    r = health_report(persona)
    m = r.metrics
    assert m.monthly_income == 95000
    assert m.monthly_expenses == 65700
    assert m.monthly_emi == 12900
    assert m.surplus == 16400
    assert m.emergency_months == 1.6
    assert m.credit_utilisation == 48.0
    assert r.band == "Fair"


def test_persona_risks(persona):
    found = ids(health_report(persona))
    assert "thin_emergency_fund" in found
    assert "high_interest_credit_card" in found
    assert "credit_utilisation" in found
    assert "forecast_low" in found
    assert "goal_off_track_home_down_payment" in found


def test_healthy_profile_scores_well(healthy):
    r = health_report(healthy)
    assert r.score >= 85
    assert r.band == "Excellent"
    assert not [x for x in r.risks if x.severity == "high"]


def test_stressed_profile_flags_deficit_and_debt(stressed):
    r = health_report(stressed)
    assert r.band in ("Critical", "Weak")
    found = ids(r)
    assert {"monthly_deficit", "debt_pressure", "forecast_shortfall", "thin_emergency_fund"} <= found
    assert r.risks[0].severity == "high"


def test_empty_profile_asks_for_data(persona):
    empty = persona.model_copy(update={"income": [], "expenses": [], "debts": [], "goals": []})
    r = health_report(empty)
    assert r.score == 0
    assert {"no_income", "no_expenses"} <= ids(r)


def test_bands():
    assert [band_for(s) for s in (10, 50, 60, 80, 90)] == ["Critical", "Weak", "Fair", "Good", "Excellent"]
