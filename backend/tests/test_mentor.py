import asyncio

import pytest

from app.services import mentor
from app.services.action_planner import build_plan
from app.services.forecast import forecast
from app.services.health_engine import health_report
from app.services.llm.client import LLMUnavailable


def facts(profile, message=""):
    fc = forecast(profile)
    report = health_report(profile, fc)
    plan = build_plan(profile, report, fc)
    afford = mentor.run_affordability(profile, message) if message else None
    return mentor.build_context(profile, report, fc, plan, afford), report, plan, afford


@pytest.mark.parametrize("message,cost,mode,tenure", [
    ("Can I afford a ₹60,000 phone?", 60000, "cash", 12),
    ("can i buy a bike for 1.5 lakh on emi for 24 months", 150000, "emi", 24),
    ("Should I take a 2 lakh loan for 3 years?", 200000, "emi", 36),
    ("Can I afford a 45k laptop", 45000, "cash", 12),
])
def test_detect_affordability(message, cost, mode, tenure):
    req = mentor.detect_affordability(message)
    assert req is not None
    assert req.cost == cost and req.mode == mode and req.tenure_months == tenure


def test_detect_affordability_ignores_other_questions():
    assert mentor.detect_affordability("Why is my score low?") is None
    assert mentor.detect_affordability("How do I get out of debt in 12 months?") is None


@pytest.mark.parametrize("message,item", [
    ("Can I afford a new phone for ₹60,000?", "phone"),
    ("Can I afford a ₹60,000 phone?", "phone"),
    ("can i buy a bike for 1.5 lakh on emi for 24 months", "bike"),
    ("Is 45000 ok to spend?", "this purchase"),
])
def test_item_name_is_extracted(message, item):
    assert mentor.detect_affordability(message).item == item


def test_context_contains_users_numbers(persona):
    ctx, *_ = facts(persona)
    assert "₹95,000" in ctx
    assert "Credit card" in ctx and "42%" in ctx
    assert "it clears in 2 years 11 months (interest included)" in ctx
    assert "Financial health score: 65/100" in ctx
    assert "WEAKEST AREAS" in ctx
    assert "ACTION PLAN:" in ctx


def test_context_leads_with_affordability_verdict_and_problems(persona):
    ctx, *_ = facts(persona, "Can I afford a ₹60,000 phone?")
    assert ctx.startswith("AFFORDABILITY RESULT")
    assert "VERDICT: No —" in ctx
    problems = ctx.split("PROBLEMS (these checks FAILED):")[1].split("Checks that passed")[0]
    assert "Emergency fund stays ≥ 3 months" in problems
    assert "Balance never goes negative" in problems


def test_affordability_answers_never_come_from_the_model(persona, monkeypatch):
    async def contrarian(*_a, **_kw):
        yield "Sure, go ahead!"

    monkeypatch.setattr(mentor, "stream_chat", contrarian)
    ctx, report, plan, afford = facts(persona, "Can I afford a ₹60,000 phone?")

    async def collect():
        return "".join([c async for c in mentor.reply_stream(ctx, [], "q", report, plan, afford)])

    text = asyncio.run(collect())
    assert text.startswith(f"**{afford.headline}**")
    assert afford.headline.startswith("No — this phone")
    assert "Sure, go ahead" not in text
    assert "Emergency fund stays ≥ 3 months" in text.split("What's fine")[0]


def test_hidden_facts_are_flagged(persona):
    p = persona.model_copy(update={"hidden_from_ai": ["investments"]})
    ctx, *_ = facts(p)
    assert "chose not to share with AI: investments" in ctx


def test_falls_back_when_llm_is_unavailable(persona, monkeypatch):
    async def down(*_args, **_kwargs):
        raise LLMUnavailable("No Gemini API key set. Add GEMINI_API_KEY to backend/.env.")
        yield  # makes this an async generator

    monkeypatch.setattr(mentor, "stream_chat", down)
    ctx, report, plan, afford = facts(persona)

    async def collect():
        return "".join([c async for c in mentor.reply_stream(ctx, [], "How am I doing?", report, plan, afford)])

    text = asyncio.run(collect())
    assert "financial health score is **65/100 (Fair)**" in text
    assert "AI explanations unavailable: No Gemini API key set" in text
