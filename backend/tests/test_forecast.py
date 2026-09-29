from datetime import date

from app.schemas.finmentor import CashFlow, Debt, UpcomingPayment
from app.services.forecast import forecast


def test_starts_next_month_and_folds_in_calendar_events(persona):
    fc = forecast(persona, 6)
    assert fc.points[0].label == "Oct 2026"
    assert fc.starting_balance == 60000
    # Oct: ₹3,400 free cash − ₹8,000 laptop − ₹10,000 gift
    assert fc.points[0].net == -14600
    assert fc.points[1].net == 3400 - 14000     # Nov: car insurance


def test_emi_stops_after_remaining_months(healthy):
    p = healthy.model_copy(update={"debts": [Debt(label="Short loan", outstanding=20000, emi=10000,
                                                  remaining_months=2)]}, deep=True)
    fc = forecast(p, 4)
    assert fc.points[1].outflow - fc.points[2].outflow == 10000
    assert any("Short loan: last EMI" in m for m in fc.milestones)


def test_shortfall_is_detected(stressed):
    # ₹10,000 start, −₹5,000/month → ₹5,000, ₹0, −₹5,000
    fc = forecast(stressed, 3)
    assert [p.balance for p in fc.points] == [5000, 0, -5000]
    assert fc.shortfall_months == ["Dec 2026"]
    assert fc.points[0].status == "low"


def test_goal_contributions_stop_when_reached(healthy):
    p = healthy.model_copy(deep=True)
    p.goals[0].current_amount = 490000          # ₹10k left, contributes ₹15k/month
    fc = forecast(p, 3)
    assert fc.points[0].outflow - fc.points[1].outflow == 10000
    assert any("House: target reached" in m for m in fc.milestones)


def test_recurring_calendar_entries_are_not_double_counted(healthy):
    p = healthy.model_copy(update={"upcoming": [
        UpcomingPayment(label="Rent", event_type="rent", amount=25000, due_date=date(2026, 10, 5),
                        is_recurring=True),
    ]})
    assert forecast(p, 1).points[0].outflow == forecast(healthy, 1).points[0].outflow


def test_temporary_flow(healthy):
    p = healthy.model_copy(update={"extra_flows": [
        CashFlow(label="Job loss", amount=-100000, kind="income", start_month=1, months=2)]})
    fc = forecast(p, 4)
    base = forecast(healthy, 4)
    assert [round(a.net - b.net) for a, b in zip(fc.points, base.points)] == [0, -100000, -100000, 0]
