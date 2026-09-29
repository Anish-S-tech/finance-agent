"""
Context Completeness Engine (Module 6)

Deliberately NOT AI. This is plain rule-based logic that maps a
"query context" (what the user is trying to figure out) to the
financial categories required to answer it, checks what the user
already has on file, and surfaces the single next missing question.

Later phases (agentic reasoning) will call this BEFORE invoking any
LLM agent, so agents never have to guess what data is missing —
they either have it, or the engine has already asked for it.
"""
from supabase import Client

# Query context -> required financial_items.item_category values
QUERY_REQUIREMENTS: dict[str, list[str]] = {
    "afford_surgery": ["income", "savings", "insurance", "expense", "debt"],
    "take_loan": ["income", "expense", "debt"],
    "pay_rent": ["income", "expense"],
    "postpone_emi": ["income", "debt"],
    "general_health_check": ["income", "savings", "expense"],
}

# One human-friendly follow-up question per category, asked only if missing.
CATEGORY_QUESTIONS: dict[str, str] = {
    "income": "Roughly how much do you receive each month?",
    "savings": "About how much do you currently have in savings?",
    "insurance": "Do you currently have health insurance?",
    "expense": "What are your regular monthly expenses like rent or bills?",
    "debt": "Do you have any ongoing loans or EMIs?",
    "dependents": "Does anyone rely on your income?",
}


# FinMentor's structured tables also satisfy a category.
STRUCTURED_TABLES: dict[str, str] = {
    "income_sources": "income",
    "expenses": "expense",
    "debts": "debt",
}


def present_categories_for(client: Client, user_id: str) -> set[str]:
    resp = (
        client.table("financial_items")
        .select("item_category")
        .eq("user_id", user_id)
        .execute()
    )
    present = {row["item_category"] for row in (resp.data or [])}
    for table, category in STRUCTURED_TABLES.items():
        if category in present:
            continue
        rows = client.table(table).select("id").eq("user_id", user_id).limit(1).execute()
        if rows.data:
            present.add(category)
    return present


def check_completeness(client: Client, user_id: str, query_context: str) -> dict:
    required = QUERY_REQUIREMENTS.get(query_context, [])

    present_categories = present_categories_for(client, user_id)

    satisfied = [c for c in required if c in present_categories]
    missing = [c for c in required if c not in present_categories]

    overall_percent = round((len(satisfied) / len(required)) * 100, 1) if required else 100.0
    next_question = CATEGORY_QUESTIONS.get(missing[0]) if missing else None

    return {
        "query_context": query_context,
        "required_categories": required,
        "satisfied_categories": satisfied,
        "missing_categories": missing,
        "overall_percent": overall_percent,
        "next_question": next_question,
    }


def calculate_overall_profile_completeness(client: Client, user_id: str) -> dict:
    """
    Used by the dashboard's 'Profile Completeness' card — checks
    across ALL core categories, not tied to a specific question.
    """
    core_categories = ["income", "savings", "expense", "debt", "insurance", "dependents"]
    present = present_categories_for(client, user_id)

    flags = {f"{cat}_complete": cat in present for cat in core_categories}
    percent = round((len(present & set(core_categories)) / len(core_categories)) * 100, 1)

    return {**flags, "overall_percent": percent}
