import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, ctaTo }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60"
    >
      <div
        className="absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10"
        aria-hidden
      />
      <div className="icon-tile relative mb-4 h-14 w-14">
        <Icon size={24} />
      </div>
      <h2 className="relative text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <p className="relative mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {ctaLabel && ctaTo && (
        <Link to={ctaTo} className="btn-primary relative mt-5">
          {ctaLabel}
        </Link>
      )}
    </motion.div>
  );
}
