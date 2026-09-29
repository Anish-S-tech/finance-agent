"""
FinMentor schemas.

Two groups:
- Table In/Out models for the structured profile (income, expenses,
  debts, goals) plus planner / mentor / simulation rows.
- The engine models: FinancialProfile (the single aggregate every
  engine consumes) and the reports the engines produce.
"""
from datetime import date, datetime
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field

Frequency = Literal["monthly", "yearly", "one_time"]
ExpenseCategory = Literal[
    "housing", "food", "transport", "utilities", "shopping",
    "entertainment", "health", "education", "other",
]
DebtType = Literal["home", "car", "personal", "education", "credit_card", "other"]
ActionStatus = Literal["todo", "doing", "done", "dismissed"]
FocusArea = Literal["spend", "save", "debt", "goals", "cashflow", "profile"]
Severity = Literal["high", "medium", "low"]


# ============================================================
# Structured profile rows
# ============================================================
class IncomeSourceIn(BaseModel):
    label: str
    amount: float = Field(ge=0)
    frequency: Frequency = "monthly"
    pay_day: Optional[int] = Field(default=None, ge=1, le=31)
    is_primary: bool = False


class IncomeSource(IncomeSourceIn):
    id: Optional[str] = None


class ExpenseIn(BaseModel):
    label: str
    category: ExpenseCategory = "other"
    amount: float = Field(ge=0)
    frequency: Frequency = "monthly"
    is_essential: bool = True


class Expense(ExpenseIn):
    id: Optional[str] = None


class DebtIn(BaseModel):
    label: str
    debt_type: DebtType = "other"
    outstanding: float = Field(ge=0)
    interest_rate: float = Field(default=0, ge=0, le=100)   # annual %
    emi: float = Field(default=0, ge=0)
    emi_day: Optional[int] = Field(default=None, ge=1, le=31)
    remaining_months: Optional[int] = Field(default=None, ge=0)  # None = revolving
    credit_limit: Optional[float] = Field(default=None, ge=0)


class Debt(DebtIn):
    id: Optional[str] = None


class GoalIn(BaseModel):
    label: str
    target_amount: float = Field(gt=0)
    current_amount: float = Field(default=0, ge=0)
    target_date: Optional[date] = None
    priority: int = Field(default=2, ge=1, le=3)
    monthly_contribution: float = Field(default=0, ge=0)


class Goal(GoalIn):
    id: Optional[str] = None


class SavingsIn(BaseModel):
    current_savings: Optional[float] = Field(default=None, ge=0)    # bank / cash balance
    emergency_fund: Optional[float] = Field(default=None, ge=0)     # set-aside reserve
    investments: Optional[float] = Field(default=None, ge=0)        # not counted as liquid
    health_insurance_cover: Optional[float] = Field(default=None, ge=0)


class Savings(BaseModel):
    current_savings: float = 0
    emergency_fund: float = 0
    investments: float = 0
    health_insurance_cover: Optional[float] = None


class UpcomingPayment(BaseModel):
    id: Optional[str] = None
    label: str
    event_type: str = "other"
    amount: float = 0
    due_date: date
    is_recurring: bool = False


# ============================================================
# Engine models
# ============================================================
class CashFlow(BaseModel):
    """
    A scenario-driven cash movement the simulator adds on top of the
    base profile. Signed: positive = money in, negative = money out.
    months=None means ongoing from start_month; months=1 is one-off.
    """
    label: str
    amount: float
    kind: Literal["income", "expense", "savings", "one_time"]
    essential: bool = False
    start_month: int = 0
    months: Optional[int] = None


class FinancialProfile(BaseModel):
    as_of: date
    name: Optional[str] = None
    age: Optional[int] = None
    occupation: Optional[str] = None
    num_dependents: int = 0
    salary_day: Optional[int] = None
    income: list[IncomeSource] = []
    expenses: list[Expense] = []
    debts: list[Debt] = []
    goals: list[Goal] = []
    savings: Savings = Savings()
    upcoming: list[UpcomingPayment] = []
    extra_flows: list[CashFlow] = []
    hidden_from_ai: list[str] = []   # fact keys the user excluded from AI use


class Metrics(BaseModel):
    monthly_income: float
    monthly_expenses: float
    essential_expenses: float
    discretionary_expenses: float
    monthly_emi: float
    goal_contributions: float
    surplus: float                  # income - expenses - EMIs
    free_cash: float                # surplus - goal/savings contributions
    savings_rate: float             # surplus / income, %
    debt_to_income: float           # EMIs / income, %
    liquid_savings: float
    monthly_obligations: float      # essential expenses + EMIs
    emergency_months: float
    discretionary_share: float      # discretionary / income, %
    credit_utilisation: Optional[float] = None   # %
    total_debt: float
    high_interest_debt: float


class ScoreComponent(BaseModel):
    key: str
    label: str
    score: float
    weight: float
    value: Optional[float]
    target: str


class GoalStatus(BaseModel):
    label: str
    priority: int
    target_amount: float
    current_amount: float
    progress_pct: float
    target_date: Optional[date]
    months_left: Optional[int]
    required_monthly: Optional[float]
    effective_contribution: float
    projected_months: Optional[int]      # None = never at current pace
    projected_date: Optional[date]
    on_track: bool


class Risk(BaseModel):
    id: str
    severity: Severity
    category: Literal["cashflow", "spending", "debt", "emergency", "goals", "data"]
    title: str
    detail: str
    value: Optional[float] = None


