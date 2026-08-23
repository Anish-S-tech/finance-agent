import { prisma } from "./client.js";
import type { FinancialProfile } from "../engine/types.js";

export async function loadFinancialProfile(userId: string): Promise<FinancialProfile> {
  const [income, expenses, loans, savings] = await Promise.all([
    prisma.incomeSource.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.savingsAccount.findMany({ where: { userId } }),
  ]);

  return {
    income: income.map((i) => ({
      label: i.label,
      amount: i.amount,
      frequency: i.frequency as FinancialProfile["income"][number]["frequency"],
    })),
    expenses: expenses.map((e) => ({
      label: e.label,
      category: e.category,
      amount: e.amount,
      isRecurring: e.isRecurring,
      dueDay: e.dueDay,
    })),
    loans: loans.map((l) => ({
      label: l.label,
      principal: l.principal,
      emiAmount: l.emiAmount,
      interestRate: l.interestRate,
      remainingMonths: l.remainingMonths,
      dueDay: l.dueDay,
    })),
    savings: savings.map((s) => ({
      label: s.label,
      balance: s.balance,
      type: s.type as FinancialProfile["savings"][number]["type"],
    })),
  };
}
