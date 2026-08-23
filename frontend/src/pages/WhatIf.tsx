import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import type { LoanSimulationResult, IncomeLossSimulationResult } from "../types";

const riskColor: Record<"low" | "moderate" | "high", string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  moderate: "text-amber-600 dark:text-amber-400",
  high: "text-rose-600 dark:text-rose-400",
};

const inputClass = "input-field";

function SimCard({ children }: { children: React.ReactNode }) {
  return <section className="card">{children}</section>;
}

function ResultPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-4 overflow-hidden rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"
    >
      {children}
    </motion.div>
  );
}

export function WhatIf() {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [loanResult, setLoanResult] = useState<LoanSimulationResult | null>(null);

  const [months, setMonths] = useState("");
  const [lossResult, setLossResult] = useState<IncomeLossSimulationResult | null>(null);

  async function submitLoan(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api.simulateLoan(Number(principal), Number(rate), Number(tenure));
      setLoanResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitLoss(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api.simulateIncomeLoss(Number(months));
      setLossResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={FlaskConical}
        title="What-If Simulator"
        description="See how a new loan or a period without income would affect your finances."
      />

      <SimCard>
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-50">What if I take a loan?</h2>
        <form onSubmit={submitLoan} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            placeholder="Loan amount (₹)"
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            required
            className={inputClass}
          />
          <input
            placeholder="Interest rate (% annual)"
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
            className={inputClass}
          />
          <input
            placeholder="Tenure (months)"
            type="number"
            value={tenure}
            onChange={(e) => setTenure(e.target.value)}
            required
            className={inputClass}
          />
          <motion.button whileTap={{ scale: 0.97 }} className="btn-primary col-span-1 sm:col-span-3">
            Simulate Loan
          </motion.button>
        </form>

        <AnimatePresence>
          {loanResult && (
            <ResultPanel>
              <p className="text-slate-800 dark:text-slate-200">
                Estimated EMI: <span className="font-semibold">₹{loanResult.estimatedEmi.toFixed(0)}/month</span>
              </p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">
                Debt-to-income: {(loanResult.healthBefore.debtToIncomeRatio * 100).toFixed(0)}% →{" "}
                {(loanResult.healthAfter.debtToIncomeRatio * 100).toFixed(0)}%
              </p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">
                Risk level: <span className={riskColor[loanResult.riskBefore]}>{loanResult.riskBefore}</span> →{" "}
                <span className={riskColor[loanResult.riskAfter]}>{loanResult.riskAfter}</span>
              </p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">
                Health score: {loanResult.healthBefore.score} ({loanResult.healthBefore.category}) →{" "}
                {loanResult.healthAfter.score} ({loanResult.healthAfter.category})
              </p>
            </ResultPanel>
          )}
        </AnimatePresence>
      </SimCard>

      <SimCard>
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-50">What if I lose my income?</h2>
        <form onSubmit={submitLoss} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            placeholder="Months without income"
            type="number"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            required
            className={`sm:col-span-2 ${inputClass}`}
          />
          <motion.button whileTap={{ scale: 0.97 }} className="btn-primary">
            Simulate
          </motion.button>
        </form>

        <AnimatePresence>
          {lossResult && (
            <ResultPanel>
              <p className="text-slate-800 dark:text-slate-200">
                Your savings can cover essential expenses for about{" "}
                <span className="font-semibold">{lossResult.runwayMonths.toFixed(1)} months</span>.
              </p>
              <p className="mt-1">
                {lossResult.sustainable ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    This covers the full {lossResult.requestedMonths}-month scenario.
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400">
                    This falls short by about {lossResult.shortfallMonths.toFixed(1)} month(s).
                  </span>
                )}
              </p>
            </ResultPanel>
          )}
        </AnimatePresence>
      </SimCard>
    </div>
  );
}
