"""
Conversational Mentor.

The LLM is a *narrator*, not a calculator. Before every reply we run
the deterministic engines and hand the model a compact fact sheet;
the system prompt forbids inventing numbers or giving generic advice.
If the question is "can I afford X?", the affordability engine runs
first and its verdict goes into the fact sheet.

When the LLM is unavailable (no API key, quota, network), `fallback_reply` answers from the same
facts with templates, so the feature degrades instead of breaking.
"""
import re
from collections.abc import AsyncIterator

from app.schemas.finmentor import (
    AffordabilityResult, AffordRequest, FinancialProfile, Forecast, HealthReport, PlannedAction,
)
from app.services.affordability import can_afford
from app.services.completeness_engine import CATEGORY_QUESTIONS
from app.services.finance_math import duration, inr, payoff_months, to_monthly
from app.services.llm.client import LLMUnavailable, stream_chat

HISTORY_TURNS = 4            # recent messages given to the model for follow-ups
HISTORY_CHARS = 400          # long replies are trimmed so the model doesn't copy them

SYSTEM_PROMPT = """You are FinMentor, a friendly personal-finance mentor for one specific user in India.

Rules:
- Answer only what was asked. Don't open with the health score unless the question is about it.
- "Health score" means FINANCIAL health (money), never medical health. When asked about it,
  explain it with the WEAKEST AREAS line.
- Use ONLY the facts in the FINANCIAL FACTS block. Never invent or estimate numbers that aren't there.
- Every answer should cite the user's own numbers (in ₹) to explain *why*.
- The engines already did the maths. Repeat their results; do not recompute or contradict them.
- If a fact needed to answer is missing, say so plainly and ask the one question listed under MISSING DATA.
- Plain language, short paragraphs or bullets, no jargon without a one-line explanation. Aim for under 180 words.
- No generic tips ("make a budget", "invest early") unless tied to a specific number from the facts.
- Do not recommend specific stocks, funds or products. You are not a licensed advisor: only if the
  user asks about tax or legal specifics, tell them to consult a qualified professional.
- If the question isn't about the user's money, gently steer back.
- If an AFFORDABILITY RESULT is present, its verdict has ALREADY been shown to the user and is final.
  Do not restate or change the verdict. Explain the PROBLEMS in plain words, then the SAFER OPTIONS.
  Never describe a problem as passed or fine."""


# ---------- Fact sheet ----------

