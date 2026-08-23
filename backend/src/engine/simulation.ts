import type { FinancialProfile } from "./types.js";
import { calculateHealthScore, type HealthScoreResult } from "./healthScore.js";

export type RiskLevel = "low" | "moderate" | "high";

function riskFromDti(dti: number): RiskLevel {
  if (dti < 0.2) return "low";
  if (dti < 0.4) return "moderate";
  return "high";
}

function calculateEmi(principal: number, annualRatePercent: number, tenureMonths: number): number {
  const monthlyRate = annualRatePercent / 12 / 100;
  if (monthlyRate === 0) return principal / tenureMonths;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export interface LoanSimulationResult {
  principal: number;
  annualRatePercent: number;
  tenureMonths: number;
  estimatedEmi: number;
  healthBefore: HealthScoreResult;
  healthAfter: HealthScoreResult;
  riskBefore: RiskLevel;
  riskAfter: RiskLevel;
}

export function simulateLoan(
  profile: FinancialProfile,
  principal: number,
  annualRatePercent: number,
  tenureMonths: number
): LoanSimulationResult {
  const estimatedEmi = calculateEmi(principal, annualRatePercent, tenureMonths);

  const healthBefore = calculateHealthScore(profile);

  const profileAfter: FinancialProfile = {
    ...profile,
    loans: [
      ...profile.loans,
      {
        label: "Simulated Loan",
        principal,
        emiAmount: estimatedEmi,
        interestRate: annualRatePercent,
        remainingMonths: tenureMonths,
      },
    ],
  };
  const healthAfter = calculateHealthScore(profileAfter);

  return {
    principal,
    annualRatePercent,
    tenureMonths,
    estimatedEmi,
    healthBefore,
    healthAfter,
    riskBefore: riskFromDti(healthBefore.debtToIncomeRatio),
    riskAfter: riskFromDti(healthAfter.debtToIncomeRatio),
  };
}

export interface IncomeLossSimulationResult {
  requestedMonths: number;
  essentialMonthlyOutflow: number;
  emergencySavings: number;
  runwayMonths: number;
  sustainable: boolean;
  shortfallMonths: number;
}

export function simulateIncomeLoss(profile: FinancialProfile, months: number): IncomeLossSimulationResult {
  const health = calculateHealthScore(profile);
  const essentialMonthlyOutflow = health.monthlyRecurringExpenses + health.monthlyEmiTotal;
  const runwayMonths =
    essentialMonthlyOutflow > 0 ? health.emergencySavings / essentialMonthlyOutflow : Infinity;
  const sustainable = runwayMonths >= months;

  return {
    requestedMonths: months,
    essentialMonthlyOutflow,
    emergencySavings: health.emergencySavings,
    runwayMonths,
    sustainable,
    shortfallMonths: sustainable ? 0 : months - runwayMonths,
  };
}
