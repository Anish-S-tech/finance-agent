import { motion } from "framer-motion";
import { AnimatedNumber } from "./AnimatedNumber";

interface MetricCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  tone?: "neutral" | "good" | "warn" | "bad";
}

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "text-slate-900 dark:text-slate-50",
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-rose-600 dark:text-rose-400",
};

const toneBar: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "from-slate-400 to-slate-500",
  good: "from-emerald-500 to-teal-500",
  warn: "from-amber-400 to-orange-500",
  bad: "from-rose-500 to-red-500",
};

export function MetricCard({ label, value, prefix = "", suffix = "", decimals = 0, tone = "neutral" }: MetricCardProps) {
  return (
    <motion.div whileHover={{ y: -3 }} className="card card-hover relative overflow-hidden">
      <span className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${toneBar[tone]}`} />
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${toneClasses[tone]}`}>
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
    </motion.div>
  );
}