def build_context(profile: FinancialProfile, report: HealthReport, fc: Forecast,
                  actions: list[PlannedAction], afford: AffordabilityResult | None = None) -> str:
    m = report.metrics
    lines: list[str] = []

    # Models attend best to what comes first, so the
    # affordability result (when there is one) leads the fact sheet.
    if afford:
        failed = [c for c in afford.checks if not c.passed]
        passed = [c for c in afford.checks if c.passed]
        lines.append(f"AFFORDABILITY RESULT for {afford.item} ({inr(afford.cost)}, "
                     f"{'EMI ' + inr(afford.monthly_emi) + '/month' if afford.monthly_emi else 'paid from savings'}) "
                     f"— final, computed by FinMentor's engine, already shown to the user:")
        lines.append(f"VERDICT: {afford.headline}")
        if failed:
            lines.append("PROBLEMS (these checks FAILED):")
            lines += [f"- {c.label}: {c.detail}" for c in failed]
        if passed:
            lines.append("Checks that passed: " + "; ".join(c.label for c in passed))
        if afford.alternatives or afford.max_comfortable_amount:
            lines.append("SAFER OPTIONS:")
            if afford.max_comfortable_amount and afford.max_comfortable_amount < afford.cost:
                lines.append(f"- Safe budget today: {inr(afford.max_comfortable_amount)}")
            lines += [f"- {a}" for a in afford.alternatives]
        lines.append("")

    lines.append("FINANCIAL FACTS (as of " + profile.as_of.strftime("%d %b %Y") + ")")

    who = ", ".join(x for x in [profile.name, f"age {profile.age}" if profile.age else None,
                                profile.occupation,
                                f"{profile.num_dependents} dependent(s)" if profile.num_dependents else None] if x)
    if who:
        lines.append(f"User: {who}")

    lines += [
        f"Financial health score: {round(report.score)}/100 ({report.band})",
        "WEAKEST AREAS (what pulls the score down most): " + "; ".join(
            f"{c.label} {c.value}{' months' if c.key == 'emergency' else '%'} vs target {c.target}"
            for c in sorted(report.components, key=lambda c: c.score)[:3] if c.score < 90),
        "Score breakdown: " + "; ".join(f"{c.label} {c.value} (score {c.score:.0f}, target {c.target})"
                                        for c in report.components),
        f"Monthly income: {inr(m.monthly_income)}"
        + (f" (salary on day {profile.salary_day})" if profile.salary_day else ""),
        f"Monthly expenses: {inr(m.monthly_expenses)} (essential {inr(m.essential_expenses)}, "
        f"non-essential {inr(m.discretionary_expenses)} = {m.discretionary_share}% of income)",
        f"Monthly EMIs: {inr(m.monthly_emi)} (debt-to-income {m.debt_to_income}%)",
        f"Surplus after expenses & EMIs: {inr(m.surplus)}/month (savings rate {m.savings_rate}%)",
        f"Goal contributions: {inr(m.goal_contributions)}/month; free cash after goals: {inr(m.free_cash)}/month",
        f"Liquid savings: {inr(m.liquid_savings)} (bank {inr(profile.savings.current_savings)}, "
        f"emergency fund {inr(profile.savings.emergency_fund)}) = {m.emergency_months} months of essentials+EMIs",
    ]
    if profile.savings.investments:
        lines.append(f"Long-term investments (not counted as liquid): {inr(profile.savings.investments)}")

    if profile.expenses:
        top = sorted(profile.expenses, key=lambda e: to_monthly(e.amount, e.frequency), reverse=True)[:8]
        lines.append("Top expenses: " + "; ".join(
            f"{e.label} {inr(to_monthly(e.amount, e.frequency))}{'' if e.is_essential else ' (want)'}" for e in top))
    for d in profile.debts:
        if d.remaining_months:
            payoff = f"{d.remaining_months} months left"
        else:
            months = payoff_months(d.outstanding, d.interest_rate, d.emi)
            payoff = (f"at this payment it clears in {duration(months)} (interest included)" if months
                      else "at this payment it NEVER clears (payment only covers interest)")
        interest = d.outstanding * d.interest_rate / 1200
        lines.append(f"Debt: {d.label} — {inr(d.outstanding)} outstanding at {d.interest_rate:g}% "
                     f"(≈{inr(interest)}/month interest), payment {inr(d.emi)}/month; {payoff}")
    for g in report.goals:
        pace = f"reaches it {g.projected_date:%b %Y}" if g.projected_date else "never at current pace"
        need = f", needs {inr(g.required_monthly)}/month" if g.required_monthly else ""
        target = f", target {g.target_date:%b %Y}" if g.target_date else ""
        lines.append(f"Goal: {g.label} (priority {g.priority}) {inr(g.current_amount)} of "
                     f"{inr(g.target_amount)}{target}; contributing {inr(g.effective_contribution)}/month "
                     f"→ {pace}{need}; {'on track' if g.on_track else 'OFF TRACK'}")

    lines.append("Cash-flow forecast (bank balance at month end): " + "; ".join(
        f"{p.label} {inr(p.balance)}{' [' + ', '.join(p.events) + ']' if p.events else ''}"
        f"{' LOW' if p.status == 'low' else ' SHORTFALL' if p.status == 'shortfall' else ''}"
        for p in fc.points))
    lines.append(f"Safety buffer (one month of essentials+EMIs): {inr(fc.safety_buffer)}")
    if fc.milestones:
        lines.append("Milestones: " + "; ".join(fc.milestones))

    if report.risks:
        lines.append("RISKS:")
        lines += [f"- [{r.severity}] {r.title}: {r.detail}" for r in report.risks]
    if actions:
        lines.append("ACTION PLAN:")
        lines += [f"- {a.title}: {a.detail}" for a in actions[:6]]

    missing = missing_questions(profile)
    if missing or profile.hidden_from_ai:
        lines.append("MISSING DATA:")
        lines += [f"- {q}" for q in missing]
        if profile.hidden_from_ai:
            lines.append(f"- The user chose not to share with AI: {', '.join(profile.hidden_from_ai)}")
    return "\n".join(lines)


