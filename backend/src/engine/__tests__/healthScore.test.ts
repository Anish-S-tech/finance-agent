import { describe, it, expect } from "vitest";
import { calculateHealthScore } from "../healthScore.js";
import type { FinancialProfile } from "../types.js";

const specExampleProfile: FinancialProfile = {
  income: [{ label: "Salary", amount: 35000, frequency: "monthly" }],
  expenses: [
    { label: "Rent", category: "housing", amount: 10000, isRecurring: true },
    { label: "Food", category: "food", amount: 5000, isRecurring: true },
    { label: "Transport", category: "transport", amount: 2500, isRecurring: true },
    { label: "Subscriptions", category: "subscription", amount: 1000, isRecurring: true },
  ],
  loans: [
    {
      label: "EMI",
      principal: 84000,
      emiAmount: 7000,
      interestRate: 12,
      remainingMonths: 12,
    },
  ],
  savings: [{ label: "Savings", balance: 20000, type: "general" }],
};

describe("calculateHealthScore", () => {
  it("matches the spec's worked example: ~9,500 disposable income, low emergency coverage", () => {
    const result = calculateHealthScore(specExampleProfile);

    expect(result.disposableIncome).toBeCloseTo(9500, 5);
    // 18500 recurring expenses + 7000 EMI = 25500 total outflow
    expect(result.monthlyRecurringExpenses).toBeCloseTo(18500, 5);
    expect(result.monthlyEmiTotal).toBeCloseTo(7000, 5);
    // 20000 / 25500 ≈ 0.78 months — well under the 1-month minimum, i.e. "relatively low"
    expect(result.emergencyMonthsCoverage).toBeCloseTo(20000 / 25500, 5);
    expect(result.emergencyMonthsCoverage).toBeLessThan(1);
    expect(result.category).toBe("moderate");
  });

  it("reports 'poor' when expenses exceed income", () => {
    const profile: FinancialProfile = {
      income: [{ label: "Salary", amount: 10000, frequency: "monthly" }],
      expenses: [{ label: "Rent", category: "housing", amount: 12000, isRecurring: true }],
      loans: [],
      savings: [{ label: "Savings", balance: 0, type: "general" }],
    };
    const result = calculateHealthScore(profile);
    expect(result.disposableIncome).toBeLessThan(0);
    expect(result.category).toBe("poor");
  });

  it("reports 'good' for a well-cushioned profile", () => {
    const profile: FinancialProfile = {
      income: [{ label: "Salary", amount: 50000, frequency: "monthly" }],
      expenses: [{ label: "Rent", category: "housing", amount: 10000, isRecurring: true }],
      loans: [],
      savings: [{ label: "Emergency fund", balance: 100000, type: "emergency" }],
    };
    const result = calculateHealthScore(profile);
    expect(result.category).toBe("good");
  });
});
