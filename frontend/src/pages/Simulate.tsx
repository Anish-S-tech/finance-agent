import { FormEvent, useState } from 'react'
import {
  AlertOctagon, AlertTriangle, Banknote, CheckCircle2, HeartPulse, PiggyBank, Plus, Save, ShoppingBag,
  Trash2, TrendingDown, Wallet, XCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import { useApi } from '../hooks/useApi'
import type {
  AffordabilityResult, AffordRequest, SavedSimulation, ScenarioChange, SimulationResult, Verdict,
} from '../lib/types'
import { formatCurrency, formatMonths, formatSigned } from '../lib/format'
import { Button, Card, CardHeader, ErrorBanner, Field, PageHeader, SeverityIcon, StatTile, inputClass } from '../components/ui'
import { ScenarioChart } from '../components/charts/ForecastChart'

// ============================================================
// Can I afford this?
// ============================================================

const VERDICT_META: Record<Verdict, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  yes: { label: 'Yes', icon: CheckCircle2, color: '#0ca30c', bg: 'bg-green-50' },
  yes_with_caution: { label: 'Yes, with caution', icon: AlertTriangle, color: '#b07d00', bg: 'bg-amber-50' },
  not_now: { label: 'Not right now', icon: AlertTriangle, color: '#ec835a', bg: 'bg-orange-50' },
  no: { label: 'No', icon: AlertOctagon, color: '#d03b3b', bg: 'bg-red-50' },
}

