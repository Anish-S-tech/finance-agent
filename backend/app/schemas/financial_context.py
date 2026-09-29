from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

ItemCategory = Literal["income", "expense", "debt", "insurance", "savings", "dependents"]
SourceType = Literal["user", "document", "inferred", "ai"]


class FinancialItemIn(BaseModel):
    """What the client sends when creating/updating a financial fact."""
    item_key: str                      # e.g. 'monthly_income', 'health_insurance'
    item_category: ItemCategory
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    value_boolean: Optional[bool] = None
    source: SourceType = "user"
    ai_allowed: bool = True


class FinancialItemOut(BaseModel):
    id: str
    item_key: str
    item_category: str
    value_numeric: Optional[float]
    value_text: Optional[str]
    value_boolean: Optional[bool]
    source: str
    confidence: float
    verified: bool
    ai_allowed: bool
    last_updated: datetime

    class Config:
        from_attributes = True


class CompletenessCheck(BaseModel):
    """Response from the Context Completeness Engine (Module 6)."""
    query_context: str                 # e.g. "afford_surgery", "take_loan"
    required_categories: list[str]
    satisfied_categories: list[str]
    missing_categories: list[str]
    overall_percent: float
    next_question: Optional[str] = None    # the single next thing to ask, if anything is missing
