from datetime import date

import pytest

from app.schemas.finmentor import (
    Debt, Expense, FinancialProfile, Goal, IncomeSource, Savings,
)
from app.services.profile_builder import sample_profile

AS_OF = date(2026, 9, 29)


@pytest.fixture
def persona() -> FinancialProfile:
    """The shipped demo persona, pinned to a fixed date."""
    return sample_profile(AS_OF)


@pytest.fixture
def healthy() -> FinancialProfile:
    """A comfortable household: 30% savings rate, 8 months of cover, no costly debt."""
    return FinancialProfile(
        as_of=AS_OF,
        salary_day=1,
        income=[IncomeSource(label="Salary", amount=100000, is_primary=True)],
        expenses=[
            Expense(label="Rent", category="housing", amount=25000),
            Expense(label="Groceries", category="food", amount=10000),
            Expense(label="Bills", category="utilities", amount=5000),
            Expense(label="Fun", category="entertainment", amount=10000, is_essential=False),
        ],
        debts=[Debt(label="Car loan", debt_type="car", outstanding=200000, interest_rate=9,
                    emi=10000, remaining_months=22)],
        goals=[Goal(label="House", target_amount=500000, current_amount=100000,
                    target_date=date(2029, 9, 1), priority=1, monthly_contribution=15000)],
        savings=Savings(current_savings=150000, emergency_fund=250000),
    )


@pytest.fixture
def stressed() -> FinancialProfile:
    """Spends more than they earn, heavy EMIs, no savings."""
    return FinancialProfile(
        as_of=AS_OF,
        income=[IncomeSource(label="Salary", amount=50000)],
        expenses=[
            Expense(label="Rent", category="housing", amount=18000),
            Expense(label="Shopping", category="shopping", amount=15000, is_essential=False),
        ],
        debts=[Debt(label="Personal loan", debt_type="personal", outstanding=400000, interest_rate=16,
                    emi=22000, remaining_months=24)],
        savings=Savings(current_savings=10000),
    )