function AffordCard() {
  const [req, setReq] = useState<AffordRequest>({
    item: '', cost: 0, mode: 'cash', tenure_months: 12, interest_rate: 14, down_payment: 0,
  })
  const [result, setResult] = useState<AffordabilityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      setResult(await api.post<AffordabilityResult>('/simulate/afford', { ...req, item: req.item || 'this purchase' }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const num = (k: keyof AffordRequest) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setReq((r) => ({ ...r, [k]: e.target.value === '' ? 0 : Number(e.target.value) }))

  return (
    <Card>
      <CardHeader title="Can I afford this?" subtitle="Checks a purchase against your savings, EMIs, forecast and goals." />
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2 lg:col-span-2">
          <Field label="What do you want to buy?">
            <input value={req.item} onChange={(e) => setReq((r) => ({ ...r, item: e.target.value }))}
                   placeholder="e.g. new phone" className={inputClass} />
          </Field>
        </div>
        <Field label="Price (₹)">
          <input type="number" min={1} required value={req.cost || ''} onChange={num('cost')} className={inputClass} />
        </Field>
        <Field label="Pay with">
          <div className="mt-1 grid grid-cols-2 rounded-lg border border-gray-300 p-0.5 text-sm">
            {(['cash', 'emi'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setReq((r) => ({ ...r, mode: m }))}
                      className={`rounded-md py-1.5 ${req.mode === m ? 'bg-brand-600 text-white' : 'text-gray-600'}`}>
                {m === 'cash' ? 'Savings' : 'EMI'}
              </button>
            ))}
          </div>
        </Field>
        {req.mode === 'emi' && (
          <>
            <Field label="Tenure (months)">
              <input type="number" min={1} max={360} value={req.tenure_months} onChange={num('tenure_months')} className={inputClass} />
            </Field>
            <Field label="Interest (% / yr)">
              <input type="number" min={0} max={60} step="0.1" value={req.interest_rate} onChange={num('interest_rate')} className={inputClass} />
            </Field>
            <Field label="Down payment (₹)">
              <input type="number" min={0} value={req.down_payment || ''} onChange={num('down_payment')} className={inputClass} />
            </Field>
          </>
        )}
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <Button type="submit" loading={loading} className="w-full">Check</Button>
        </div>
      </form>

      <ErrorBanner message={error} />
      {result && <AffordResult result={result} />}
    </Card>
  )
}

function AffordResult({ result }: { result: AffordabilityResult }) {
  const v = VERDICT_META[result.verdict]
  const Icon = v.icon
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div>
        <div className={`flex items-start gap-3 rounded-xl p-4 ${v.bg}`}>
          <Icon className="mt-0.5 h-6 w-6 shrink-0" style={{ color: v.color }} aria-hidden />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-600">{v.label}</p>
            <p className="mt-0.5 font-medium text-gray-900">{result.headline}</p>
            {result.monthly_emi && (
              <p className="mt-1 text-sm text-gray-700">EMI: {formatCurrency(result.monthly_emi)}/month</p>
            )}
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {result.checks.map((c) => (
            <li key={c.key} className="flex gap-2 text-sm">
              {c.passed
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-good" aria-label="Passed" />
                : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" aria-label="Failed" />}
              <span><span className="font-medium text-gray-900">{c.label}.</span> <span className="text-gray-600">{c.detail}</span></span>
            </li>
          ))}
        </ul>
        {result.max_comfortable_amount > 0 && (
          <p className="mt-4 text-sm text-gray-700">
            Safe budget today: <strong>{formatCurrency(result.max_comfortable_amount)}</strong>
          </p>
        )}
        {result.alternatives.length > 0 && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">What would work instead</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {result.alternatives.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        )}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-gray-900">Your bank balance over the next 12 months</p>
        <ScenarioChart baseline={result.simulation.baseline_forecast} scenario={result.simulation.scenario_forecast} height={240} />
      </div>
    </div>
  )
}

// ============================================================
// What-if builder
// ============================================================

type ChangeType = ScenarioChange['type']
type FieldSpec = { key: string; label: string; kind: 'text' | 'number' | 'bool' | 'mode' | 'category'; hint?: string }

const CHANGE_DEFS: Record<ChangeType, { title: string; icon: typeof Wallet; defaults: ScenarioChange; fields: FieldSpec[] }> = {
  purchase: {
    title: 'Big purchase', icon: ShoppingBag,
    defaults: { type: 'purchase', label: 'New purchase', amount: 50000, mode: 'cash', tenure_months: 12, interest_rate: 14, down_payment: 0, month: 0 },
    fields: [
      { key: 'label', label: 'What', kind: 'text' }, { key: 'amount', label: 'Price (₹)', kind: 'number' },
      { key: 'mode', label: 'Pay with', kind: 'mode' }, { key: 'tenure_months', label: 'EMI months', kind: 'number' },
      { key: 'interest_rate', label: 'Interest %', kind: 'number' }, { key: 'down_payment', label: 'Down payment (₹)', kind: 'number' },
      { key: 'month', label: 'When (months from now)', kind: 'number' },
    ],
  },
  new_loan: {
    title: 'Take a loan', icon: Banknote,
    defaults: { type: 'new_loan', label: 'Personal loan', principal: 200000, interest_rate: 12, tenure_months: 36, receive_cash: true },
    fields: [
      { key: 'label', label: 'Loan', kind: 'text' }, { key: 'principal', label: 'Amount (₹)', kind: 'number' },
      { key: 'interest_rate', label: 'Interest %', kind: 'number' }, { key: 'tenure_months', label: 'Months', kind: 'number' },
      { key: 'receive_cash', label: 'Money lands in my account', kind: 'bool' },
    ],
  },
  income_change: {
    title: 'Income change', icon: TrendingDown,
    defaults: { type: 'income_change', label: 'Pay cut', percent: -20, amount: null, start_month: 0, months: null },
    fields: [
      { key: 'label', label: 'Why', kind: 'text' }, { key: 'percent', label: 'Change %', kind: 'number', hint: '−20 = 20% cut' },
      { key: 'amount', label: 'or ₹/month', kind: 'number' }, { key: 'start_month', label: 'Starts (months from now)', kind: 'number' },
      { key: 'months', label: 'Lasts (months)', kind: 'number', hint: 'Blank = permanent' },
    ],
  },
  emergency: {
    title: 'Emergency', icon: HeartPulse,
    defaults: { type: 'emergency', label: 'Medical emergency', amount: 75000, month: 0, income_loss_months: 0 },
    fields: [
      { key: 'label', label: 'What', kind: 'text' }, { key: 'amount', label: 'Cost (₹)', kind: 'number' },
      { key: 'month', label: 'When (months from now)', kind: 'number' },
      { key: 'income_loss_months', label: 'Months without income', kind: 'number' },
    ],
  },
  savings_plan: {
    title: 'Start saving', icon: PiggyBank,
    defaults: { type: 'savings_plan', label: 'Monthly SIP', monthly_amount: 5000, start_month: 0 },
    fields: [
      { key: 'label', label: 'Plan', kind: 'text' }, { key: 'monthly_amount', label: '₹ per month', kind: 'number' },
      { key: 'start_month', label: 'Starts (months from now)', kind: 'number' },
    ],
  },
  expense_change: {
    title: 'Change spending', icon: Wallet,
    defaults: { type: 'expense_change', label: 'Cut shopping', category: 'shopping', percent: -30, amount: null, essential: false, start_month: 0 },
    fields: [
      { key: 'label', label: 'What', kind: 'text' }, { key: 'category', label: 'Category', kind: 'category' },
      { key: 'percent', label: 'Change %', kind: 'number', hint: '−30 = spend 30% less' },
      { key: 'amount', label: 'or ₹/month', kind: 'number', hint: '+ = spend more' },
      { key: 'start_month', label: 'Starts (months from now)', kind: 'number' },
    ],
  },
}

const CATEGORIES = ['housing', 'food', 'transport', 'utilities', 'shopping', 'entertainment', 'health', 'education', 'other']

function ChangeEditor({ change, onChange, onRemove }: {
  change: ScenarioChange; onChange: (c: ScenarioChange) => void; onRemove: () => void
}) {
  const def = CHANGE_DEFS[change.type]
  const Icon = def.icon
  const values = change as unknown as Record<string, unknown>
  const set = (key: string, value: unknown) => {
    const next = { ...values, [key]: value }
    // Percent and ₹ amount are alternatives — setting one clears the other.
    if (key === 'percent' && value !== null) next.amount = null
    if (key === 'amount' && value !== null && 'percent' in values) next.percent = null
    onChange(next as unknown as ScenarioChange)
  }
  const hidden = (f: FieldSpec) =>
    change.type === 'purchase' && change.mode === 'cash' && ['tenure_months', 'interest_rate', 'down_payment'].includes(f.key)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <Icon className="h-4 w-4 text-brand-600" aria-hidden /> {def.title}
        </p>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-700" aria-label={`Remove ${def.title}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {def.fields.filter((f) => !hidden(f)).map((f) => {
          const v = values[f.key]
          if (f.kind === 'bool') {
            return (
              <label key={f.key} className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
                <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.key, e.target.checked)}
                       className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                {f.label}
              </label>
            )
          }
          return (
            <Field key={f.key} label={f.label} hint={f.hint}>
              {f.kind === 'mode' ? (
                <select value={String(v)} onChange={(e) => set(f.key, e.target.value)} className={inputClass}>
                  <option value="cash">Savings</option><option value="emi">EMI</option>
                </select>
              ) : f.kind === 'category' ? (
                <select value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value || null)} className={inputClass}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                </select>
              ) : (
                <input
                  type={f.kind === 'number' ? 'number' : 'text'}
                  value={v === null || v === undefined ? '' : String(v)}
                  onChange={(e) => set(f.key, f.kind === 'number'
                    ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
          )
        })}
      </div>
    </div>
  )
}