def missing_questions(profile: FinancialProfile) -> list[str]:
    missing = []
    if not profile.income:
        missing.append(CATEGORY_QUESTIONS["income"])
    if not profile.expenses:
        missing.append(CATEGORY_QUESTIONS["expense"])
    if not profile.savings.current_savings and not profile.savings.emergency_fund:
        missing.append(CATEGORY_QUESTIONS["savings"])
    return missing


# ---------- Intent: "can I afford ...?" ----------

_AFFORD_RE = re.compile(r"\b(afford|buy|purchase|get|spend|loan|emi|finance)\b", re.I)
_AMOUNT_RE = re.compile(r"(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lakhs|lac|l|cr|crore)?\b", re.I)
_TENURE_RE = re.compile(r"(\d+)\s*(months?|mo|years?|yrs?)\b", re.I)
_ITEM_RE = re.compile(r"\b(?:afford|buy|purchase|get)\s+(?:(?:a|an|the|this|that|new|my)\s+)*"
                      r"([a-z][a-z \-']{1,30}?)(?=\s+(?:for|worth|costing|at|of|on|with)\b|\s*(?:₹|rs|inr|\d)|\?|$)",
                      re.I)
_MULTIPLIERS = {"k": 1e3, "thousand": 1e3, "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "l": 1e5,
                "cr": 1e7, "crore": 1e7}


def detect_affordability(message: str) -> AffordRequest | None:
    if not _AFFORD_RE.search(message):
        return None
    text = _TENURE_RE.sub(" ", message)   # so "24 months" isn't read as ₹24
    amounts = []
    for num, unit in _AMOUNT_RE.findall(text):
        value = float(num.replace(",", "")) * _MULTIPLIERS.get(unit.lower(), 1)
        if value >= 500:
            amounts.append(value)
    if not amounts:
        return None

    emi = bool(re.search(r"\b(emi|loan|finance|installments?|instalments?)\b", message, re.I))
    tenure = 12
    t = _TENURE_RE.search(message)
    if t:
        n = int(t.group(1))
        tenure = n * 12 if t.group(2).lower().startswith("y") else n
    item = _extract_item(message)
    return AffordRequest(item=item, cost=max(amounts), mode="emi" if emi else "cash",
                         tenure_months=max(1, min(tenure, 360)))


_ITEM_AFTER_AMOUNT_RE = re.compile(
    r"\d[\d,.]*\s*(?:k|thousand|lakhs?|lac|l|cr|crore)?\s+([a-z][a-z \-']{1,30}?)"
    r"(?=\s+(?:for|on|with|in|now|today|this|next)\b|\?|\.|,|$)", re.I)
_NOT_ITEMS = {"a", "an", "the", "this", "that", "it", "one", "rupees", "rs", "inr", "emi", "loan", "on emi"}


def _extract_item(message: str) -> str:
    """'afford a new phone for ₹60k' → 'phone'; 'afford a ₹60,000 phone' → 'phone'."""
    for rx in (_ITEM_RE, _ITEM_AFTER_AMOUNT_RE):
        for m in rx.finditer(message):
            item = re.sub(r"^(?:new|a|an|the)\s+", "", m.group(1).strip(), flags=re.I)
            if (len(item) >= 3 and item.lower() not in _NOT_ITEMS
                    and not re.search(r"\b(?:to|ok|okay|fine|enough|worth|much)\b", item, re.I)):
                return item
    return "this purchase"


