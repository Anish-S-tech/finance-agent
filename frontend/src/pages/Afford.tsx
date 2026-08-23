import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import type { AffordabilityResult } from "../types";

const verdictStyle: Record<AffordabilityResult["verdict"], { bg: string; text: string; label: string }> = {
  affordable: {
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900",
    text: "text-emerald-800 dark:text-emerald-300",
    label: "✅ Affordable",
  },
  "affordable-but-risky": {
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900",
    text: "text-amber-800 dark:text-amber-300",
    label: "⚠️ Affordable, but risky",
  },
  "not-recommended": {
    bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900",
    text: "text-rose-800 dark:text-rose-300",
    label: "🚫 Not recommended now",
  },
};

export function Afford() {
  const [itemLabel, setItemLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<AffordabilityResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await api.checkAfford(Number(amount), itemLabel || "this purchase");
      setResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShoppingBag}
        title="Can I Afford This?"
        description="Check a purchase against your emergency reserve and upcoming obligations."
      />
      <form onSubmit={submit} className="card flex flex-col gap-2 sm:flex-row">
        <input
          placeholder="What are you buying? (e.g. Phone)"
          value={itemLabel}
          onChange={(e) => setItemLabel(e.target.value)}
          className="input-field flex-1"
        />
        <input
          placeholder="Amount (₹)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="input-field w-full sm:w-40"
        />
        <motion.button whileTap={{ scale: 0.97 }} disabled={loading} className="btn-primary">
          {loading ? "Checking..." : "Check"}
        </motion.button>
      </form>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.itemLabel + result.purchaseAmount}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`rounded-2xl border p-4 shadow-sm ${verdictStyle[result.verdict].bg}`}
          >
            <p className={`font-medium ${verdictStyle[result.verdict].text}`}>{verdictStyle[result.verdict].label}</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {result.reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
            {result.suggestedWaitMonths != null && (
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                Waiting about {result.suggestedWaitMonths} month(s) would let you rebuild your safety margin first.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
