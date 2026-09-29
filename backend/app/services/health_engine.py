"""
Financial Health & Risk Engine.

Rule-based, like the Completeness Engine: it computes standard
personal-finance ratios, scores each against a widely used target,
blends them into a 0–100 health score, and flags concrete risks
with the numbers that triggered them.

Targets used (common rules of thumb for Indian households):
- Savings rate ≥ 20% of income
- Debt-to-income (EMIs / income) ≤ 15% ideal, > 40% dangerous
- Emergency fund ≥ 6 months of essential outflow (3 is the minimum)
- Discretionary spending ≤ 20% of income
- Credit-card utilisation ≤ 30%
"""
import math

from app.schemas.finmentor import (
    FinancialProfile, Forecast, GoalStatus, HealthReport, Metrics, Risk, ScoreComponent,
)
from app.services.finance_math import add_months, clamp_score, inr, months_between, to_monthly
from app.services.forecast import forecast as run_forecast

HIGH_INTEREST_RATE = 18.0   # % p.a. — anything at or above this should be cleared first
WEIGHTS = {
    "savings_rate": 25,
    "emergency": 25,
    "debt": 20,
    "discretionary": 10,
    "goals": 10,
    "credit": 10,
}


def compute_metrics(profile: FinancialProfile) -> Metrics:
    income = sum(to_monthly(i.amount, i.frequency) for i in profile.income)
    essential = sum(to_monthly(e.amount, e.frequency) for e in profile.expenses if e.is_essential)
    discretionary = sum(to_monthly(e.amount, e.frequency) for e in profile.expenses if not e.is_essential)
    emi = sum(d.emi for d in profile.debts if d.remaining_months is None or d.remaining_months > 0)
    contributions = sum(g.monthly_contribution for g in profile.goals
                        if g.current_amount < g.target_amount)

    # Ongoing simulator flows change the steady-state picture.
    for f in profile.extra_flows:
        if f.months is not None:
            continue
        if f.kind == "income":
            income += f.amount
        elif f.kind == "expense":
            if f.essential:
                essential -= f.amount
            else:
                discretionary -= f.amount
        elif f.kind == "savings":
            contributions -= f.amount
    essential, discretionary = max(essential, 0), max(discretionary, 0)

    expenses = essential + discretionary
    surplus = income - expenses - emi
    liquid = profile.savings.current_savings + profile.savings.emergency_fund
    obligations = essential + emi

    cards = [d for d in profile.debts if d.debt_type == "credit_card" and d.credit_limit]
    utilisation = (
        round(sum(d.outstanding for d in cards) / sum(d.credit_limit for d in cards) * 100, 1)
        if cards else None
    )

    return Metrics(
        monthly_income=round(income, 2),
        monthly_expenses=round(expenses, 2),
        essential_expenses=round(essential, 2),
        discretionary_expenses=round(discretionary, 2),
        monthly_emi=round(emi, 2),
        goal_contributions=round(contributions, 2),
        surplus=round(surplus, 2),
        free_cash=round(surplus - contributions, 2),
        savings_rate=round(surplus / income * 100, 1) if income else 0.0,
        debt_to_income=round(emi / income * 100, 1) if income else (100.0 if emi else 0.0),
        liquid_savings=round(liquid, 2),
        monthly_obligations=round(obligations, 2),
        emergency_months=round(liquid / obligations, 1) if obligations else (12.0 if liquid else 0.0),
        discretionary_share=round(discretionary / income * 100, 1) if income else 0.0,
        credit_utilisation=utilisation,
        total_debt=round(sum(d.outstanding for d in profile.debts), 2),
        high_interest_debt=round(sum(d.outstanding for d in profile.debts
                                     if d.interest_rate >= HIGH_INTEREST_RATE), 2),
    )


def goal_statuses(profile: FinancialProfile, metrics: Metrics) -> list[GoalStatus]:
    """
    Projects each goal at its *effective* contribution: if free cash is
    negative, contributions can't all be kept up, so they are scaled
    down proportionally by the deficit.
    """
    active = [g for g in profile.goals if g.current_amount < g.target_amount]
    planned = sum(g.monthly_contribution for g in active)
    scale = 1.0
    if metrics.free_cash < 0 and planned > 0:
        scale = max(0.0, (planned + metrics.free_cash) / planned)

    statuses = []
    for g in profile.goals:
        remaining = max(0.0, g.target_amount - g.current_amount)
        effective = g.monthly_contribution * scale if remaining > 0 else 0.0
        months_left = months_between(profile.as_of, g.target_date) if g.target_date else None
        required = remaining / max(months_left, 1) if months_left is not None else None

        if remaining <= 0:
            projected = 0
        elif effective > 0:
            projected = math.ceil(remaining / effective)
        else:
            projected = None

        if remaining <= 0:
            on_track = True
        elif projected is None:
            on_track = False
        elif months_left is None:
            on_track = True
        else:
            on_track = projected <= max(months_left, 1)

        statuses.append(GoalStatus(
            label=g.label,
            priority=g.priority,
            target_amount=g.target_amount,
            current_amount=g.current_amount,
            progress_pct=round(min(100.0, g.current_amount / g.target_amount * 100), 1),
            target_date=g.target_date,
            months_left=months_left,
            required_monthly=round(required, 2) if required is not None else None,
            effective_contribution=round(effective, 2),
            projected_months=projected,
            projected_date=add_months(profile.as_of, projected) if projected is not None else None,
            on_track=on_track,
        ))
    return statuses


