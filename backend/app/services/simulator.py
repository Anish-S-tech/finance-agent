"""
What-If Simulator.

Applies a stack of hypothetical changes to a *copy* of the profile and
reruns the health and forecast engines on both, so every comparison
uses exactly the same math as the dashboard.

How each change is modelled
- purchase (cash) / emergency cost: comes out of current savings now
  (month 0), or appears as a one-off outflow in a later month.
- purchase (EMI) / new loan: adds a debt with a standard amortized EMI.
- income / expense changes and savings plans: an ongoing CashFlow from
  start_month (or a temporary one when `months` is set).
"""
from app.schemas.finmentor import (
    CashFlow, Debt, EmergencyChange, ExpenseChange, FinancialProfile, GoalDelay,
    IncomeChange, LoanChange, PurchaseChange, SavingsPlanChange, ScenarioChange,
    SimulationDelta, SimulationResult,
)
from app.services.finance_math import amortized_emi, to_monthly
from app.services.forecast import forecast as run_forecast
from app.services.health_engine import health_report


def _spend_now(p: FinancialProfile, amount: float) -> None:
    """Pay from the bank balance first, then the emergency fund; any remainder overdraws the balance."""
    from_savings = min(amount, max(p.savings.current_savings, 0))
    p.savings.current_savings -= from_savings
    rest = amount - from_savings
    from_fund = min(rest, p.savings.emergency_fund)
    p.savings.emergency_fund -= from_fund
    p.savings.current_savings -= rest - from_fund


def _one_off(p: FinancialProfile, label: str, amount: float, month: int) -> None:
    if amount <= 0:
        return
    if month == 0:
        _spend_now(p, amount)
    else:
        p.extra_flows.append(CashFlow(label=label, amount=-amount, kind="one_time",
                                      start_month=month, months=1))


def apply_changes(profile: FinancialProfile, changes: list[ScenarioChange]) -> FinancialProfile:
    p = profile.model_copy(deep=True)
    base_income = sum(to_monthly(i.amount, i.frequency) for i in profile.income)

    for c in changes:
        if isinstance(c, PurchaseChange):
            if c.mode == "cash":
                _one_off(p, c.label, c.amount, c.month)
            else:
                _one_off(p, f"{c.label} down payment", c.down_payment, c.month)
                financed = max(0.0, c.amount - c.down_payment)
                if financed > 0:
                    p.debts.append(Debt(
                        label=f"{c.label} EMI", debt_type="personal", outstanding=financed,
                        interest_rate=c.interest_rate,
                        emi=round(amortized_emi(financed, c.interest_rate, c.tenure_months), 2),
                        remaining_months=c.tenure_months,
                    ))

        elif isinstance(c, LoanChange):
            p.debts.append(Debt(
                label=c.label, debt_type="personal", outstanding=c.principal,
                interest_rate=c.interest_rate,
                emi=round(amortized_emi(c.principal, c.interest_rate, c.tenure_months), 2),
                remaining_months=c.tenure_months,
            ))
            if c.receive_cash:
                p.savings.current_savings += c.principal

        elif isinstance(c, IncomeChange):
            delta = c.amount if c.amount is not None else base_income * (c.percent or 0) / 100
            if delta:
                p.extra_flows.append(CashFlow(label=c.label, amount=delta, kind="income",
                                              start_month=c.start_month, months=c.months))

        elif isinstance(c, EmergencyChange):
            _one_off(p, c.label, c.amount, c.month)
            if c.income_loss_months and base_income > 0:
                p.extra_flows.append(CashFlow(label=f"{c.label}: income lost", amount=-base_income,
                                              kind="income", start_month=c.month,
                                              months=c.income_loss_months))

        elif isinstance(c, SavingsPlanChange):
            p.extra_flows.append(CashFlow(label=c.label, amount=-c.monthly_amount, kind="savings",
                                          start_month=c.start_month))

        elif isinstance(c, ExpenseChange):
            essential = c.essential
            if c.amount is not None:
                delta = c.amount
            else:
                in_cat = [e for e in profile.expenses if e.category == c.category]
                cat_total = sum(to_monthly(e.amount, e.frequency) for e in in_cat)
                delta = cat_total * (c.percent or 0) / 100
                essential = bool(in_cat) and all(e.is_essential for e in in_cat)
            if delta:
                # Spending more is an outflow (negative CashFlow amount).
                p.extra_flows.append(CashFlow(label=c.label, amount=-delta, kind="expense",
                                              essential=essential, start_month=c.start_month))
    return p


def simulate(profile: FinancialProfile, changes: list[ScenarioChange], months: int = 12) -> SimulationResult:
    scenario_profile = apply_changes(profile, changes)

    base_fc = run_forecast(profile, months)
    scen_fc = run_forecast(scenario_profile, months)
    base = health_report(profile, base_fc)
    scen = health_report(scenario_profile, scen_fc)

    delays = []
    for b, s in zip(base.goals, scen.goals):
        if b.projected_months is None or s.projected_months is None:
            delay = None if s.projected_months is None and b.projected_months is not None else 0
        else:
            delay = s.projected_months - b.projected_months
        delays.append(GoalDelay(label=b.label, baseline_months=b.projected_months,
                                scenario_months=s.projected_months, delay_months=delay))

    base_risk_ids = {r.id for r in base.risks}
    bm, sm = base.metrics, scen.metrics
    return SimulationResult(
        baseline=base,
        scenario=scen,
        baseline_forecast=base_fc,
        scenario_forecast=scen_fc,
        delta=SimulationDelta(
            score=round(scen.score - base.score, 1),
            savings_rate=round(sm.savings_rate - bm.savings_rate, 1),
            debt_to_income=round(sm.debt_to_income - bm.debt_to_income, 1),
            emergency_months=round(sm.emergency_months - bm.emergency_months, 1),
            free_cash=round(sm.free_cash - bm.free_cash, 2),
            lowest_balance=round(scen_fc.lowest_balance - base_fc.lowest_balance, 2),
            ending_balance=round(scen_fc.points[-1].balance - base_fc.points[-1].balance, 2),
            new_shortfall_months=len(scen_fc.shortfall_months) - len(base_fc.shortfall_months),
        ),
        goal_delays=delays,
        new_risks=[r for r in scen.risks if r.id not in base_risk_ids],
    )
