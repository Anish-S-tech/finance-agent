"""
"Can I Afford This?" Decision Engine.

Runs the purchase through the What-If Simulator and checks the result
against five plain rules. The verdict is the worst outcome across the
rules, so every "no" can be traced to a specific, explainable check.

  Rule                                       fails as
  1. Cash cost ≤ liquid savings              no
  2. Emergency fund still ≥ 3 months         <1 month: no · 1–3: not_now
                                             (if already <3: small dips are only a caution)
  3. Debt-to-income after ≤ 40%              >50%: no · 40–50%: not_now
  4. No forecast month goes negative         not_now
  5. Monthly surplus stays ≥ 0               not_now
  6. No goal slips by more than 3 months     yes_with_caution
"""
import math

from app.schemas.finmentor import (
    AffordabilityResult, AffordCheck, AffordRequest, FinancialProfile, PurchaseChange,
)
from app.services.finance_math import amortized_emi, duration, inr
from app.services.simulator import simulate

HORIZON_MONTHS = 12
VERDICT_RANK = {"yes": 0, "yes_with_caution": 1, "not_now": 2, "no": 3}
TENURE_OPTIONS = [6, 12, 18, 24, 36, 48, 60]


def _purchase(req: AffordRequest, cost: float | None = None, tenure: int | None = None) -> PurchaseChange:
    return PurchaseChange(label=req.item, amount=cost if cost is not None else req.cost, mode=req.mode,
                          tenure_months=tenure or req.tenure_months, interest_rate=req.interest_rate,
                          down_payment=min(req.down_payment, cost if cost is not None else req.cost))


def _evaluate(profile: FinancialProfile, req: AffordRequest, cost: float, tenure: int | None = None):
    sim = simulate(profile, [_purchase(req, cost, tenure)], HORIZON_MONTHS)
    sm, bm = sim.scenario.metrics, sim.baseline.metrics
    upfront = cost if req.mode == "cash" else min(req.down_payment, cost)

    checks: list[AffordCheck] = []
    worst = "yes"

    def fail(level: str):
        nonlocal worst
        if VERDICT_RANK[level] > VERDICT_RANK[worst]:
            worst = level

    ok = upfront <= bm.liquid_savings
    checks.append(AffordCheck(key="cash", label="Enough cash to pay upfront", passed=ok,
                              detail=f"Upfront {inr(upfront)} vs liquid savings {inr(bm.liquid_savings)}."))
    if not ok:
        fail("no")

    ok = sm.emergency_months >= 3 or sm.monthly_obligations == 0
    checks.append(AffordCheck(key="emergency", label="Emergency fund stays ≥ 3 months", passed=ok,
                              detail=f"Cover goes from {bm.emergency_months} to {sm.emergency_months} months."))
    if not ok:
        drop = bm.emergency_months - sm.emergency_months
        if bm.emergency_months >= 3:
            # This purchase is what breaks a healthy cushion.
            fail("no" if sm.emergency_months < 1 else "not_now")
        elif drop > 0.25:
            # Already thin, and this makes it noticeably thinner.
            fail("no" if sm.emergency_months < 1 and drop > 0.5 else "not_now")
        else:
            fail("yes_with_caution")

    ok = sm.debt_to_income <= 40
    checks.append(AffordCheck(key="debt", label="EMIs stay ≤ 40% of income", passed=ok,
                              detail=f"Debt-to-income goes from {bm.debt_to_income}% to {sm.debt_to_income}%."))
    if not ok:
        fail("no" if sm.debt_to_income > 50 else "not_now")

    fc = sim.scenario_forecast
    ok = not fc.shortfall_months
    checks.append(AffordCheck(key="forecast", label="Balance never goes negative", passed=ok,
                              detail=f"Lowest projected balance: {inr(fc.lowest_balance)} ({fc.lowest_month})."))
    if not ok:
        fail("not_now")

    ok = sm.surplus >= 0
    checks.append(AffordCheck(key="surplus", label="Income still covers monthly costs", passed=ok,
                              detail=f"Monthly surplus after this: {inr(sm.surplus)} (was {inr(bm.surplus)})."))
    if not ok:
        fail("not_now")

    worst_delay = max((d.delay_months for d in sim.goal_delays if d.delay_months is not None), default=0)
    unreachable = [d.label for d in sim.goal_delays if d.delay_months is None]
    ok = worst_delay <= 3 and not unreachable
    detail = (f"'{unreachable[0]}' becomes unreachable at the current pace." if unreachable
              else f"Largest goal delay: {duration(worst_delay)}." if sim.goal_delays
              else "No goals set.")
    checks.append(AffordCheck(key="goals", label="Goals delayed ≤ 3 months", passed=ok, detail=detail))
    if not ok:
        fail("yes_with_caution")

    return worst, checks, sim


