import { FormEvent, ReactNode, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useApi } from '../hooks/useApi'
import { Button, ErrorBanner, Field, Spinner, inputClass } from './ui'

export type FieldDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date'
  options?: { value: string; label: string }[]
  optional?: boolean
  hint?: string
  step?: string
}

type Row = Record<string, unknown> & { id?: string }

/**
 * List + add/edit/delete form for one structured-profile table.
 * `endpoint` must support GET list, POST create, and (if editable) PUT/DELETE /{id}.
 */
export function RecordEditor({ endpoint, fields, empty, summary, addLabel, editable = true, onChanged }: {
  endpoint: string
  fields: FieldDef[]
  empty: Row
  summary: (row: Row) => { title: string; detail: ReactNode; amount?: ReactNode }
  addLabel: string
  editable?: boolean
  onChanged?: () => void
}) {
  const { data, error, loading, reload } = useApi<Row[]>(endpoint)
  const [form, setForm] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setFormError(null)
    const payload: Row = {}
    for (const f of fields) {
      const v = form[f.key]
      if (f.type === 'number') payload[f.key] = v === '' || v === null || v === undefined ? null : Number(v)
      else if (f.type === 'checkbox') payload[f.key] = Boolean(v)
      else payload[f.key] = v === '' ? null : v
    }
    try {
      if (form.id) await api.put(`${endpoint}/${form.id}`, payload)
      else await api.post(endpoint, payload)
      setForm(null)
      await reload()
      onChanged?.()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    await api.delete(`${endpoint}/${id}`)
    await reload()
    onChanged?.()
  }

  if (loading && !data) return <Spinner />

  return (
    <div>
      <ErrorBanner message={error} />
      {data && data.length > 0 ? (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {data.map((row) => {
            const s = summary(row)
            return (
              <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-500">{s.detail}</p>
                </div>
                {s.amount && <p className="text-sm font-medium tabular-nums text-gray-900">{s.amount}</p>}
                {editable && (
                  <div className="flex gap-1">
                    <button onClick={() => setForm({ ...row })} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            aria-label={`Edit ${s.title}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => row.id && remove(row.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Delete ${s.title}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
          Nothing added yet.
        </p>
      )}

      {form ? (
        <form onSubmit={submit} className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <ErrorBanner message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <FieldInput key={f.key} def={f} value={form[f.key]}
                          onChange={(v) => setForm((cur) => ({ ...(cur as Row), [f.key]: v }))} />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" loading={saving}>{form.id ? 'Save changes' : 'Add'}</Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" className="mt-4" onClick={() => setForm({ ...empty })}>
          <Plus className="h-4 w-4" aria-hidden /> {addLabel}
        </Button>
      )}
    </div>
  )
}

function FieldInput({ def, value, onChange }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (def.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)}
               className="h-4 w-4 rounded border-gray-300 text-brand-600" />
        {def.label}
      </label>
    )
  }
  const str = value === null || value === undefined ? '' : String(value)
  return (
    <Field label={def.label + (def.optional ? ' (optional)' : '')} hint={def.hint}>
      {def.type === 'select' ? (
        <select value={str} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {def.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={def.type}
          value={str}
          step={def.step ?? (def.type === 'number' ? 'any' : undefined)}
          min={def.type === 'number' ? 0 : undefined}
          required={!def.optional}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </Field>
  )
}