def score_components(metrics: Metrics, goals: list[GoalStatus]) -> list[ScoreComponent]:
    comps = [
        ScoreComponent(key="savings_rate", label="Savings rate", weight=WEIGHTS["savings_rate"],
                       value=metrics.savings_rate, target="≥ 20% of income",
                       score=clamp_score(metrics.savings_rate, 20, 0)),
        ScoreComponent(key="emergency", label="Emergency fund", weight=WEIGHTS["emergency"],
                       value=metrics.emergency_months, target="≥ 6 months of essentials",
                       score=clamp_score(metrics.emergency_months, 6, 0)),
        ScoreComponent(key="debt", label="Debt load", weight=WEIGHTS["debt"],
                       value=metrics.debt_to_income, target="EMIs ≤ 15% of income",
                       score=clamp_score(metrics.debt_to_income, 15, 50)),
        ScoreComponent(key="discretionary", label="Spending control", weight=WEIGHTS["discretionary"],
                       value=metrics.discretionary_share, target="Wants ≤ 20% of income",
                       score=clamp_score(metrics.discretionary_share, 20, 50)),
    ]
    if goals:
        weights = {1: 3, 2: 2, 3: 1}
        total = sum(weights[g.priority] for g in goals)
        on_track = sum(weights[g.priority] for g in goals if g.on_track)
        comps.append(ScoreComponent(key="goals", label="Goals on track", weight=WEIGHTS["goals"],
                                    value=round(on_track / total * 100, 1), target="All goals on pace",
                                    score=round(on_track / total * 100, 1)))
    if metrics.credit_utilisation is not None:
        comps.append(ScoreComponent(key="credit", label="Credit utilisation", weight=WEIGHTS["credit"],
                                    value=metrics.credit_utilisation, target="≤ 30% of card limit",
                                    score=clamp_score(metrics.credit_utilisation, 30, 90)))
    return comps


def band_for(score: float) -> str:
    if score < 40:
        return "Critical"
    if score < 55:
        return "Weak"
    if score < 70:
        return "Fair"
    if score < 85:
        return "Good"
    return "Excellent"