def run_affordability(profile: FinancialProfile, message: str) -> AffordabilityResult | None:
    req = detect_affordability(message)
    if req is None or not profile.income:
        return None
    return can_afford(profile, req)


# ---------- Replies ----------

def build_messages(context: str, history: list[dict], message: str) -> list[dict]:
    msgs = [{"role": "system", "content": SYSTEM_PROMPT + "\n\n" + context}]
    for h in history[-HISTORY_TURNS:]:
        content = h["content"]
        if len(content) > HISTORY_CHARS:
            content = content[:HISTORY_CHARS] + " …"
        msgs.append({"role": h["role"], "content": content})
    # Small models tend to keep answering the previous question; pin this one.
    msgs.append({"role": "user",
                 "content": f"{message}\n\n(Answer only this latest question, using the FINANCIAL FACTS.)"})
    return msgs


async def reply_stream(context: str, history: list[dict], message: str, report: HealthReport,
                       actions: list[PlannedAction],
                       afford: AffordabilityResult | None) -> AsyncIterator[str]:
    """
    Streams the LLM reply; falls back to a templated answer if the LLM is unavailable.

    "Can I afford X?" is answered deterministically from the engine's own
    sentences, without the LLM. In testing, a small model reversed
    the verdict and invented EMI figures — unacceptable for a money
    decision. Open-ended questions ("why?", "what next?") go to the model.
    """
    if afford:
        yield f"**{afford.headline}**\n\n" + fallback_reply(report, actions, afford)
        return
    produced = False
    try:
        async for chunk in stream_chat(build_messages(context, history, message)):
            produced = True
            yield chunk
    except LLMUnavailable as e:
        if produced:
            yield "\n\n_(The AI service stopped responding mid-answer.)_"
        else:
            yield fallback_reply(report, actions, afford)
            yield f"\n\n_AI explanations unavailable: {e}_"


def _lower_first(text: str) -> str:
    """'Enough cash' → 'enough cash', but leave acronyms like 'EMIs' alone."""
    return text if text[1:2].isupper() else text[:1].lower() + text[1:]


def fallback_reply(report: HealthReport, actions: list[PlannedAction],
                   afford: AffordabilityResult | None) -> str:
    m = report.metrics
    if afford:
        # The headline is streamed separately by reply_stream.
        failed = [c for c in afford.checks if not c.passed]
        passed = [c for c in afford.checks if c.passed]
        parts = []
        if afford.monthly_emi:
            parts.append(f"The EMI would be {inr(afford.monthly_emi)}/month.")
        if failed:
            parts += ["Why:"] + [f"- ⚠️ {c.label}: {c.detail}" for c in failed]
        if passed:
            parts += ["", "What's fine: " + "; ".join(_lower_first(c.label) for c in passed) + "."]
        if afford.alternatives:
            parts += ["", "What would work instead:"] + [f"- {a}" for a in afford.alternatives]
        parts += ["", "_Try other amounts or an EMI plan on the What-if page._"]
        return "\n".join(parts)

    parts = [
        f"Your financial health score is **{round(report.score)}/100 ({report.band})**.",
        f"You earn {inr(m.monthly_income)} a month, spend {inr(m.monthly_expenses)} and pay "
        f"{inr(m.monthly_emi)} in EMIs, leaving {inr(m.surplus)} ({m.savings_rate}% savings rate). "
        f"Your liquid savings cover {m.emergency_months} months of essentials.",
    ]
    if report.risks:
        parts += ["", "The main things to watch:"] + [f"- {r.title}: {r.detail}" for r in report.risks[:3]]
    if actions:
        parts += ["", "Start here:"] + [f"- {a.title}" for a in actions[:3]]
    return "\n".join(parts)
