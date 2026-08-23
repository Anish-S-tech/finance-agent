import type { FinancialProfile } from "./types.js";
import { calculateHealthScore } from "./healthScore.js";
import { detectExpenseLeaks } from "./leakDetection.js";

export interface ActionItem {
  priority: number; // 1 = most urgent
  title: string;
  description: string;
  category: "deficit" | "emergency-fund" | "debt" | "spending" | "on-track";
}

export interface ActionPlanResult {
  healthScore: number;
  healthCategory: "poor" | "moderate" | "good";
  actions: ActionItem[];
}

export function generateActionPlan(profile: FinancialProfile): ActionPlanResult {
  const health = calculateHealthScore(profile);
  const leaks = detectExpenseLeaks(profile);
  const actions: ActionItem[] = [];

  if (health.disposableIncome < 0) {
    actions.push({
      priority: 1,
      title: "Your expenses exceed your income",
      description: `Your fixed monthly outflow is ${(health.monthlyRecurringExpenses + health.monthlyEmiTotal).toFixed(
        0
      )} against income of ${health.monthlyIncome.toFixed(0)}. Reducing recurring expenses is the most urgent step.`,
      category: "deficit",
    });
  }

  if (health.emergencyMonthsCoverage < 1) {
    actions.push({
      priority: actions.length + 1,
      title: "Build your emergency fund",
      description: `Your savings currently cover about ${health.emergencyMonthsCoverage.toFixed(
        1
      )} month(s) of essential expenses. Aim for at least 1 month, ideally 3-6.`,
      category: "emergency-fund",
    });
  }

  if (health.debtToIncomeRatio > 0.4) {
    actions.push({
      priority: actions.length + 1,
      title: "Reduce debt obligations",
      description: `Your EMI payments take up ${(health.debtToIncomeRatio * 100).toFixed(
        0
      )}% of your income, above the recommended 40% ceiling. Consider prioritizing your highest-interest loan.`,
      category: "debt",
    });
  }

  if (leaks.items.length > 0) {
    actions.push({
      priority: actions.length + 1,
      title: "Review recurring subscriptions",
      description: `You're spending ${leaks.monthlyTotal.toFixed(0)}/month (${leaks.annualProjection.toFixed(
        0
      )}/year) on ${leaks.items.length} subscription(s). Review which ones you still use.`,
      category: "spending",
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: 1,
      title: "You're on track",
      description: "Your income, expenses, debt, and emergency fund are all within healthy ranges. Keep it up.",
      category: "on-track",
    });
  }

  return {
    healthScore: health.score,
    healthCategory: health.category,
    actions,
  };
}
