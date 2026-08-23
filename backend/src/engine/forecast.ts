import type { FinancialProfile } from "./types.js";

export interface ForecastEvent {
  label: string;
  amount: number;
}

export interface ForecastDay {
  date: string; // ISO date
  events: ForecastEvent[];
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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Formats using local date parts (not toISOString, which converts to UTC and can
// shift the calendar day in timezones ahead of UTC, e.g. IST) so the string matches
// the local getDate() used to match due-day events above.
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Walks the balance forward day-by-day, applying recurring expenses/EMIs on their due day.
 * Income timing isn't modeled (schema has no per-income due day) — the forecast intentionally
 * mirrors the spec's worked example, which measures fixed outflows against today's balance only.
 */
export function projectCashFlow(
  profile: FinancialProfile,
  startingBalance: number,
  days = 30,
  startDate: Date = new Date()
): ForecastResult {
  const dueItems: { label: string; amount: number; dueDay: number }[] = [
    ...profile.expenses
      .filter((e) => e.isRecurring && e.dueDay != null)
      .map((e) => ({ label: e.label, amount: e.amount, dueDay: e.dueDay as number })),
    ...profile.loans
      .filter((l) => l.dueDay != null)
      .map((l) => ({ label: l.label, amount: l.emiAmount, dueDay: l.dueDay as number })),
  ];

  const totalUpcomingFixedExpenses = dueItems.reduce((sum, item) => sum + item.amount, 0);

  let balance = startingBalance;
  const timeline: ForecastDay[] = [];
  let shortageDate: string | null = null;
  let shortfallAmount: number | null = null;

  for (let offset = 0; offset < days; offset++) {
    const date = addDays(startDate, offset);
    const dayOfMonth = date.getDate();
    const events = dueItems.filter((item) => item.dueDay === dayOfMonth);

    for (const event of events) {
      balance -= event.amount;
    }

    timeline.push({
      date: formatLocalDate(date),
      events: events.map((e) => ({ label: e.label, amount: e.amount })),
      balance,
    });

    if (shortageDate === null && balance < 0) {
      shortageDate = formatLocalDate(date);
      shortfallAmount = Math.abs(balance);
    }
  }

  return {
    startingBalance,
    days,
    timeline,
    totalUpcomingFixedExpenses,
    shortageDate,
    shortfallAmount,
  };
}