def _passes(verdict: str) -> bool:
    return VERDICT_RANK[verdict] <= VERDICT_RANK["yes_with_caution"]


def _max_comfortable(profile: FinancialProfile, req: AffordRequest) -> float:
    """
    Largest cost that clears every hard check (verdict yes or
    yes_with_caution). Binary search — verdicts only worsen as cost rises.
    """
    base = profile.savings.current_savings + profile.savings.emergency_fund
    income = sum(i.amount for i in profile.income if i.frequency == "monthly")
    hi = max(req.cost * 4, base + income * 24, 1000.0)
    lo = 0.0
    if not _passes(_evaluate(profile, req, 1.0)[0]):
        return 0.0
    for _ in range(25):
        mid = (lo + hi) / 2
        if _passes(_evaluate(profile, req, mid)[0]):
            lo = mid
        else:
            hi = mid
    return math.floor(lo / 500) * 500   # round down to a friendly number


def _subject(item: str) -> str:
    """'phone' → 'this phone'; leaves 'a bike' / 'this purchase' / 'my car' alone."""
    item = item.strip() or "this purchase"
    if item.lower().split(" ")[0] in {"a", "an", "the", "this", "that", "my", "these", "those"}:
        return item
    return f"this {item}"


def can_afford(profile: FinancialProfile, req: AffordRequest) -> AffordabilityResult:
    verdict, checks, sim = _evaluate(profile, req, req.cost)
    max_ok = _max_comfortable(profile, req)
    m = sim.baseline.metrics

    emi = None
    if req.mode == "emi":
        emi = round(amortized_emi(max(0.0, req.cost - req.down_payment), req.interest_rate, req.tenure_months), 2)

    alternatives: list[str] = []
    if verdict != "yes":
        if 0 < max_ok < req.cost:
            alternatives.append(f"A budget of up to {inr(max_ok)} stays within safe limits today.")
        if req.mode == "cash" and verdict in ("not_now", "no"):
            # Save enough that buying still leaves a 3-month emergency cushion.
            needed = req.cost - (m.liquid_savings - 3 * m.monthly_obligations)
            if needed > 0 and m.free_cash > 0:
                months = math.ceil(needed / m.free_cash)
                alternatives.append(f"Save {inr(m.free_cash)}/month for {duration(months)} first, then buy "
                                    f"without touching your 3-month safety net.")
            elif needed > 0:
                alternatives.append("You have no free cash each month yet — free some up (see your Action Plan) "
                                    "before saving for this.")
        elif req.mode == "emi":
            for t in TENURE_OPTIONS:
                if t <= req.tenure_months:
                    continue
                if VERDICT_RANK[_evaluate(profile, req, req.cost, t)[0]] < VERDICT_RANK[verdict]:
                    t_emi = amortized_emi(max(0.0, req.cost - req.down_payment), req.interest_rate, t)
                    alternatives.append(f"A {t}-month tenure ({inr(t_emi)}/month) is safer "
                                        f"— but you'd pay more interest overall.")
                    break
            if m.high_interest_debt > 0:
                alternatives.append("Clear your high-interest debt first; it frees up room for a new EMI.")

    subject = _subject(req.item)
    headline = {
        "yes": f"Yes — {subject} fits comfortably in your finances.",
        "yes_with_caution": f"You can afford {subject}, but it has trade-offs.",
        "not_now": f"Not right now — {subject} would stretch you too thin.",
        "no": f"No — {subject} would put you at real financial risk.",
    }[verdict]

    return AffordabilityResult(
        item=req.item, cost=req.cost, mode=req.mode, verdict=verdict, headline=headline,
        checks=checks, monthly_emi=emi, max_comfortable_amount=max_ok,
        alternatives=alternatives, simulation=sim,
    )