class HealthReport(BaseModel):
    score: float
    band: Literal["Critical", "Weak", "Fair", "Good", "Excellent"]
    metrics: Metrics
    components: list[ScoreComponent]
    goals: list[GoalStatus]
    risks: list[Risk]


class ForecastPoint(BaseModel):
    month: str            # 'YYYY-MM'
    label: str            # 'Oct 2026'
    inflow: float
    outflow: float
    net: float
    balance: float
    events: list[str] = []
    status: Literal["ok", "low", "shortfall"]


class Forecast(BaseModel):
    starting_balance: float
    safety_buffer: float
    points: list[ForecastPoint]
    lowest_balance: float
    lowest_month: str
    shortfall_months: list[str]
    low_months: list[str]
    milestones: list[str]


# ---------- Simulation ----------
class PurchaseChange(BaseModel):
    type: Literal["purchase"] = "purchase"
    label: str = "Purchase"
    amount: float = Field(gt=0)
    mode: Literal["cash", "emi"] = "cash"
    tenure_months: int = Field(default=12, ge=1, le=360)
    interest_rate: float = Field(default=14, ge=0, le=60)
    down_payment: float = Field(default=0, ge=0)
    month: int = Field(default=0, ge=0, le=24)


class LoanChange(BaseModel):
    type: Literal["new_loan"] = "new_loan"
    label: str = "New loan"
    principal: float = Field(gt=0)
    interest_rate: float = Field(default=12, ge=0, le=60)
    tenure_months: int = Field(default=36, ge=1, le=360)
    receive_cash: bool = True


class IncomeChange(BaseModel):
    type: Literal["income_change"] = "income_change"
    label: str = "Income change"
    amount: Optional[float] = None       # monthly delta, signed
    percent: Optional[float] = None      # e.g. -20 for a 20% cut
    start_month: int = Field(default=0, ge=0, le=24)
    months: Optional[int] = Field(default=None, ge=1)


class EmergencyChange(BaseModel):
    type: Literal["emergency"] = "emergency"
    label: str = "Emergency"
    amount: float = Field(default=0, ge=0)
    month: int = Field(default=0, ge=0, le=24)
    income_loss_months: int = Field(default=0, ge=0, le=24)


class SavingsPlanChange(BaseModel):
    type: Literal["savings_plan"] = "savings_plan"
    label: str = "Savings plan"
    monthly_amount: float = Field(gt=0)
    start_month: int = Field(default=0, ge=0, le=24)


class ExpenseChange(BaseModel):
    type: Literal["expense_change"] = "expense_change"
    label: str = "Expense change"
    category: Optional[ExpenseCategory] = None   # None = new/standalone expense
    amount: Optional[float] = None               # monthly delta, signed (+ = spend more)
    percent: Optional[float] = None              # of the category total
    essential: bool = False
    start_month: int = Field(default=0, ge=0, le=24)


ScenarioChange = Annotated[
    Union[PurchaseChange, LoanChange, IncomeChange, EmergencyChange,
          SavingsPlanChange, ExpenseChange],
    Field(discriminator="type"),
]


class SimulateRequest(BaseModel):
    changes: list[ScenarioChange]
    months: int = Field(default=12, ge=3, le=36)


class GoalDelay(BaseModel):
    label: str
    baseline_months: Optional[int]
    scenario_months: Optional[int]
    delay_months: Optional[int]      # None = goal becomes unreachable


class SimulationDelta(BaseModel):
    score: float
    savings_rate: float
    debt_to_income: float
    emergency_months: float
    free_cash: float
    lowest_balance: float
    ending_balance: float
    new_shortfall_months: int


class SimulationResult(BaseModel):
    baseline: HealthReport
    scenario: HealthReport
    baseline_forecast: Forecast
    scenario_forecast: Forecast
    delta: SimulationDelta
    goal_delays: list[GoalDelay]
    new_risks: list[Risk]


class AffordRequest(BaseModel):
    item: str = "Purchase"
    cost: float = Field(gt=0)
    mode: Literal["cash", "emi"] = "cash"
    tenure_months: int = Field(default=12, ge=1, le=360)
    interest_rate: float = Field(default=14, ge=0, le=60)
    down_payment: float = Field(default=0, ge=0)


class AffordCheck(BaseModel):
    key: str
    label: str
    passed: bool
    detail: str


class AffordabilityResult(BaseModel):
    item: str
    cost: float
    mode: str
    verdict: Literal["yes", "yes_with_caution", "not_now", "no"]
    headline: str
    checks: list[AffordCheck]
    monthly_emi: Optional[float] = None
    max_comfortable_amount: float
    alternatives: list[str]
    simulation: SimulationResult


# ---------- Planner ----------
class PlannedAction(BaseModel):
    action_key: str
    focus_area: FocusArea
    title: str
    detail: str
    impact_amount: Optional[float] = None
    priority: int = 2


class ActionItemOut(PlannedAction):
    id: str
    status: ActionStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ActionStatusUpdate(BaseModel):
    status: ActionStatus


# ---------- Overview ----------
class Overview(BaseModel):
    name: Optional[str]
    health: HealthReport
    forecast: Forecast
    top_actions: list[ActionItemOut]
    upcoming: list[UpcomingPayment]
    has_data: bool


# ---------- Saved simulations ----------
class SavedSimulationIn(BaseModel):
    name: str
    scenario: SimulateRequest


class SavedSimulationOut(BaseModel):
    id: str
    name: str
    scenario: dict
    result_summary: Optional[dict] = None
    created_at: datetime


# ---------- Mentor ----------
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class MentorMessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
