from pydantic import BaseModel, Field
from typing import Optional


class ProfileStepBasic(BaseModel):
    """Onboarding step 1"""
    name: str
    age: int = Field(gt=0, lt=120)
    occupation: str


class ProfileStepIncome(BaseModel):
    """Onboarding step 2"""
    monthly_income: float = Field(gt=0)
    salary_day: int = Field(ge=1, le=31)


class ProfileStepHousehold(BaseModel):
    """Onboarding step 3"""
    num_dependents: int = Field(ge=0)


class ProfileOut(BaseModel):
    id: str
    name: Optional[str]
    age: Optional[int]
    occupation: Optional[str]
    monthly_income: Optional[float]
    salary_day: Optional[int]
    num_dependents: Optional[int]
    onboarding_step: int
    onboarding_completed: bool

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    occupation: Optional[str] = None
    monthly_income: Optional[float] = None
    salary_day: Optional[int] = None
    num_dependents: Optional[int] = None
