import { CalendarRange, CreditCard, PiggyBank, RefreshCw, Scissors, Target, UserRound } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import type { ActionItem, FocusArea } from '../lib/types'
import { formatCurrency } from '../lib/format'
import { ActionCard } from '../components/ActionCard'
import { Button, EmptyState, ErrorBanner, Meter, PageHeader, Spinner } from '../components/ui'

const AREAS: { key: FocusArea; title: string; icon: typeof Scissors }[] = [
  { key: 'profile', title: 'Complete your profile', icon: UserRound },
  { key: 'cashflow', title: 'Get through the next few months', icon: CalendarRange },
  { key: 'spend', title: 'Spend less', icon: Scissors },
  { key: 'save', title: 'Save & protect', icon: PiggyBank },
  { key: 'debt', title: 'Manage debt', icon: CreditCard },
  { key: 'goals', title: 'Reach your goals', icon: Target },
]

export default function Plan() {
  const { data, error, loading, reload, setData } = useApi<ActionItem[]>('/actions')

  const onChange = (updated: ActionItem) =>
    setData((cur) => cur?.map((a) => (a.id === updated.id ? updated : a)) ?? cur)

  if (loading && !data) return <Spinner label="Building your plan…" />

  const active = data?.filter((a) => a.status !== 'dismissed') ?? []
  const done = active.filter((a) => a.status === 'done').length
  const freed = active.filter((a) => a.status === 'done' && a.focus_area === 'spend')
    .reduce((s, a) => s + (a.impact_amount ?? 0), 0)
  const dismissed = data?.filter((a) => a.status === 'dismissed') ?? []

  return (
    <>
      <PageHeader
        title="Your action plan"
        subtitle="Specific steps, in the order that matters most. It updates whenever your numbers change."
        action={<Button variant="secondary" onClick={reload} loading={loading}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
        </Button>}
      />
      <ErrorBanner message={error} />

      {data && data.length === 0 && (
        <EmptyState title="Nothing to do right now" body="Your finances look healthy. Check back after your numbers change." />
      )}

      {active.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-900">{done} of {active.length} steps done</span>
            {freed > 0 && <span className="text-status-good-text">{formatCurrency(freed)}/month freed up</span>}
          </div>
          <div className="mt-2"><Meter value={(done / active.length) * 100} label="Plan progress" /></div>
        </div>
      )}

      <div className="space-y-8">
        {AREAS.map(({ key, title, icon: Icon }) => {
          const items = active.filter((a) => a.focus_area === key)
          if (!items.length) return null
          return (
            <section key={key}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-gray-500">
                <Icon className="h-4 w-4" aria-hidden /> {title}
              </h2>
              <div className="space-y-3">
                {items.map((a) => <ActionCard key={a.id} action={a} onChange={onChange} />)}
              </div>
            </section>
          )
        })}

        {dismissed.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500">{dismissed.length} dismissed</summary>
            <div className="mt-3 space-y-3">
              {dismissed.map((a) => <ActionCard key={a.id} action={a} onChange={onChange} />)}
            </div>
          </details>
        )}
      </div>
    </>
  )
}
