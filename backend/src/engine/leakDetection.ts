import type { FinancialProfile } from "./types.js";

export interface LeakItem {
  label: string;
  amount: number;
}

export interface LeakDetectionResult {
  items: LeakItem[];
  monthlyTotal: number;
  annualProjection: number;
}

const SUBSCRIPTION_CATEGORY = "subscription";

export function detectExpenseLeaks(profile: FinancialProfile): LeakDetectionResult {
  const items = profile.expenses
    .filter((e) => e.isRecurring && e.category.toLowerCase() === SUBSCRIPTION_CATEGORY)
    .map((e) => ({ label: e.label, amount: e.amount }));

  const monthlyTotal = items.reduce((sum, i) => sum + i.amount, 0);

  return {
    items,
    monthlyTotal,
    annualProjection: monthlyTotal * 12,
  };
}
