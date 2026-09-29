from app.schemas.finmentor import AffordRequest
from app.services.affordability import can_afford


def test_small_purchase_is_ok_with_caution_for_thin_cushion(persona):
    r = can_afford(persona, AffordRequest(item="headphones", cost=4000))
    assert r.verdict == "yes_with_caution"
    assert not next(c for c in r.checks if c.key == "emergency").passed


def test_big_cash_purchase_is_refused(persona):
    r = can_afford(persona, AffordRequest(item="phone", cost=60000))
    assert r.verdict == "no"
    assert 0 < r.max_comfortable_amount < 60000
    assert r.alternatives


def test_more_than_liquid_savings_is_no(persona):
    r = can_afford(persona, AffordRequest(item="car", cost=500000))
    assert r.verdict == "no"
    assert not next(c for c in r.checks if c.key == "cash").passed


def test_emi_purchase_reports_emi_and_safer_tenure(persona):
    r = can_afford(persona, AffordRequest(item="bike", cost=150000, mode="emi", tenure_months=12,
                                          interest_rate=12))
    assert r.monthly_emi == 13327.32
    assert r.verdict in ("not_now", "no")
    assert any("tenure" in a for a in r.alternatives)


def test_healthy_household_can_afford_reasonable_purchase(healthy):
    r = can_afford(healthy, AffordRequest(item="laptop", cost=80000))
    assert r.verdict == "yes"
    assert r.max_comfortable_amount >= 80000


def test_max_comfortable_amount_really_is_safe(persona):
    r = can_afford(persona, AffordRequest(item="x", cost=60000))
    at_max = can_afford(persona, AffordRequest(item="x", cost=r.max_comfortable_amount))
    assert at_max.verdict in ("yes", "yes_with_caution")
