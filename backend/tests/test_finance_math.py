from datetime import date

from app.services.finance_math import (
    add_months, amortized_emi, clamp_score, duration, inr, payoff_months, to_monthly,
)


def test_amortized_emi_matches_known_value():
    # ₹10 lakh at 10% for 20 years → ₹9,650.22 (standard bank EMI tables)
    assert round(amortized_emi(1_000_000, 10, 240), 2) == 9650.22


def test_zero_interest_emi_is_simple_division():
    assert amortized_emi(12000, 0, 12) == 1000


def test_payoff_months():
    assert payoff_months(10000, 0, 1000) == 10
    assert payoff_months(48000, 42, 1680) is None      # payment only covers interest
    assert payoff_months(48000, 42, 5000) == 12


def test_inr_uses_indian_grouping():
    assert inr(172800) == "₹1,72,800"
    assert inr(12345678) == "₹1,23,45,678"
    assert inr(-500) == "-₹500"


def test_helpers():
    assert to_monthly(12000, "yearly") == 1000
    assert to_monthly(5000, "one_time") == 0
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert clamp_score(10, 20, 0) == 50
    assert clamp_score(60, 15, 50) == 0
    assert duration(5) == "5 months"
    assert duration(30) == "2 years 6 months"
