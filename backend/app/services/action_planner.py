"""
Personalized Action Planner.

Turns the health report and forecast into concrete steps with rupee
amounts and dates. Every action has a stable `action_key`, so when
the plan is regenerated a step the user already marked done keeps
its status.

Order of operations follows standard practice:
  fix missing data → stop the monthly bleed → emergency cushion →
  kill high-interest debt → cover upcoming tight months → goals → invest.
"""
import math

from app.schemas.finmentor import FinancialProfile, Forecast, HealthReport, PlannedAction
from app.services.finance_math import add_months, inr, payoff_months, to_monthly
from app.services.health_engine import HIGH_INTEREST_RATE, _people, _slug

MAX_TRIM_SHARE = 0.4   # never suggest cutting a single spending line by more than 40%


def build_plan(profile: FinancialProfile, report: HealthReport, fc: Forecast) -> list[PlannedAction]:
    m = report.metrics
    actions: list[PlannedAction] = []

    # ---------- 0. Missing data ----------
    if m.monthly_income <= 0:
        actions.append(PlannedAction(action_key="profile_add_income", focus_area="profile", priority=1,
                                     title="Add your income",
                                     detail="Every other number depends on it. Add your salary and any side income."))
    if not profile.expenses:
        actions.append(PlannedAction(action_key="profile_add_expenses", focus_area="profile", priority=1,
                                     title="List your regular expenses",
                                     detail="Rent, groceries, bills, subscriptions — mark which ones are essential."))
    if m.monthly_income <= 0:
        return actions

    # ---------- 1. Spending ----------
    target_disc = 0.2 * m.monthly_income
    cut_needed = max(m.discretionary_expenses - target_disc, -m.surplus if m.surplus < 0 else 0)
    freed = 0.0
    if cut_needed > 0:
        wants = sorted((e for e in profile.expenses if not e.is_essential),
                       key=lambda e: to_monthly(e.amount, e.frequency), reverse=True)
        lines, remaining = [], cut_needed
        for e in wants:
            if remaining <= 0:
                break
            monthly = to_monthly(e.amount, e.frequency)
            trim = min(monthly * MAX_TRIM_SHARE, remaining)
            trim = math.ceil(trim / 100) * 100
            if trim <= 0:
                continue
            lines.append(f"{e.label} {inr(monthly)} → {inr(monthly - trim)}")
            freed += trim
            remaining -= trim
        if lines:
            actions.append(PlannedAction(
                action_key="spend_trim_wants", focus_area="spend", priority=1 if m.surplus < 0 else 2,
                title=f"Trim non-essential spending by {inr(freed)}/month",
                detail="; ".join(lines) + f". This brings wants to about "
                       f"{round((m.discretionary_expenses - freed) / m.monthly_income * 100)}% of income.",
                impact_amount=freed,
            ))
        if remaining > 0 and m.surplus < 0:
            essentials = sorted((e for e in profile.expenses if e.is_essential),
                                key=lambda e: to_monthly(e.amount, e.frequency), reverse=True)
            biggest = essentials[0].label if essentials else "your largest fixed cost"
            actions.append(PlannedAction(
                action_key="spend_reduce_essentials", focus_area="spend", priority=1,
                title=f"Close the remaining {inr(remaining)}/month gap",
                detail=f"Trimming wants isn't enough. Look at your biggest fixed cost ({biggest}) "
                       f"or add income — otherwise savings drain every month.",
                impact_amount=remaining,
            ))

    available = max(m.free_cash, 0) + freed

    # ---------- 2. Emergency fund ----------
    emergency_monthly = 0.0
    if m.monthly_obligations > 0 and m.emergency_months < 6:
        target_months = 3 if m.emergency_months < 3 else 6
        gap = target_months * m.monthly_obligations - m.liquid_savings
        if available > 0:
            emergency_monthly = min(available, max(gap / 12, min(gap / 6, available * 0.6)))
            emergency_monthly = math.ceil(emergency_monthly / 500) * 500
            months = math.ceil(gap / emergency_monthly)
            reach = add_months(profile.as_of, months)
            payday = f" on payday (day {profile.salary_day})" if profile.salary_day else " every payday"
            detail = (f"You have {m.emergency_months} months of cover; {target_months} months is "
                      f"{inr(target_months * m.monthly_obligations)}. Auto-transfer {inr(emergency_monthly)}"
                      f"{payday} into a separate savings account to close the {inr(gap)} gap by {reach:%b %Y}.")
        else:
            detail = (f"You need {inr(gap)} more for {target_months} months of cover. Free up cash first "
                      f"(steps above), then send it here before anything else.")
        actions.append(PlannedAction(
            action_key=f"save_emergency_{target_months}m", focus_area="save",
            priority=1 if target_months == 3 else 3,
            title=f"Build a {target_months}-month emergency fund"
                  + (f": save {inr(emergency_monthly)}/month" if emergency_monthly else ""),
            detail=detail, impact_amount=emergency_monthly or None,
        ))
        available -= emergency_monthly

    # ---------- 3. Debt ----------
    costly = sorted((d for d in profile.debts if d.interest_rate >= HIGH_INTEREST_RATE and d.outstanding > 0),
                    key=lambda d: d.interest_rate, reverse=True)
    for rank, d in enumerate(costly):
        monthly_interest = d.outstanding * d.interest_rate / 1200
        extra = 0.0
        if rank == 0 and available > 0:
            extra = math.ceil(min(available, d.outstanding) / 500) * 500
        base_months = payoff_months(d.outstanding, d.interest_rate, d.emi)
        if extra:
            fast_months = payoff_months(d.outstanding, d.interest_rate, d.emi + extra)
            base_txt = f"{base_months} months" if base_months else "never at the minimum payment"
            saved = ((base_months * d.emi - d.outstanding) if base_months else None)
            fast_interest = fast_months * (d.emi + extra) - d.outstanding
            saving_txt = (f", saving about {inr(saved - fast_interest)} in interest"
                          if saved is not None and saved > fast_interest else "")
            detail = (f"At {d.interest_rate:g}% it costs {inr(monthly_interest)}/month in interest. Paying "
                      f"{inr(d.emi + extra)} instead of {inr(d.emi)} clears it in {fast_months} months "
                      f"(vs {base_txt}){saving_txt}. Stop new spending on it meanwhile.")
            title = f"Pay {inr(extra)} extra/month on {d.label}"
        else:
            detail = (f"At {d.interest_rate:g}% it costs {inr(monthly_interest)}/month in interest — "
                      f"the most expensive money you owe. Direct any bonus or freed-up cash here first.")
            title = f"Clear {d.label} next ({d.interest_rate:g}% interest)" if rank else \
                f"Make {d.label} your first debt to clear"
        actions.append(PlannedAction(action_key=f"debt_prepay_{_slug(d.label)}", focus_area="debt",
                                     priority=1 if rank == 0 else 2, title=title, detail=detail,
                                     impact_amount=round(monthly_interest, 2)))
        available -= extra

    if m.debt_to_income > 30:
        actions.append(PlannedAction(
            action_key="debt_no_new_emis", focus_area="debt", priority=1 if m.debt_to_income > 40 else 2,
            title="Hold off on new EMIs",
            detail=f"{m.debt_to_income}% of income already goes to EMIs. Wait until it's under 30% "
                   f"(below {inr(m.monthly_income * 0.3)}/month) before borrowing again.",
        ))

    # ---------- 4. Tight months ahead ----------
    tight = [p for p in fc.points if p.status != "ok"]
    if tight:
        worst = min(tight, key=lambda p: p.balance)
        set_aside = math.ceil((fc.safety_buffer - worst.balance) / 500) * 500
        events = [e for p in fc.points[:fc.points.index(worst) + 1] for e in p.events]
        ev_txt = f" One-off payments coming up: {', '.join(events)}." if events else ""
        actions.append(PlannedAction(
            action_key=f"cashflow_prepare_{worst.month}", focus_area="cashflow",
            priority=1 if worst.status == "shortfall" else 2,
            title=f"Prepare {inr(set_aside)} for {worst.label}",
            detail=f"Your balance is projected to drop to {inr(worst.balance)} in {worst.label}."
                   f"{ev_txt} Postpone anything optional, or park this amount aside now.",
            impact_amount=set_aside,
        ))

    # ---------- 5. Goals ----------
    goal_rows = {g.label: g for g in profile.goals}
    for g in sorted(report.goals, key=lambda g: g.priority):
        if g.on_track:
            continue
        row = goal_rows.get(g.label)
        current = row.monthly_contribution if row else g.effective_contribution
        options = []
        if g.required_monthly:
            options.append(f"raise it from {inr(current)} to {inr(g.required_monthly)}/month "
                           f"(+{inr(g.required_monthly - current)})")
        if g.projected_date:
            options.append(f"move the target date to {g.projected_date:%b %Y}")
        if len(options) == 2:
            detail = f"'{g.label}' is {g.progress_pct}% funded. Either {options[0]} or {options[1]}."
        elif options:
            detail = f"'{g.label}' is {g.progress_pct}% funded. To stay on schedule, {options[0]}."
        else:
            detail = f"'{g.label}' has no monthly contribution yet — set one up."
        actions.append(PlannedAction(
            action_key=f"goal_{_slug(g.label)}", focus_area="goals", priority=2 if g.priority == 1 else 3,
            title=f"Get '{g.label}' back on track", detail=detail,
            impact_amount=(g.required_monthly - current) if g.required_monthly else None,
        ))
    if m.free_cash < 0 and len(profile.goals) > 1:
        low = max(profile.goals, key=lambda g: (g.priority, g.monthly_contribution))
        actions.append(PlannedAction(
            action_key="goals_rebalance", focus_area="goals", priority=2,
            title=f"Pause '{low.label}' contributions for now",
            detail=f"Your goal contributions exceed your surplus by {inr(-m.free_cash)}/month. Pausing "
                   f"the lower-priority '{low.label}' ({inr(low.monthly_contribution)}/month) protects the rest.",
            impact_amount=low.monthly_contribution,
        ))

    # ---------- 6. Protection & growth ----------
    if profile.num_dependents > 0 and not profile.savings.health_insurance_cover:
        actions.append(PlannedAction(
            action_key="protect_health_cover", focus_area="save", priority=2,
            title="Get family health insurance",
            detail=f"{_people(profile.num_dependents)} on you and no health cover is recorded. "
                   f"A family floater plan is usually far cheaper than one hospital bill.",
        ))
    if available > 1000 and m.emergency_months >= 3 and not costly:
        invest = math.floor(available * 0.8 / 500) * 500
        actions.append(PlannedAction(
            action_key="grow_invest_surplus", focus_area="save", priority=3,
            title=f"Put {inr(invest)}/month to work",
            detail=f"You have about {inr(available)} unallocated each month. Automating {inr(invest)} into "
                   f"a long-term SIP keeps it from drifting into spending.",
            impact_amount=invest,
        ))

    return sorted(actions, key=lambda a: (a.priority, -(a.impact_amount or 0)))
