import { describe, it, expect } from "vitest";
import { simulateLoan, simulateIncomeLoss } from "../simulation.js";
import type { FinancialProfile } from "../types.js";

const baseProfile: FinancialProfile = {
  income: [{ label: "Salary", amount: 35000, frequency: "monthly" }],
  expenses: [{ label: "Rent", category: "housing", amount: 10000, isRecurring: true }],
  loans: [{ label: "Existing EMI", principal: 50000, emiAmount: 3000, interestRate: 10, remainingMonths: 10 }],
  savings: [{ label: "Savings", balance: 30000, type: "general" }],
};

describe("simulateLoan", () => {
  it("computes a standard EMI close to the spec's example (~4,700 for a 1L loan)", () => {
    // Roughly matches a 1,00,000 loan at a common ~2yr consumer-loan rate.
    const result = simulateLoan(baseProfile, 100000, 14, 24);
    expect(result.estimatedEmi).toBeGreaterThan(4500);
    expect(result.estimatedEmi).toBeLessThan(5000);
  });

  it("increases debt-to-income ratio and risk after taking the loan", () => {
    const result = simulateLoan(baseProfile, 100000, 14, 24);
    expect(result.healthAfter.debtToIncomeRatio).toBeGreaterThan(result.healthBefore.debtToIncomeRatio);
  });
});

describe("simulateIncomeLoss", () => {
  it("flags unsustainable runway when savings can't cover the requested months", () => {
    const result = simulateIncomeLoss(baseProfile, 6);
    // essential outflow = 10000 rent + 3000 EMI = 13000/mo; savings 30000 → ~2.3 months runway
    expect(result.runwayMonths).toBeCloseTo(30000 / 13000, 5);
    expect(result.sustainable).toBe(false);
  });
});
