import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { Skeleton } from "../components/Skeleton";
import { PageHeader } from "../components/PageHeader";
import type { ForecastResult } from "../types";

function ForecastSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-72" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const balance = payload[0].value;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-sm shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`font-semibold ${balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`}>
        ₹{balance.toLocaleString("en-IN")}
      </div>
    </div>
  );
}

export function Forecast() {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getForecast(30)
      .then(setForecast)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-rose-600 dark:text-rose-400">{error}</p>;
  if (!forecast) return <ForecastSkeleton />;

  const chartData = forecast.timeline.map((d) => ({ date: d.date.slice(5), balance: Math.round(d.balance) }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TrendingUp}
        title="Will I Run Out of Money?"
        description="A day-by-day projection of your balance against upcoming fixed expenses."
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-4 ${
          forecast.shortageDate
            ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        }`}
      >
        {forecast.shortageDate ? (
          <>
            <p className="font-medium">⚠️ Potential cash shortage on {forecast.shortageDate}</p>
            <p className="mt-1 text-sm opacity-90">
              Your upcoming fixed expenses over the next {forecast.days} days total ₹
              {forecast.totalUpcomingFixedExpenses.toFixed(0)}, while your available balance is ₹
              {forecast.startingBalance.toFixed(0)}. Expected shortfall: ₹{forecast.shortfallAmount?.toFixed(0)}.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">✅ No shortage expected in the next {forecast.days} days</p>
            <p className="mt-1 text-sm opacity-90">
              Upcoming fixed expenses total ₹{forecast.totalUpcomingFixedExpenses.toFixed(0)} against a balance of ₹
              {forecast.startingBalance.toFixed(0)}.
            </p>
          </>
        )}
      </motion.div>

      <div className="card h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "currentColor" }} className="text-slate-400" />
            <YAxis tick={{ fontSize: 12, fill: "currentColor" }} className="text-slate-400" />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#059669"
              strokeWidth={2}
              fill="url(#balanceFill)"
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold text-slate-900 dark:text-slate-50">Upcoming events</h2>
        <ul className="space-y-1 text-sm">
          {forecast.timeline
            .filter((d) => d.events.length > 0)
            .map((d, i) => (
              <motion.li
                key={d.date}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex justify-between border-b border-slate-100 py-1 last:border-0 dark:border-slate-800"
              >
                <span className="text-slate-600 dark:text-slate-400">{d.date}</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {d.events.map((e) => `${e.label} ₹${e.amount}`).join(", ")}
                </span>
                <span
                  className={`tabular-nums ${
                    d.balance < 0 ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  ₹{d.balance.toFixed(0)}
                </span>
              </motion.li>
            ))}
        </ul>
      </div>
    </div>
  );
}