def detect_risks(profile: FinancialProfile, m: Metrics, goals: list[GoalStatus],
                 fc: Forecast) -> list[Risk]:
    risks: list[Risk] = []

    if m.monthly_income <= 0:
        risks.append(Risk(id="no_income", severity="high", category="data",
                          title="No income on file",
                          detail="Add your income so FinMentor can check what you can afford."))
    if not profile.expenses:
        risks.append(Risk(id="no_expenses", severity="medium", category="data",
                          title="No expenses on file",
                          detail="Add rent, bills and regular spending — without them every other number looks better than it is."))

    # --- Cash flow ---
    if m.monthly_income > 0 and m.surplus < 0:
        risks.append(Risk(id="monthly_deficit", severity="high", category="cashflow",
                          title="You spend more than you earn",
                          detail=f"Expenses and EMIs exceed income by {inr(-m.surplus)} every month.",
                          value=m.surplus))
    elif m.free_cash < 0:
        risks.append(Risk(id="overcommitted_goals", severity="medium", category="cashflow",
                          title="Goal contributions exceed your surplus",
                          detail=f"You plan {inr(m.goal_contributions)}/month for goals but only have "
                                 f"{inr(m.surplus)} left after expenses and EMIs.",
                          value=m.free_cash))
    if fc.shortfall_months:
        risks.append(Risk(id="forecast_shortfall", severity="high", category="cashflow",
                          title=f"Cash runs out in {fc.shortfall_months[0]}",
                          detail=f"Your balance is projected to fall to {inr(fc.lowest_balance)} in "
                                 f"{fc.lowest_month}.",
                          value=fc.lowest_balance))
    elif fc.low_months:
        risks.append(Risk(id="forecast_low", severity="medium", category="cashflow",
                          title=f"Tight month ahead: {fc.lowest_month}",
                          detail=f"Your balance dips to {inr(fc.lowest_balance)} in {fc.lowest_month}, "
                                 f"below one month of essentials and EMIs ({inr(fc.safety_buffer)}).",
                          value=fc.lowest_balance))

    # --- Spending ---
    if m.monthly_income > 0 and m.discretionary_share > 30:
        risks.append(Risk(id="overspending", severity="high" if m.discretionary_share > 40 else "medium",
                          category="spending",
                          title="Discretionary spending is high",
                          detail=f"Non-essential spending is {inr(m.discretionary_expenses)}/month — "
                                 f"{m.discretionary_share}% of income (target ≤ 20%).",
                          value=m.discretionary_share))
    elif m.monthly_income > 0 and m.monthly_expenses / m.monthly_income > 0.7:
        risks.append(Risk(id="high_cost_of_living", severity="medium", category="spending",
                          title="Living costs take most of your income",
                          detail=f"Expenses are {round(m.monthly_expenses / m.monthly_income * 100)}% of income.",
                          value=m.monthly_expenses))

    # --- Debt ---
    if m.debt_to_income > 40:
        risks.append(Risk(id="debt_pressure", severity="high", category="debt",
                          title="EMIs are straining your income",
                          detail=f"{m.debt_to_income}% of income goes to EMIs (lenders' comfort limit ≈ 40%).",
                          value=m.debt_to_income))
    elif m.debt_to_income > 30:
        risks.append(Risk(id="debt_pressure", severity="medium", category="debt",
                          title="Debt load is getting heavy",
                          detail=f"{m.debt_to_income}% of income goes to EMIs. Avoid new loans until it's under 30%.",
                          value=m.debt_to_income))
    for d in profile.debts:
        if d.interest_rate >= HIGH_INTEREST_RATE and d.outstanding > 0:
            monthly_interest = d.outstanding * d.interest_rate / 1200
            risks.append(Risk(id=f"high_interest_{_slug(d.label)}", severity="medium", category="debt",
                              title=f"Expensive debt: {d.label}",
                              detail=f"{inr(d.outstanding)} at {d.interest_rate:g}% p.a. costs about "
                                     f"{inr(monthly_interest)} in interest every month.",
                              value=d.outstanding))
    if m.credit_utilisation is not None and m.credit_utilisation > 30:
        risks.append(Risk(id="credit_utilisation", severity="high" if m.credit_utilisation > 70 else "medium",
                          category="debt",
                          title="High credit-card utilisation",
                          detail=f"You're using {m.credit_utilisation}% of your card limit (keep it under 30% "
                                 f"to protect your credit score).",
                          value=m.credit_utilisation))

    # --- Emergency fund ---
    if m.monthly_obligations > 0 and m.emergency_months < 3:
        risks.append(Risk(id="thin_emergency_fund", severity="high" if m.emergency_months < 1 else "medium",
                          category="emergency",
                          title="Emergency savings are thin",
                          detail=f"Liquid savings of {inr(m.liquid_savings)} cover {m.emergency_months} months "
                                 f"of essentials + EMIs. Aim for at least 3 ({inr(m.monthly_obligations * 3)}).",
                          value=m.emergency_months))
    if profile.num_dependents > 0 and not profile.savings.health_insurance_cover:
        risks.append(Risk(id="no_health_cover", severity="low", category="emergency",
                          title="No health insurance recorded",
                          detail=f"{_people(profile.num_dependents)} on your income. A medical bill "
                                 f"would come straight out of savings."))

    # --- Goals ---
    for g in goals:
        if g.on_track:
            continue
        if g.projected_months is None:
            pace = "at the current pace it won't be reached"
        else:
            pace = f"at {inr(g.effective_contribution)}/month you'd reach it by {g.projected_date:%b %Y}"
        need = f"; it needs {inr(g.required_monthly)}/month" if g.required_monthly else ""
        risks.append(Risk(id=f"goal_off_track_{_slug(g.label)}",
                          severity="medium" if g.priority == 1 else "low", category="goals",
                          title=f"'{g.label}' is off track",
                          detail=f"{pace[0].upper()}{pace[1:]}{need}.",
                          value=g.required_monthly))

    order = {"high": 0, "medium": 1, "low": 2}
    return sorted(risks, key=lambda r: order[r.severity])


def health_report(profile: FinancialProfile, fc: Forecast | None = None) -> HealthReport:
    metrics = compute_metrics(profile)
    goals = goal_statuses(profile, metrics)
    comps = score_components(metrics, goals)
    total_weight = sum(c.weight for c in comps)
    score = round(sum(c.score * c.weight for c in comps) / total_weight, 1) if total_weight else 0.0
    if metrics.monthly_income <= 0:
        score = 0.0
    fc = fc or run_forecast(profile)
    return HealthReport(
        score=score,
        band=band_for(score),
        metrics=metrics,
        components=comps,
        goals=goals,
        risks=detect_risks(profile, metrics, goals, fc),
    )


def _people(n: int) -> str:
    return "1 person relies" if n == 1 else f"{n} people rely"


def _slug(text: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in text.lower()).strip("_")
