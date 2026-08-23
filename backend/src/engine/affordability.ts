import type { FinancialProfile } from "./types.js";
import { calculateHealthScore } from "./healthScore.js";
import { projectCashFlow } from "./forecast.js";

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

const RECOMMENDED_MIN_EMERGENCY_MONTHS = 1;

export function evaluateAffordability(
  profile: FinancialProfile,
  currentBalance: number,
  purchaseAmount: number,
  itemLabel: string
): AffordabilityResult {
  const health = calculateHealthScore(profile);
  const totalMonthlyOutflow = health.monthlyRecurringExpenses + health.monthlyEmiTotal;

  const amountFromEmergency = Math.max(0, purchaseAmount - currentBalance);
  const emergencyAfterPurchase = health.emergencySavings - amountFromEmergency;
  const emergencyMonthsCoverageAfter =
    totalMonthlyOutflow > 0 ? emergencyAfterPurchase / totalMonthlyOutflow : emergencyAfterPurchase > 0 ? 12 : 0;

  const balanceAfterPurchase = currentBalance - purchaseAmount;
  const forecastAfter = projectCashFlow(profile, Math.max(balanceAfterPurchase, 0), 30);
  const triggersForecastShortage = forecastAfter.shortageDate !== null;

  const reasons: string[] = [];
  let verdict: AffordabilityResult["verdict"] = "affordable";

  if (emergencyMonthsCoverageAfter < RECOMMENDED_MIN_EMERGENCY_MONTHS) {
    verdict = triggersForecastShortage ? "not-recommended" : "affordable-but-risky";
    reasons.push(
      `Paying ${purchaseAmount} now would leave emergency coverage at ${emergencyMonthsCoverageAfter.toFixed(
        1
      )} months, below the recommended minimum of ${RECOMMENDED_MIN_EMERGENCY_MONTHS} month(s).`
    );
  }

  if (triggersForecastShortage) {
    verdict = "not-recommended";
    reasons.push(
      `This purchase would leave your balance unable to cover upcoming fixed expenses (projected shortage on ${forecastAfter.shortageDate}).`
    );
  }

  if (reasons.length === 0) {
    reasons.push("This purchase keeps your emergency reserve and upcoming obligations covered.");
  }

  let suggestedWaitMonths: number | null = null;
  if (verdict !== "affordable" && health.disposableIncome > 0) {
    const reserveTarget = totalMonthlyOutflow * RECOMMENDED_MIN_EMERGENCY_MONTHS;
    const gap = reserveTarget - emergencyAfterPurchase;
    suggestedWaitMonths = gap > 0 ? Math.ceil(gap / health.disposableIncome) : null;
  }

  return {
    itemLabel,
    purchaseAmount,
    verdict,
    balanceAfterPurchase,
    emergencyMonthsCoverageAfter,
    recommendedMinMonths: RECOMMENDED_MIN_EMERGENCY_MONTHS,
    triggersForecastShortage,
    suggestedWaitMonths,
    reasons,
  };
}
