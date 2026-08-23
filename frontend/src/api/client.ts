import type {
  ProfileResponse,
  HealthScoreResult,
  ForecastResult,
  AffordabilityResult,
  LoanSimulationResult,
  IncomeLossSimulationResult,
  ActionPlanResult,
  ChatMessage,
  UserProfile,
} from "../types";
import { getCurrentUserId } from "./currentUser";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const userId = getCurrentUserId();
  const res = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "X-User-Id": userId } : {}),
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getUsers: () => request<UserProfile[]>("/users"),
  createUser: (name: string) => request<UserProfile>("/users", { method: "POST", body: JSON.stringify({ name }) }),

  getProfile: () => request<ProfileResponse>("/profile"),
  addIncome: (data: { label: string; amount: number; frequency: string }) =>
    request("/profile/income", { method: "POST", body: JSON.stringify(data) }),
  addExpense: (data: { label: string; category: string; amount: number; isRecurring: boolean; dueDay?: number }) =>
    request("/profile/expenses", { method: "POST", body: JSON.stringify(data) }),
  addLoan: (data: {
    label: string;
    principal: number;
    emiAmount: number;
    interestRate: number;
    remainingMonths: number;
    dueDay?: number;
  }) => request("/profile/loans", { method: "POST", body: JSON.stringify(data) }),
  addSavings: (data: { label: string; balance: number; type: string }) =>
    request("/profile/savings", { method: "POST", body: JSON.stringify(data) }),
  deleteIncome: (id: string) => request(`/profile/income/${id}`, { method: "DELETE" }),
  deleteExpense: (id: string) => request(`/profile/expenses/${id}`, { method: "DELETE" }),
  deleteLoan: (id: string) => request(`/profile/loans/${id}`, { method: "DELETE" }),
  deleteSavings: (id: string) => request(`/profile/savings/${id}`, { method: "DELETE" }),

  getHealth: () => request<HealthScoreResult>("/health"),
  getForecast: (days = 30) => request<ForecastResult>(`/forecast?days=${days}`),
  checkAfford: (amount: number, itemLabel: string) =>
    request<AffordabilityResult>("/afford", { method: "POST", body: JSON.stringify({ amount, itemLabel }) }),
  simulateLoan: (principal: number, annualRatePercent: number, tenureMonths: number) =>
    request<LoanSimulationResult>("/simulate/loan", {
      method: "POST",
      body: JSON.stringify({ principal, annualRatePercent, tenureMonths }),
    }),
  simulateIncomeLoss: (months: number) =>
    request<IncomeLossSimulationResult>("/simulate/income-loss", {
      method: "POST",
      body: JSON.stringify({ months }),
    }),
  getActionPlan: () => request<ActionPlanResult>("/action-plan"),

  getChatHistory: () => request<ChatMessage[]>("/chat"),
  sendChatMessage: (message: string) =>
    request<{ reply: string }>("/chat", { method: "POST", body: JSON.stringify({ message }) }),
};
