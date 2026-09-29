import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { useApi } from '../hooks/useApi'
import type { Savings } from '../lib/types'
import { formatCurrency, formatDate } from '../lib/format'
import { Button, Card, ErrorBanner, Field, Meter, PageHeader, inputClass } from '../components/ui'
import { FieldDef, RecordEditor } from '../components/RecordEditor'

const FREQUENCY = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_time', label: 'One-time' },
]

const TABS = [
  { key: 'income', label: 'Income' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'debts', label: 'Loans & EMIs' },
  { key: 'savings', label: 'Savings' },
  { key: 'goals', label: 'Goals' },
  { key: 'upcoming', label: 'Upcoming payments' },
] as const
type TabKey = (typeof TABS)[number]['key']

const incomeFields: FieldDef[] = [
  { key: 'label', label: 'Source', type: 'text' },
  { key: 'amount', label: 'Amount (₹)', type: 'number' },
  { key: 'frequency', label: 'How often', type: 'select', options: FREQUENCY },
  { key: 'pay_day', label: 'Day it arrives', type: 'number', optional: true, step: '1' },
  { key: 'is_primary', label: 'Main income', type: 'checkbox' },
]

const expenseFields: FieldDef[] = [
  { key: 'label', label: 'What is it?', type: 'text' },
  {
    key: 'category', label: 'Category', type: 'select', options: [
      'housing', 'food', 'transport', 'utilities', 'shopping', 'entertainment', 'health', 'education', 'other',
    ].map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) })),
  },
  { key: 'amount', label: 'Amount (₹)', type: 'number' },
  { key: 'frequency', label: 'How often', type: 'select', options: FREQUENCY },
  { key: 'is_essential', label: 'Essential (a need, not a want)', type: 'checkbox' },
]

const debtFields: FieldDef[] = [
  { key: 'label', label: 'Loan / card', type: 'text' },
  {
    key: 'debt_type', label: 'Type', type: 'select', options: [
      { value: 'home', label: 'Home loan' }, { value: 'car', label: 'Car loan' },
      { value: 'personal', label: 'Personal loan' }, { value: 'education', label: 'Education loan' },
      { value: 'credit_card', label: 'Credit card' }, { value: 'other', label: 'Other' },
    ],
  },
  { key: 'outstanding', label: 'Amount still owed (₹)', type: 'number' },
  { key: 'interest_rate', label: 'Interest rate (% per year)', type: 'number' },
  { key: 'emi', label: 'Monthly EMI / minimum due (₹)', type: 'number' },
  { key: 'emi_day', label: 'EMI day of month', type: 'number', optional: true, step: '1' },
  { key: 'remaining_months', label: 'Months left', type: 'number', optional: true, step: '1',
    hint: 'Leave blank for credit cards' },
  { key: 'credit_limit', label: 'Credit limit (₹)', type: 'number', optional: true, hint: 'Credit cards only' },
]

const goalFields: FieldDef[] = [
  { key: 'label', label: 'Goal', type: 'text' },
  { key: 'target_amount', label: 'Target amount (₹)', type: 'number' },
  { key: 'current_amount', label: 'Saved so far (₹)', type: 'number' },
  { key: 'target_date', label: 'Target date', type: 'date', optional: true },
  { key: 'monthly_contribution', label: 'Monthly contribution (₹)', type: 'number' },
  {
    key: 'priority', label: 'Priority', type: 'select', options: [
      { value: '1', label: 'High' }, { value: '2', label: 'Medium' }, { value: '3', label: 'Low' },
    ],
  },
]

const calendarFields: FieldDef[] = [
  { key: 'label', label: 'Payment', type: 'text' },
  {
    key: 'event_type', label: 'Type', type: 'select', options: [
      { value: 'other', label: 'One-off expense' }, { value: 'insurance_premium', label: 'Insurance premium' },
      { value: 'credit_card_due', label: 'Credit card bill' }, { value: 'rent', label: 'Rent' },
      { value: 'emi', label: 'EMI' }, { value: 'salary', label: 'Money coming in' },
    ],
  },
  { key: 'amount', label: 'Amount (₹)', type: 'number' },
  { key: 'due_date', label: 'Due date', type: 'date' },
  { key: 'is_recurring', label: 'Repeats (already counted in Expenses/Loans)', type: 'checkbox' },
]

const freqLabel = (f: unknown) => (f === 'yearly' ? '/yr' : f === 'one_time' ? ' once' : '/mo')

interface Completeness { overall_percent: number; missing_categories: string[]; next_question: string | null }

