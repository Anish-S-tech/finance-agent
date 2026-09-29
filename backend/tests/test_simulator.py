from app.schemas.finmentor import (
    EmergencyChange, ExpenseChange, IncomeChange, LoanChange, PurchaseChange, SavingsPlanChange,
)
from app.services.finance_math import amortized_emi
from app.services.simulator import apply_changes, simulate


def test_does_not_mutate_the_original(persona):
    before = persona.model_dump()
    simulate(persona, [PurchaseChange(amount=50000)])
    assert persona.model_dump() == before


def test_emi_purchase_adds_amortized_debt(persona):
    p = apply_changes(persona, [PurchaseChange(label="Bike", amount=150000, mode="emi", down_payment=30000,
                                               tenure_months=24, interest_rate=12)])
    bike = p.debts[-1]
    assert bike.outstanding == 120000
    assert bike.emi == round(amortized_emi(120000, 12, 24), 2)
    assert p.savings.current_savings == persona.savings.current_savings - 30000


def test_cash_purchase_spills_into_emergency_fund(persona):
    p = apply_changes(persona, [PurchaseChange(amount=70000)])
    assert p.savings.current_savings == 0
    assert p.savings.emergency_fund == 20000


def test_income_drop_worsens_score(persona):
    r = simulate(persona, [IncomeChange(percent=-20)])
    assert r.delta.score < 0
    assert r.scenario.metrics.monthly_income == 76000


def test_cutting_wants_improves_things(persona):
    r = simulate(persona, [ExpenseChange(category="shopping", percent=-50)])
    assert r.scenario.metrics.discretionary_expenses == 21000 - 4500
    assert r.delta.free_cash == 4500
    assert r.delta.score > 0


def test_job_loss_emergency_creates_shortfall(persona):
    r = simulate(persona, [EmergencyChange(label="Job loss", amount=0, income_loss_months=3)])
    assert r.delta.new_shortfall_months > 0
    assert "forecast_shortfall" in {x.id for x in r.new_risks}


def test_new_loan_and_sip_stack(persona):
    goal_total = sum(g.monthly_contribution for g in persona.goals)
    r = simulate(persona, [LoanChange(principal=200000, tenure_months=36),
                           SavingsPlanChange(monthly_amount=5000)])
    assert r.delta.debt_to_income > 0
    assert r.scenario.metrics.goal_contributions == goal_total + 5000


def test_goal_delay_reported(persona):
    r = simulate(persona, [PurchaseChange(label="Car upgrade", amount=600000, mode="emi", tenure_months=60)])
    trip = next(d for d in r.goal_delays if d.label == "Europe trip")
    assert trip.delay_months is None or trip.delay_months > 0
