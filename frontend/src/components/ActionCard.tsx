import { useState } from 'react'
import { Check, CircleDashed, PlayCircle, Undo2, X } from 'lucide-react'
import { api } from '../lib/api'
import type { ActionItem, ActionStatus } from '../lib/types'
import { formatCurrency } from '../lib/format'

const PRIORITY = { 1: 'Do first', 2: 'Next', 3: 'Later' } as Record<number, string>

export function ActionCard({ action, onChange, compact = false }: {
  action: ActionItem; onChange: (a: ActionItem) => void; compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const done = action.status === 'done'
  const dismissed = action.status === 'dismissed'

  const setStatus = async (status: ActionStatus) => {
    setBusy(true)
    try {
      onChange(await api.patch<ActionItem>(`/actions/${action.id}`, { status }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex gap-3 ${compact ? '' : 'rounded-xl border border-gray-200 bg-white p-4'} ${done || dismissed ? 'opacity-60' : ''}`}>
      <button
        onClick={() => setStatus(done ? 'todo' : 'done')}
        disabled={busy}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          done ? 'border-status-good bg-status-good text-white' : 'border-gray-300 hover:border-brand-400'}`}
      >
        {done && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-medium text-gray-900 ${done ? 'line-through' : ''}`}>{action.title}</p>
          {!compact && action.status === 'doing' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-800">
              <PlayCircle className="h-3 w-3" aria-hidden /> In progress
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">{action.detail}</p>
        {!compact && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
            <span>{PRIORITY[action.priority] ?? 'Later'}</span>
            {action.impact_amount ? <span>Impact ≈ {formatCurrency(action.impact_amount)}/month</span> : null}
            <span className="ml-auto flex gap-3">
              {action.status === 'todo' && (
                <button disabled={busy} onClick={() => setStatus('doing')} className="inline-flex items-center gap-1 hover:text-gray-800">
                  <CircleDashed className="h-3.5 w-3.5" aria-hidden /> Start
                </button>
              )}
              {dismissed ? (
                <button disabled={busy} onClick={() => setStatus('todo')} className="inline-flex items-center gap-1 hover:text-gray-800">
                  <Undo2 className="h-3.5 w-3.5" aria-hidden /> Restore
                </button>
              ) : !done && (
                <button disabled={busy} onClick={() => setStatus('dismissed')} className="inline-flex items-center gap-1 hover:text-gray-800">
                  <X className="h-3.5 w-3.5" aria-hidden /> Not for me
                </button>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
