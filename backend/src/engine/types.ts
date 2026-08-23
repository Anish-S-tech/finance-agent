export interface IncomeInput {
  label: string;
  amount: number;
  frequency: "monthly" | "weekly" | "one-time";
}

export interface ExpenseInput {
  label: string;
  category: string;
  amount: number;
  isRecurring: boolean;
  dueDay?: number | null;
}

export interface LoanInput {
  label: string;
  principal: number;
  emiAmount: number;
  interestRate: number;
  remainingMonths: number;
  dueDay?: number | null;
}

export interface SavingsInput {
  label: string;
  balance: number;
  type: "emergency" | "general";
}

export interface FinancialProfile {
  income: IncomeInput[];
  expenses: ExpenseInput[];
  loans: LoanInput[];
  savings: SavingsInput[];
}

/**
 * "Available balance" (spendable today) is the general-purpose savings pool, falling back to
 * all savings if the user hasn't split general vs emergency — mirrors the emergency-fund fallback
 * in healthScore.ts so the two figures stay consistent when only one savings entry exists.
 */
export function getAvailableBalance(profile: FinancialProfile): number {
  const generalPool = profile.savings.filter((s) => s.type === "general");
  return (generalPool.length > 0 ? generalPool : profile.savings).reduce((sum, s) => sum + s.balance, 0);
}
