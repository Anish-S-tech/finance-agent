import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [occupation, setOccupation] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [salaryDay, setSalaryDay] = useState('')
  const [dependents, setDependents] = useState('0')

  const submitStep1 = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/profile/onboarding/basic', { name, age: Number(age), occupation })
      setStep(2)
    } finally {
      setSubmitting(false)
    }
  }

  const submitStep2 = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/profile/onboarding/income', {
        monthly_income: Number(monthlyIncome),
        salary_day: Number(salaryDay),
      })
      setStep(3)
    } finally {
      setSubmitting(false)
    }
  }

  const submitStep3 = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/profile/onboarding/household', { num_dependents: Number(dependents) })
      setStep(4)
    } finally {
      setSubmitting(false)
    }
  }

  const loadSample = async () => {
    setSubmitting(true)
    try {
      await api.post('/finances/load-sample')
      navigate('/dashboard')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-8 flex gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-brand-600' : 'bg-gray-200'}`} />
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={submitStep1} className="space-y-4">
          <h1 className="text-xl font-medium text-gray-900">Let's get to know you</h1>
          <Field label="What should we call you?">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="How old are you?">
            <input required type="number" value={age} onChange={(e) => setAge(e.target.value)} className={inputClass} />
          </Field>
          <Field label="What do you do?">
            <input required value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputClass} />
          </Field>
          <NextButton submitting={submitting} />
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitStep2} className="space-y-4">
          <h1 className="text-xl font-medium text-gray-900">Roughly how much do you receive each month?</h1>
          <Field label="Monthly income (₹)">
            <input required type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Which day does your salary usually arrive?">
            <input required type="number" min={1} max={31} value={salaryDay} onChange={(e) => setSalaryDay(e.target.value)} className={inputClass} />
          </Field>
          <NextButton submitting={submitting} />
        </form>
      )}

      {step === 3 && (
        <form onSubmit={submitStep3} className="space-y-4">
          <h1 className="text-xl font-medium text-gray-900">Does anyone rely on your income?</h1>
          <Field label="Number of dependents">
            <input required type="number" min={0} value={dependents} onChange={(e) => setDependents(e.target.value)} className={inputClass} />
          </Field>
          <NextButton submitting={submitting} label="Continue" />
        </form>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h1 className="text-xl font-medium text-gray-900">Now, the full picture</h1>
          <p className="text-sm text-gray-600">
            To score your financial health and forecast the months ahead, FinMentor needs your regular
            expenses, any loans or EMIs, and what you're saving for. It takes about three minutes.
          </p>
          <button onClick={() => navigate('/profile?tab=expenses')}
                  className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-800">
            Add expenses, loans & goals
          </button>
          <button onClick={loadSample} disabled={submitting}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {submitting ? 'Loading…' : 'Explore first with a sample profile'}
          </button>
          <button onClick={() => navigate('/dashboard')} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
            Skip for now
          </button>
        </div>
      )}
    </div>
  )
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-gray-700">
      {label}
      {children}
    </label>
  )
}

function NextButton({ submitting, label = 'Continue' }: { submitting: boolean; label?: string }) {
  return (
    <button
      type="submit" disabled={submitting}
      className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
    >
      {submitting ? 'Saving…' : label}
    </button>
  )
}