export default function Profile() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'income') as TabKey
  const completeness = useApi<Completeness>('/financial-context/completeness?query_context=general_health_check')
  const [confirmSample, setConfirmSample] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [version, setVersion] = useState(0)

  const refresh = () => completeness.reload()

  const loadSample = async () => {
    setSeeding(true)
    try {
      await api.post('/finances/load-sample')
      setConfirmSample(false)
      setVersion((v) => v + 1)   // remount editors so they refetch
      refresh()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <>
      <PageHeader
        title="My money"
        subtitle="Everything FinMentor knows about your finances. Only you can see this."
        action={confirmSample ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Replace your entries with the sample profile?
            <Button variant="danger" loading={seeding} onClick={loadSample}>Replace</Button>
            <Button variant="ghost" onClick={() => setConfirmSample(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmSample(true)}>
            <Sparkles className="h-4 w-4" aria-hidden /> Load sample data
          </Button>
        )}
      />

      {completeness.data && (
        <Card className="mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">Profile completeness</span>
            <span className="text-gray-500">{Math.round(completeness.data.overall_percent)}%</span>
          </div>
          <div className="mt-2"><Meter value={completeness.data.overall_percent} label="Profile completeness" /></div>
          {completeness.data.next_question && (
            <p className="mt-2 text-sm text-gray-600">Next: {completeness.data.next_question}</p>
          )}
        </Card>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
                  onClick={() => setParams({ tab: t.key })}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t.key
                    ? 'border-brand-600 font-medium text-brand-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div key={`${tab}-${version}`}>
        {tab === 'income' && (
          <RecordEditor endpoint="/finances/income" fields={incomeFields} addLabel="Add income" onChanged={refresh}
                        empty={{ label: '', amount: '', frequency: 'monthly', pay_day: '', is_primary: false }}
                        summary={(r) => ({
                          title: String(r.label),
                          detail: `${r.is_primary ? 'Main income · ' : ''}${r.pay_day ? `arrives on day ${r.pay_day}` : 'no fixed day'}`,
                          amount: `${formatCurrency(r.amount as number)}${freqLabel(r.frequency)}`,
                        })} />
        )}
        {tab === 'expenses' && (
          <RecordEditor endpoint="/finances/expenses" fields={expenseFields} addLabel="Add expense" onChanged={refresh}
                        empty={{ label: '', category: 'other', amount: '', frequency: 'monthly', is_essential: true }}
                        summary={(r) => ({
                          title: String(r.label),
                          detail: `${String(r.category)} · ${r.is_essential ? 'need' : 'want'}`,
                          amount: `${formatCurrency(r.amount as number)}${freqLabel(r.frequency)}`,
                        })} />
        )}
        {tab === 'debts' && (
          <RecordEditor endpoint="/finances/debts" fields={debtFields} addLabel="Add loan or card" onChanged={refresh}
                        empty={{ label: '', debt_type: 'personal', outstanding: '', interest_rate: '', emi: '',
                                 emi_day: '', remaining_months: '', credit_limit: '' }}
                        summary={(r) => ({
                          title: String(r.label),
                          detail: `${formatCurrency(r.outstanding as number)} owed at ${r.interest_rate}%`
                            + (r.remaining_months ? ` · ${r.remaining_months} months left` : ''),
                          amount: `${formatCurrency(r.emi as number)}/mo`,
                        })} />
        )}
        {tab === 'savings' && <SavingsForm onSaved={refresh} />}
        {tab === 'goals' && (
          <RecordEditor endpoint="/finances/goals" fields={goalFields} addLabel="Add goal" onChanged={refresh}
                        empty={{ label: '', target_amount: '', current_amount: 0, target_date: '',
                                 monthly_contribution: 0, priority: '2' }}
                        summary={(r) => ({
                          title: String(r.label),
                          detail: `${formatCurrency(r.current_amount as number)} of ${formatCurrency(r.target_amount as number)}`
                            + (r.target_date ? ` by ${formatDate(r.target_date as string)}` : ''),
                          amount: `${formatCurrency(r.monthly_contribution as number)}/mo`,
                        })} />
        )}
        {tab === 'upcoming' && (
          <>
            <p className="mb-3 text-sm text-gray-500">
              One-off bills and big payments coming up. They show up in your cash-flow forecast in the month they're due.
            </p>
            <RecordEditor endpoint="/calendar" fields={calendarFields} addLabel="Add payment"
                          empty={{ label: '', event_type: 'other', amount: '', due_date: '', is_recurring: false }}
                          summary={(r) => ({
                            title: String(r.label),
                            detail: `${formatDate(r.due_date as string)}${r.is_recurring ? ' · recurring' : ''}`,
                            amount: formatCurrency(r.amount as number),
                          })} />
          </>
        )}
      </div>
    </>
  )
}

function SavingsForm({ onSaved }: { onSaved: () => void }) {
  const { data, error } = useApi<Savings>('/finances/savings')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) {
      setValues(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === null ? '' : String(v)])))
    }
  }, [data])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/finances/savings', Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])))
      setSaved(true)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false)
    setValues((v) => ({ ...v, [k]: e.target.value }))
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white p-4">
      <ErrorBanner message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bank balance / cash (₹)" hint="Money you can spend today">
          <input type="number" min={0} value={values.current_savings ?? ''} onChange={set('current_savings')} className={inputClass} />
        </Field>
        <Field label="Emergency fund (₹)" hint="Set aside only for emergencies">
          <input type="number" min={0} value={values.emergency_fund ?? ''} onChange={set('emergency_fund')} className={inputClass} />
        </Field>
        <Field label="Long-term investments (₹)" hint="Mutual funds, PPF, stocks — not counted as emergency money">
          <input type="number" min={0} value={values.investments ?? ''} onChange={set('investments')} className={inputClass} />
        </Field>
        <Field label="Health insurance cover (₹)" hint="Sum insured; leave blank if none">
          <input type="number" min={0} value={values.health_insurance_cover ?? ''} onChange={set('health_insurance_cover')} className={inputClass} />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" loading={saving}>Save</Button>
        {saved && <span className="text-sm text-status-good-text">Saved</span>}
      </div>
    </form>
  )
}
