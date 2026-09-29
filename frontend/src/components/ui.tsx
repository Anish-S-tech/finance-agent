import { ReactNode } from 'react'
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import type { Band, Severity } from '../lib/types'

export const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-gray-200 bg-white p-5 ${className}`}>{children}</div>
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-medium text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-medium text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-800',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  ghost: 'text-gray-600 hover:bg-gray-100',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
}

export function Button({
  children, variant = 'primary', className = '', loading = false, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm text-gray-700">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <p className="font-medium text-gray-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{body}</p>
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  )
}

// ---------- Status: colour + icon + label, never colour alone ----------

const severityMeta: Record<Severity, { label: string; icon: typeof Info; className: string }> = {
  high: { label: 'High', icon: AlertOctagon, className: 'text-status-critical' },
  medium: { label: 'Medium', icon: AlertTriangle, className: 'text-status-serious' },
  low: { label: 'Low', icon: Info, className: 'text-[#b07d00]' },
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const m = severityMeta[severity]
  const Icon = m.icon
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      <Icon className={`h-3.5 w-3.5 ${m.className}`} aria-hidden />
      {m.label}
    </span>
  )
}

export function SeverityIcon({ severity, className = 'h-5 w-5' }: { severity: Severity; className?: string }) {
  const m = severityMeta[severity]
  const Icon = m.icon
  return <Icon className={`${className} shrink-0 ${m.className}`} aria-label={`${m.label} severity`} />
}

export const bandColor: Record<Band, string> = {
  Critical: '#d03b3b',
  Weak: '#ec835a',
  Fair: '#fab219',
  Good: '#0ca30c',
  Excellent: '#0ca30c',
}

export function BandBadge({ band }: { band: Band }) {
  const Icon = band === 'Good' || band === 'Excellent' ? CheckCircle2 : band === 'Fair' ? Info : AlertTriangle
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-800">
      <Icon className="h-4 w-4" style={{ color: bandColor[band] }} aria-hidden />
      {band}
    </span>
  )
}

/** Thin horizontal meter: 0–100. */
export function Meter({ value, color = '#2a78d6', label }: { value: number; color?: string; label: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100" role="meter" aria-valuenow={pct}
         aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export function StatTile({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone?: 'good' | 'bad'
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-medium text-gray-900">{value}</p>
      {sub && (
        <p className={`mt-0.5 text-xs ${tone === 'good' ? 'text-status-good-text' : tone === 'bad' ? 'text-red-700' : 'text-gray-500'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}
