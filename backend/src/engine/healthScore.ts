import type { FinancialProfile } from "./types.js";

export interface HealthScoreResult {
  monthlyIncome: number;
  monthlyRecurringExpenses: number;
  monthlyEmiTotal: number;
  disposableIncome: number;
  emergencySavings: number;
  emergencyMonthsCoverage: number;
  expenseRatio: number; // (expenses+EMI) / income
  debtToIncomeRatio: number; // EMI / income
  score: number; // 0-100
  category: "poor" | "moderate" | "good";
}

function normalizeIncomeToMonthly(amount: number, frequency: string): number {
  if (frequency === "weekly") return (amount * 52) / 12;
  if (frequency === "one-time") return 0; // excluded from recurring monthly baseline
  return amount;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateHealthScore(profile: FinancialProfile): HealthScoreResult {
  const monthlyIncome = profile.income.reduce(
    (sum, i) => sum + normalizeIncomeToMonthly(i.amount, i.frequency),
    0
  );

  const monthlyRecurringExpenses = profile.expenses
    .filter((e) => e.isRecurring)
    .reduce((sum, e) => sum + e.amount, 0);

  const monthlyEmiTotal = profile.loans.reduce((sum, l) => sum + l.emiAmount, 0);

  const disposableIncome = monthlyIncome - monthlyRecurringExpenses - monthlyEmiTotal;

  const emergencyPool = profile.savings.filter((s) => s.type === "emergency");
  const emergencySavings = (emergencyPool.length > 0 ? emergencyPool : profile.savings).reduce(
    (sum, s) => sum + s.balance,
    0
  );

  const totalMonthlyOutflow = monthlyRecurringExpenses + monthlyEmiTotal;
  const emergencyMonthsCoverage =
    totalMonthlyOutflow > 0 ? emergencySavings / totalMonthlyOutflow : emergencySavings > 0 ? 12 : 0;

  const expenseRatio = monthlyIncome > 0 ? totalMonthlyOutflow / monthlyIncome : 1;
  const debtToIncomeRatio = monthlyIncome > 0 ? monthlyEmiTotal / monthlyIncome : 0;

  // Sub-scores, each 0-100, weighted into a composite.
  const savingsScore = clamp((emergencyMonthsCoverage / 3) * 100, 0, 100); // 3 months = full marks
  const expenseScore = clamp(100 - Math.max(0, expenseRatio - 0.5) * 200, 0, 100); // ratio <=0.5 is ideal
  const dtiScore = clamp(100 - (debtToIncomeRatio - 0.1) * 250, 0, 100); // dti <=0.1 ideal, 0.5+ -> 0

  let score = Math.round(savingsScore * 0.25 + expenseScore * 0.45 + dtiScore * 0.3);

  // A cash-flow deficit is unambiguously poor, regardless of how the weighted score lands.
  if (disposableIncome < 0) score = Math.min(score, 39);

  const category: HealthScoreResult["category"] = score >= 70 ? "good" : score >= 40 ? "moderate" : "poor";

  return {
    monthlyIncome,
    monthlyRecurringExpenses,
    monthlyEmiTotal,
    disposableIncome,
    emergencySavings,
    emergencyMonthsCoverage,
    expenseRatio,
    debtToIncomeRatio,
    score,
    category,
  };
}
