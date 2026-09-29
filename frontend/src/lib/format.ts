export function formatCurrency(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  const sign = v < 0 ? '-' : ''
  return `${sign}₹${Math.round(Math.abs(v)).toLocaleString('en-IN')}`
}

/** ₹1.2L / ₹45k — for chart axes where space is tight. */
export function formatCompact(v: number) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1).replace(/\.0$/, '')}L`
  if (abs >= 1e3) return `${sign}₹${Math.round(abs / 1e3)}k`
  return `${sign}₹${Math.round(abs)}`
}

export function formatSigned(v: number, fmt: (n: number) => string = formatCurrency) {
  if (v === 0) return fmt(0)
  return v > 0 ? `+${fmt(v)}` : fmt(v)
}

/** 8 → '8 mo', 30 → '2.5 yrs', anything over 20 years → '20+ yrs'. */
export function formatMonths(months: number | null) {
  if (months === null) return 'never'
  const abs = Math.abs(months)
  if (abs >= 240) return '20+ yrs'
  if (abs < 24) return `${months} mo`
  return `${(months / 12).toFixed(1).replace(/\.0$/, '')} yrs`
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function formatMonthYear(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', {
    month: 'short', year: 'numeric',
  })
}

export function daysUntil(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86_400_000)
}
