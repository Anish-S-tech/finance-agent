import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { api } from "../api/client";
import { MetricCard } from "../components/MetricCard";
import { HealthGauge } from "../components/HealthGauge";
import { DashboardSkeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import type { HealthScoreResult, ActionPlanResult } from "../types";

const categoryTone: Record<HealthScoreResult["category"], "good" | "warn" | "bad"> = {
  good: "good",
  moderate: "warn",
  poor: "bad",
};

const categoryDot: Record<ActionPlanResult["actions"][number]["category"], string> = {
  deficit: "bg-rose-500",
  "emergency-fund": "bg-amber-500",
  debt: "bg-rose-500",
  spending: "bg-sky-500",
  "on-track": "bg-emerald-500",
};

export function Dashboard() {
  const [health, setHealth] = useState<HealthScoreResult | null>(null);
  const [plan, setPlan] = useState<ActionPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getHealth(), api.getActionPlan()])
      .then(([h, p]) => {
        setHealth(h);
        setPlan(p);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-rose-600 dark:text-rose-400">{error}</p>;
  if (!health || !plan) return <DashboardSkeleton />;

  const isEmpty =
    health.monthlyIncome === 0 &&
    health.monthlyRecurringExpenses === 0 &&
    health.monthlyEmiTotal === 0 &&
    health.emergencySavings === 0;

  if (isEmpty) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Let's build your financial picture"
        description="Add your income, expenses, loans, and savings to see your health score, cash-flow forecast, and a personalized action plan."
        ctaLabel="Add my financial data"
        ctaTo="/onboarding"
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <h1 className="gradient-text mb-4 text-xl font-bold">Financial Health Snapshot</h1>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <HealthGauge score={health.score} category={health.category} />
          <p className="max-w-md text-slate-600 dark:text-slate-400">
            You have approximately{" "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              ₹{health.disposableIncome.toFixed(0)}
            </span>{" "}
            available after your regular expenses, with an emergency reserve covering about{" "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {health.emergencyMonthsCoverage.toFixed(1)} month(s)
            </span>
            .
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Monthly income" value={health.monthlyIncome} prefix="₹" />
          <MetricCard
            label="Disposable income"
            value={health.disposableIncome}
            prefix="₹"
            tone={health.disposableIncome >= 0 ? "good" : "bad"}
          />
          <MetricCard
            label="Emergency coverage"
            value={health.emergencyMonthsCoverage}
            suffix=" mo"
            decimals={1}
            tone={categoryTone[health.category]}
          />
          <MetricCard
            label="Debt-to-income"
            value={health.debtToIncomeRatio * 100}
            suffix="%"
            tone={health.debtToIncomeRatio > 0.4 ? "bad" : "good"}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-50">Action Plan</h2>
        <ol className="space-y-2">
          {plan.actions.map((action, i) => (
            <motion.li
              key={action.priority}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35, ease: "easeOut" }}
              whileHover={{ y: -2 }}
              className="card card-hover flex items-start gap-3"
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${categoryDot[action.category]}`} />
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    #{action.priority}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{action.title}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{action.description}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>
    </div>
  );
}
