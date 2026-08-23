import { motion } from "framer-motion";

interface HealthGaugeProps {
  score: number; // 0-100
  category: "poor" | "moderate" | "good";
}

const categoryColor: Record<HealthGaugeProps["category"], string> = {
  good: "#059669",
  moderate: "#d97706",
  poor: "#e11d48",
};

const categoryGradient: Record<HealthGaugeProps["category"], [string, string]> = {
  good: ["#10b981", "#14b8a6"],
  moderate: ["#f59e0b", "#f97316"],
  poor: ["#f43f5e", "#e11d48"],
};

const categoryLabel: Record<HealthGaugeProps["category"], string> = {
  good: "Good",
  moderate: "Moderate",
  poor: "Needs Attention",
};

export function HealthGauge({ score, category }: HealthGaugeProps) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = categoryColor[category];
  const [gradFrom, gradTo] = categoryGradient[category];
  const gradientId = `gauge-gradient-${category}`;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-32 shrink-0">
        <div
          className="absolute inset-2 rounded-full opacity-30 blur-xl"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <svg viewBox="0 0 120 120" className="relative h-32 w-32 -rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradFrom} />
              <stop offset="100%" stopColor={gradTo} />
            </linearGradient>
          </defs>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-slate-100 dark:stroke-slate-800"
          />
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">{score}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">/ 100</span>
        </div>
      </div>
      <div>
        <span
          className="inline-block rounded-full px-3 py-1 text-sm font-medium shadow-sm"
          style={{ color, backgroundColor: `${color}1a` }}
        >
          {categoryLabel[category]}
        </span>
      </div>
    </div>
  );
}
