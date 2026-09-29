from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime


# ---------- Dashboard ----------
class DashboardOut(BaseModel):
    monthly_income: Optional[float]
    current_savings: Optional[float]
    upcoming_bills_total: Optional[float]
    upcoming_bills_count: int
    profile_completeness_percent: float
    documents_uploaded_count: int
    next_calendar_event: Optional["CalendarEventOut"] = None


# ---------- Calendar ----------
EventType = Literal["rent", "emi", "salary", "insurance_premium", "credit_card_due", "other"]
EventStatus = Literal["upcoming", "paid", "overdue", "skipped"]


class CalendarEventIn(BaseModel):
    event_type: EventType
    label: str
    amount: Optional[float] = None
    due_date: date
    is_recurring: bool = False
    recurrence_interval: Optional[Literal["monthly", "weekly", "yearly"]] = None


class CalendarEventOut(BaseModel):
    id: str
    event_type: str
    label: str
    amount: Optional[float]
    due_date: date
    is_recurring: bool
    status: str

    class Config:
        from_attributes = True


DashboardOut.model_rebuild()


# ---------- Documents ----------
DocumentType = Literal["insurance_policy", "salary_slip", "loan_statement", "medical_estimate", "other"]


class DocumentOut(BaseModel):
    id: str
    document_type: str
    file_name: str
    file_size_bytes: Optional[int]
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ---------- Privacy / Consent ----------
ConsentKey = Literal[
    "store_salary",
    "store_expenses",
    "store_bank_account",
    "ai_recommendations",
    "share_analytics",
    "document_processing",
]


class ConsentUpdate(BaseModel):
    consent_key: ConsentKey
    granted: bool


class ConsentOut(BaseModel):
    consent_key: str
    granted: bool
    granted_at: Optional[datetime]
    revoked_at: Optional[datetime]

    class Config:
        from_attributes = True


class PrivacyExportOut(BaseModel):
    profile: dict
    financial_items: list[dict]
    consents: list[dict]
    documents: list[dict]
    calendar: list[dict]
    income_sources: list[dict] = []
    expenses: list[dict] = []
    debts: list[dict] = []
    goals: list[dict] = []
    action_items: list[dict] = []
    mentor_messages: list[dict] = []
    simulations: list[dict] = []
    exported_at: datetime
