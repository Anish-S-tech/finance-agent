import { describe, it, expect } from "vitest";
import { projectCashFlow } from "../forecast.js";
import type { FinancialProfile } from "../types.js";

describe("projectCashFlow", () => {
  it("matches the spec's worked example: 18,000 balance vs 19,300 due on day 8 → shortage", () => {
    const startDate = new Date(2026, 7, 1); // Aug 1, 2026 (month is 0-indexed)

    const profile: FinancialProfile = {
      income: [],
      expenses: [
        { label: "Electricity", category: "utilities", amount: 1500, isRecurring: true, dueDay: 8 },
        { label: "Internet", category: "utilities", amount: 800, isRecurring: true, dueDay: 8 },
      ],
      loans: [
        {
          label: "EMI",
          principal: 84000,
          emiAmount: 7000,
          interestRate: 12,
          remainingMonths: 12,
          dueDay: 8,
        },
      ],
      savings: [],
    };
    // Rent (10,000) also due on day 8 alongside the loan/utilities, per the spec's grouped total of 19,300.
    profile.expenses.push({ label: "Rent", category: "housing", amount: 10000, isRecurring: true, dueDay: 8 });

    const result = projectCashFlow(profile, 18000, 30, startDate);

    expect(result.totalUpcomingFixedExpenses).toBeCloseTo(19300, 5);
    expect(result.shortageDate).toBe("2026-08-08");
    expect(result.shortfallAmount).toBeCloseTo(1300, 5);
  });

  it("reports no shortage when balance comfortably covers all due items", () => {
    const profile: FinancialProfile = {
      income: [],
      expenses: [{ label: "Rent", category: "housing", amount: 5000, isRecurring: true, dueDay: 5 }],
      loans: [],
      savings: [],
    };
    const result = projectCashFlow(profile, 50000, 30, new Date(2026, 7, 1));
    expect(result.shortageDate).toBeNull();
    expect(result.shortfallAmount).toBeNull();
  });
});
