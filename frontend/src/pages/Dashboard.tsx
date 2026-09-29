import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, CheckCircle2, Target } from 'lucide-react'
import { api } from '../lib/api'
import { useApi } from '../hooks/useApi'
import type { ActionItem, Overview } from '../lib/types'
import { daysUntil, formatCurrency, formatDate, formatMonthYear } from '../lib/format'
import {
  BandBadge, Button, Card, CardHeader, EmptyState, ErrorBanner, Meter, PageHeader, SeverityIcon, Spinner, StatTile,
  bandColor,
} from '../components/ui'
import { ForecastChart } from '../components/charts/ForecastChart'
import { ActionCard } from '../components/ActionCard'

export default function Dashboard() {
  const { data, error, loading, reload, setData } = useApi<Overview>('/analysis/overview')
  const [seeding, setSeeding] = useState(false)

  const loadSample = async () => {
    setSeeding(true)
    try {
      await api.post('/finances/load-sample')
      await reload()
    } finally {
      setSeeding(false)
    }
  }

  const onActionChange = (updated: ActionItem) => {
    if (!data) return
    setData({ ...data, top_actions: data.top_actions.map((a) => (a.id === updated.id ? updated : a)) })
  }

  if (loading && !data) return <Spinner label="Analysing your finances…" />

  if (data && !data.has_data) {
    return (
      <>
        <PageHeader title={`Welcome${data.name ? `, ${data.name}` : ''}`}
                    subtitle="Let's build your financial picture." />
        <ErrorBanner message={error} />
        <EmptyState
          title="Add your income, expenses and loans"
          body="FinMentor needs your regular spending and EMIs to score your financial health, forecast your cash flow and build a plan. Or explore everything first with a fictional sample profile."
          action={<>
            <Link to="/profile"><Button>Add my finances</Button></Link>
            <Button variant="secondary" loading={seeding} onClick={loadSample}>Explore with sample data</Button>
          </>}
        />
      </>
    )
  }

  if (!data) return <ErrorBanner message={error} />

  const { health, forecast } = data
  const m = health.metrics

  return (
    <>
      <PageHeader title={`Hi${data.name ? ` ${data.name}` : ''}, here's where you stand`}
                  subtitle="Updated from your latest numbers." />
      <ErrorBanner message={error} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Health score */}
        <Card>
          <CardHeader title="Financial health" subtitle="Weighted across six checks" />
          <div className="flex items-end gap-3">
            <p className="text-5xl font-medium leading-none text-gray-900">{Math.round(health.score)}</p>
            <p className="pb-1 text-sm text-gray-500">/ 100</p>
            <div className="ml-auto pb-1"><BandBadge band={health.band} /></div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${health.score}%`, background: bandColor[health.band] }} />
          </div>
          <ul className="mt-5 space-y-3">
            {health.components.map((c) => (
              <li key={c.key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-700">{c.label}</span>
                  <span className="text-gray-500">{componentValue(c.key, c.value)} · {c.target}</span>
                </div>
                <Meter value={c.score} label={`${c.label} score`} />
              </li>
            ))}
          </ul>
        </Card>

        {/* Forecast */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Cash-flow forecast"
            subtitle={`Projected bank balance for the next ${forecast.points.length} months`}
            action={<Link to="/simulate" className="text-sm text-brand-600 hover:text-brand-800">Try a what-if →</Link>}
          />
          <ForecastChart forecast={forecast} />
          <p className="mt-2 text-sm text-gray-600">
            {forecast.shortfall_months.length
              ? <>Your balance goes negative in <strong>{forecast.shortfall_months[0]}</strong> (lowest {formatCurrency(forecast.lowest_balance)}).</>
              : forecast.low_months.length
                ? <>Lowest point: <strong>{formatCurrency(forecast.lowest_balance)}</strong> in {forecast.lowest_month} — below your {formatCurrency(forecast.safety_buffer)} safety buffer.</>
                : <>You stay above your {formatCurrency(forecast.safety_buffer)} safety buffer every month.</>}
          </p>
        </Card>
      </div>

      {/* KPI row */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Income" value={formatCurrency(m.monthly_income)} sub="per month" />
        <StatTile label="Spending" value={formatCurrency(m.monthly_expenses)}
                  sub={`${formatCurrency(m.discretionary_expenses)} on wants`} />
        <StatTile label="Savings rate" value={`${m.savings_rate}%`} sub={`${formatCurrency(m.surplus)} left/month`}
                  tone={m.savings_rate >= 20 ? 'good' : m.savings_rate < 0 ? 'bad' : undefined} />
        <StatTile label="EMIs" value={formatCurrency(m.monthly_emi)} sub={`${m.debt_to_income}% of income`}
                  tone={m.debt_to_income > 40 ? 'bad' : undefined} />
        <StatTile label="Emergency cover" value={`${m.emergency_months} mo`} sub={`${formatCurrency(m.liquid_savings)} liquid`}
                  tone={m.emergency_months >= 6 ? 'good' : m.emergency_months < 3 ? 'bad' : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Risks */}
        <Card className="lg:col-span-2">
          <CardHeader title="Risks we spotted" subtitle={`${health.risks.length} things to watch, most serious first`} />
          {health.risks.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 className="h-4 w-4 text-status-good" aria-hidden /> No risks flagged. Nice work.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {health.risks.map((r) => (
                <li key={r.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <SeverityIcon severity={r.severity} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.title}</p>
                    <p className="text-sm text-gray-600">{r.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top actions */}
        <Card>
          <CardHeader title="Do this next"
                      action={<Link to="/plan" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800">
                        Full plan <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          {data.top_actions.length === 0
            ? <p className="text-sm text-gray-500">You're all caught up.</p>
            : <div className="space-y-4">
                {data.top_actions.map((a) => <ActionCard key={a.id} action={a} onChange={onActionChange} compact />)}
              </div>}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Goals */}
        <Card>
          <CardHeader title="Goals" subtitle="At your current contributions" />
          {health.goals.length === 0 ? (
            <p className="text-sm text-gray-500">No goals yet. <Link to="/profile?tab=goals" className="text-brand-600">Add one</Link></p>
          ) : (
            <ul className="space-y-4">
              {health.goals.map((g) => (
                <li key={g.label}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-gray-900">
                      <Target className="h-4 w-4 text-gray-400" aria-hidden /> {g.label}
                    </span>
                    <span className="text-gray-500">{formatCurrency(g.current_amount)} of {formatCurrency(g.target_amount)}</span>
                  </div>
                  <div className="mt-1.5"><Meter value={g.progress_pct} label={`${g.label} progress`} /></div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    {g.on_track
                      ? <><CheckCircle2 className="h-3.5 w-3.5 text-status-good" aria-hidden /> On track</>
                      : <><SeverityIcon severity="medium" className="h-3.5 w-3.5" /> Off track</>}
                    <span>
                      · {g.projected_date ? `reaches target ${formatMonthYear(g.projected_date)}` : 'no contribution set'}
                      {g.target_date && ` (goal: ${formatMonthYear(g.target_date)})`}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming */}
        <Card>
          <CardHeader title="Upcoming payments"
                      action={<Link to="/profile?tab=upcoming" className="text-sm text-brand-600 hover:text-brand-800">Manage</Link>} />
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.upcoming.map((u) => {
                const days = daysUntil(u.due_date)
                return (
                  <li key={`${u.label}-${u.due_date}`} className="flex items-center gap-3 py-2.5">
                    <CalendarClock className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-900">{u.label}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(u.due_date)} · {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
                      </p>
                    </div>
                    <p className="text-sm font-medium tabular-nums text-gray-900">{formatCurrency(u.amount)}</p>
                  </li>
                )
              })}
            </ul>
          )}
          {forecast.milestones.length > 0 && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              {forecast.milestones.map((ms) => <p key={ms}>🎯 {ms}</p>)}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function componentValue(key: string, value: number | null) {
  if (value === null) return '—'
  if (key === 'emergency') return `${value} mo`
  return `${value}%`
}
