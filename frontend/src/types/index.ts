export interface UserProfile {
  id: string;
  name: string;
  email: string;
  isSample: boolean;
}

export interface IncomeSource {
  id: string;
  label: string;
  amount: number;
  frequency: "monthly" | "weekly" | "one-time";
}

export interface Expense {
  id: string;
  label: string;
  category: string;
  amount: number;
  isRecurring: boolean;
  dueDay: number | null;
}

export interface Loan {
  id: string;
  label: string;
  principal: number;
  emiAmount: number;
  interestRate: number;
  remainingMonths: number;
  dueDay: number | null;
}

export interface SavingsAccount {
  id: string;
  label: string;
  balance: number;
  type: "emergency" | "general";
}

export interface ProfileResponse {
  user: { id: string; email: string; name: string };
  income: IncomeSource[];
  expenses: Expense[];
  loans: Loan[];
  savings: SavingsAccount[];
}

export interface HealthScoreResult {
  monthlyIncome: number;
  monthlyRecurringExpenses: number;
  monthlyEmiTotal: number;
  disposableIncome: number;
  emergencySavings: number;
  emergencyMonthsCoverage: number;
  expenseRatio: number;
  debtToIncomeRatio: number;
  score: number;
  category: "poor" | "moderate" | "good";
}

export interface ForecastDay {
  date: string;
  events: { label: string; amount: number }[];
  balance: number;
}

export interface ForecastResult {
  startingBalance: number;
  days: number;
  timeline: ForecastDay[];
  totalUpcomingFixedExpenses: number;
  shortageDate: string | null;
  shortfallAmount: number | null;
}

export interface AffordabilityResult {
  itemLabel: string;
  purchaseAmount: number;
  verdict: "affordable" | "affordable-but-risky" | "not-recommended";
  balanceAfterPurchase: number;
  emergencyMonthsCoverageAfter: number;
  recommendedMinMonths: number;
  triggersForecastShortage: boolean;
  suggestedWaitMonths: number | null;
  reasons: string[];
}

export interface LoanSimulationResult {
  principal: number;
  annualRatePercent: number;
  tenureMonths: number;
  estimatedEmi: number;
  healthBefore: HealthScoreResult;
  healthAfter: HealthScoreResult;
  riskBefore: "low" | "moderate" | "high";
  riskAfter: "low" | "moderate" | "high";
}

export interface IncomeLossSimulationResult {
  requestedMonths: number;
  essentialMonthlyOutflow: number;
  emergencySavings: number;
  runwayMonths: number;
  sustainable: boolean;
  shortfallMonths: number;
}

export interface ActionItem {
  priority: number;
  title: string;
  description: string;
  category: "deficit" | "emergency-fund" | "debt" | "spending" | "on-track";
}

export interface ActionPlanResult {
  healthScore: number;
  healthCategory: "poor" | "moderate" | "good";
  actions: ActionItem[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
