import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

type ConsentKey =
  | 'store_salary'
  | 'store_expenses'
  | 'store_bank_account'
  | 'ai_recommendations'
  | 'share_analytics'
  | 'document_processing'

interface ConsentOption {
  key: ConsentKey
  label: string
  description: string
  defaultValue: boolean
}

const CONSENT_OPTIONS: ConsentOption[] = [
  { key: 'store_salary', label: 'Store salary', description: 'Needed to show your dashboard and calendar.', defaultValue: true },
  { key: 'store_expenses', label: 'Store expenses', description: 'Helps estimate what you can safely spend.', defaultValue: true },
  { key: 'store_bank_account', label: 'Store bank account number', description: 'Not required \u2014 we never need your account number for Phase 1.', defaultValue: false },
  { key: 'ai_recommendations', label: 'Use my data for recommendations', description: 'Lets FinMentor build your action plan and lets the mentor chat explain your numbers. When you chat, a summary of your numbers (no account details) is sent to Google Gemini to write the reply.', defaultValue: true },
  { key: 'share_analytics', label: 'Share anonymous usage analytics', description: 'Helps us improve the product. Never includes your financial figures.', defaultValue: false },
  { key: 'document_processing', label: 'Allow document processing', description: 'Needed only if you later upload documents for analysis.', defaultValue: false },
]

export default function Consent() {
  const navigate = useNavigate()
  const [choices, setChoices] = useState<Record<ConsentKey, boolean>>(
    Object.fromEntries(CONSENT_OPTIONS.map((o) => [o.key, o.defaultValue])) as Record<ConsentKey, boolean>
  )
  const [submitting, setSubmitting] = useState(false)

  const toggle = (key: ConsentKey) => setChoices((c) => ({ ...c, [key]: !c[key] }))

  const handleContinue = async () => {
    setSubmitting(true)
    try {
      await Promise.all(
        CONSENT_OPTIONS.map((o) =>
          api.put('/privacy', { consent_key: o.key, granted: choices[o.key] })
        )
      )
      navigate('/onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-medium text-gray-900">Before we start, your choice</h1>
      <p className="mt-2 text-sm text-gray-600">
        Choose what we can store and use. You can change any of this later in the Privacy Center.
      </p>

      <div className="mt-8 space-y-4">
        {CONSENT_OPTIONS.map((o) => (
          <label
            key={o.key}
            className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:border-gray-300"
          >
            <input
              type="checkbox"
              checked={choices[o.key]}
              onChange={() => toggle(o.key)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">{o.label}</span>
              <span className="block text-sm text-gray-500">{o.description}</span>
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={handleContinue}
        disabled={submitting}
        className="mt-8 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Continue'}
      </button>
    </div>
  )
}