function WhatIf() {
  const [changes, setChanges] = useState<ScenarioChange[]>([])
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveName, setSaveName] = useState('')
  const saved = useApi<SavedSimulation[]>('/simulate/saved')

  const run = async (list = changes) => {
    if (!list.length) return
    setLoading(true)
    setError(null)
    try {
      setResult(await api.post<SimulationResult>('/simulate', { changes: list, months: 12 }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!saveName.trim() || !changes.length) return
    await api.post('/simulate/saved', { name: saveName.trim(), scenario: { changes, months: 12 } })
    setSaveName('')
    saved.reload()
  }

  const load = (s: SavedSimulation) => {
    setChanges(s.scenario.changes)
    run(s.scenario.changes)
  }

  return (
    <Card className="mt-6">
      <CardHeader title="What-if simulator"
                  subtitle="Stack up changes and see how your next 12 months would look." />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(CHANGE_DEFS) as ChangeType[]).map((t) => {
          const Icon = CHANGE_DEFS[t].icon
          return (
            <button key={t} onClick={() => setChanges((c) => [...c, { ...CHANGE_DEFS[t].defaults }])}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-brand-400 hover:text-brand-800">
              <Plus className="h-3.5 w-3.5" aria-hidden /><Icon className="h-3.5 w-3.5" aria-hidden /> {CHANGE_DEFS[t].title}
            </button>
          )
        })}
      </div>

      {changes.length > 0 && (
        <div className="mt-4 space-y-3">
          {changes.map((c, i) => (
            <ChangeEditor key={i} change={c}
                          onChange={(next) => setChanges((all) => all.map((x, j) => (j === i ? next : x)))}
                          onRemove={() => setChanges((all) => all.filter((_, j) => j !== i))} />
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => run()} loading={loading}>Run simulation</Button>
            <Button variant="ghost" onClick={() => { setChanges([]); setResult(null) }}>Clear</Button>
            <div className="ml-auto flex gap-2">
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name this scenario"
                     className="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm" aria-label="Scenario name" />
              <Button variant="secondary" onClick={save} disabled={!saveName.trim()}>
                <Save className="h-4 w-4" aria-hidden /> Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <ErrorBanner message={error} />
      {result && <SimulationView result={result} />}

      {saved.data && saved.data.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="mb-2 text-sm font-medium text-gray-900">Saved scenarios</p>
          <ul className="divide-y divide-gray-100">
            {saved.data.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <button onClick={() => load(s)} className="flex-1 text-left text-gray-800 hover:text-brand-800">{s.name}</button>
                {s.result_summary && (
                  <span className="text-xs text-gray-500">
                    score {formatSigned(s.result_summary.score, (n) => n.toFixed(1))} · free cash {formatSigned(s.result_summary.free_cash)}/mo
                  </span>
                )}
                <button onClick={async () => { await api.delete(`/simulate/saved/${s.id}`); saved.reload() }}
                        className="text-gray-400 hover:text-red-700" aria-label={`Delete ${s.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function SimulationView({ result }: { result: SimulationResult }) {
  const d = result.delta
  const tone = (v: number, higherIsBetter = true) => (v === 0 ? undefined : (v > 0) === higherIsBetter ? 'good' : 'bad') as
    'good' | 'bad' | undefined
  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Health score" value={`${Math.round(result.scenario.score)}`}
                  sub={`${formatSigned(d.score, (n) => n.toFixed(1))} vs now`} tone={tone(d.score)} />
        <StatTile label="Free cash / month" value={formatCurrency(result.scenario.metrics.free_cash)}
                  sub={`${formatSigned(d.free_cash)} vs now`} tone={tone(d.free_cash)} />
        <StatTile label="Emergency cover" value={`${result.scenario.metrics.emergency_months} mo`}
                  sub={`${formatSigned(d.emergency_months, (n) => n.toFixed(1))} mo`} tone={tone(d.emergency_months)} />
        <StatTile label="EMIs / income" value={`${result.scenario.metrics.debt_to_income}%`}
                  sub={`${formatSigned(d.debt_to_income, (n) => `${n.toFixed(1)}%`)}`} tone={tone(d.debt_to_income, false)} />
        <StatTile label="Lowest balance" value={formatCurrency(result.scenario_forecast.lowest_balance)}
                  sub={result.scenario_forecast.lowest_month} tone={result.scenario_forecast.lowest_balance < 0 ? 'bad' : undefined} />
      </div>

      <div className="mt-6">
        <ScenarioChart baseline={result.baseline_forecast} scenario={result.scenario_forecast} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {result.goal_delays.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-900">Effect on goals</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="py-1.5 font-medium">Goal</th>
                  <th className="py-1.5 text-right font-medium">Now</th>
                  <th className="py-1.5 text-right font-medium">With changes</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {result.goal_delays.map((g) => (
                  <tr key={g.label} className="border-b border-gray-100">
                    <td className="py-1.5">{g.label}</td>
                    <td className="py-1.5 text-right">{formatMonths(g.baseline_months)}</td>
                    <td className="py-1.5 text-right">
                      {formatMonths(g.scenario_months)}
                      {g.delay_months !== null && g.delay_months !== 0 && (
                        <span className={g.delay_months > 0 ? 'ml-1 text-red-700' : 'ml-1 text-status-good-text'}>
                          ({g.delay_months > 0 ? '+' : ''}{formatMonths(g.delay_months)})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-900">New risks this creates</p>
          {result.new_risks.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 className="h-4 w-4 text-status-good" aria-hidden /> None
            </p>
          ) : (
            <ul className="space-y-2">
              {result.new_risks.map((r) => (
                <li key={r.id} className="flex gap-2 text-sm">
                  <SeverityIcon severity={r.severity} className="mt-0.5 h-4 w-4" />
                  <span><span className="font-medium text-gray-900">{r.title}.</span> <span className="text-gray-600">{r.detail}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Simulate() {
  return (
    <>
      <PageHeader title="What-if" subtitle="Test a decision before you make it. Nothing here changes your saved data." />
      <AffordCard />
      <WhatIf />
    </>
  )
}
