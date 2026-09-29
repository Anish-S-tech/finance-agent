"""
Cash-flow Forecast Engine.

Projects the user's cash balance month by month. Deterministic:
every rupee comes from a profile row, so the mentor can explain
exactly why a month dips.

Model
- Month 0 is the *next* calendar month (the next full pay cycle).
  One-off payments still due this month are folded into month 0.
- Starting balance = current_savings (the spendable account). The
  emergency fund is a separate reserve and is not spent here.
- Each month: recurring income − recurring expenses − active EMIs −
  goal contributions (until the goal is reached) ± one-off dated
  payments from the financial calendar ± simulator cash flows.
- Recurring calendar entries are skipped: recurring bills belong in
  Expenses/Debts, and counting both would double-count them.
"""
from datetime import date

from app.schemas.finmentor import FinancialProfile, Forecast, ForecastPoint
from app.services.finance_math import add_months, inr, month_index, to_monthly

DEFAULT_MONTHS = 6


def safety_buffer(profile: FinancialProfile) -> float:
    """One month of unavoidable outflow: essential expenses + EMIs."""
    essential = sum(to_monthly(e.amount, e.frequency) for e in profile.expenses if e.is_essential)
    emis = sum(d.emi for d in profile.debts if d.remaining_months is None or d.remaining_months > 0)
    return round(essential + emis, 2)


def forecast(profile: FinancialProfile, months: int = DEFAULT_MONTHS) -> Forecast:
    start = add_months(date(profile.as_of.year, profile.as_of.month, 1), 1)
    buffer = safety_buffer(profile)

    base_income = sum(to_monthly(i.amount, i.frequency) for i in profile.income)
    one_off_income = sum(i.amount for i in profile.income if i.frequency == "one_time")
    base_expenses = sum(to_monthly(e.amount, e.frequency) for e in profile.expenses)
    one_off_expenses = sum(e.amount for e in profile.expenses if e.frequency == "one_time")

    goal_balances = {id(g): g.current_amount for g in profile.goals}

    balance = profile.savings.current_savings
    points: list[ForecastPoint] = []
    milestones: list[str] = []

    for i in range(months):
        month_start = add_months(start, i)
        label = month_start.strftime("%b %Y")
        inflow = base_income + (one_off_income if i == 0 else 0)
        outflow = base_expenses + (one_off_expenses if i == 0 else 0)
        events: list[str] = []

        for d in profile.debts:
            if d.remaining_months is None or i < d.remaining_months:
                outflow += d.emi
                if d.remaining_months is not None and i == d.remaining_months - 1:
                    milestones.append(f"{d.label}: last EMI in {label}")

        for g in profile.goals:
            remaining = g.target_amount - goal_balances[id(g)]
            if remaining > 0 and g.monthly_contribution > 0:
                paid = min(g.monthly_contribution, remaining)
                outflow += paid
                goal_balances[id(g)] += paid
                if goal_balances[id(g)] >= g.target_amount:
                    milestones.append(f"{g.label}: target reached in {label}")

        for p in profile.upcoming:
            if p.is_recurring or p.due_date < profile.as_of:
                continue
            if max(month_index(start, p.due_date), 0) != i:
                continue
            if p.event_type == "salary":
                inflow += p.amount
            else:
                outflow += p.amount
                events.append(f"{p.label} {inr(p.amount)}")

        for f in profile.extra_flows:
            active = f.start_month <= i and (f.months is None or i < f.start_month + f.months)
            if not active:
                continue
            if f.amount >= 0:
                inflow += f.amount
            else:
                outflow += -f.amount
            if f.months is not None or f.start_month == i:
                events.append(f"{f.label} {inr(f.amount)}")

        net = inflow - outflow
        balance += net
        status = "shortfall" if balance < 0 else "low" if balance < buffer else "ok"
        points.append(ForecastPoint(
            month=month_start.strftime("%Y-%m"),
            label=label,
            inflow=round(inflow, 2),
            outflow=round(outflow, 2),
            net=round(net, 2),
            balance=round(balance, 2),
            events=events,
            status=status,
        ))

    lowest = min(points, key=lambda p: p.balance) if points else None
    return Forecast(
        starting_balance=round(profile.savings.current_savings, 2),
        safety_buffer=buffer,
        points=points,
        lowest_balance=lowest.balance if lowest else profile.savings.current_savings,
        lowest_month=lowest.label if lowest else "",
        shortfall_months=[p.label for p in points if p.status == "shortfall"],
        low_months=[p.label for p in points if p.status == "low"],
        milestones=milestones,
    )
