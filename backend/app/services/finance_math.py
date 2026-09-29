"""
Small, dependency-free finance helpers shared by the FinMentor engines.
"""
import math
from datetime import date


def to_monthly(amount: float, frequency: str) -> float:
    """Normalise a recurring amount to a monthly figure. One-off amounts return 0."""
    if frequency == "monthly":
        return amount
    if frequency == "yearly":
        return amount / 12
    return 0.0


def amortized_emi(principal: float, annual_rate_pct: float, months: int) -> float:
    """Standard reducing-balance EMI: P·r·(1+r)^n / ((1+r)^n − 1)."""
    if principal <= 0 or months <= 0:
        return 0.0
    r = annual_rate_pct / 1200
    if r == 0:
        return principal / months
    factor = (1 + r) ** months
    return principal * r * factor / (factor - 1)


def payoff_months(balance: float, annual_rate_pct: float, payment: float) -> int | None:
    """Months to clear a balance at a fixed monthly payment; None if it never clears."""
    if balance <= 0:
        return 0
    r = annual_rate_pct / 1200
    if payment <= balance * r:
        return None
    if r == 0:
        return math.ceil(balance / payment)
    return math.ceil(-math.log(1 - r * balance / payment) / math.log(1 + r))


def add_months(d: date, months: int) -> date:
    """Shift a date by whole months, clamping the day to the target month's length."""
    y, m = divmod(d.month - 1 + months, 12)
    year, month = d.year + y, m + 1
    days_in_month = [31, 29 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 28,
                     31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return date(year, month, min(d.day, days_in_month))


def months_between(start: date, end: date) -> int:
    """Whole months from start to end (0 if end is in the same month or earlier)."""
    return max(0, (end.year - start.year) * 12 + (end.month - start.month))


def month_index(as_of: date, d: date) -> int:
    """0 for as_of's month, 1 for the next, ... (negative for the past)."""
    return (d.year - as_of.year) * 12 + (d.month - as_of.month)


def inr(amount: float) -> str:
    """Format as Indian rupees with lakh/crore grouping: ₹1,23,456."""
    neg = amount < 0
    n = str(int(round(abs(amount))))
    if len(n) > 3:
        head, tail = n[:-3], n[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        n = ",".join(groups + [tail])
    return f"{'-' if neg else ''}₹{n}"


def duration(months: int) -> str:
    """'5 months', '2 years', '3 years 4 months'."""
    if months < 24:
        return f"{months} month{'s' if months != 1 else ''}"
    years, rest = divmod(months, 12)
    return f"{years} years" + (f" {rest} month{'s' if rest != 1 else ''}" if rest else "")


def clamp_score(value: float, best: float, worst: float) -> float:
    """Linear 0–100 score: `best` or better → 100, `worst` or worse → 0. Works in either direction."""
    if best == worst:
        return 100.0
    t = (value - worst) / (best - worst)
    return round(max(0.0, min(1.0, t)) * 100, 1)
