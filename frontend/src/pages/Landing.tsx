import { Link } from 'react-router-dom'

const features = [
  { title: 'Know before you spend', body: 'Ask "Can I afford this?" and test loans, pay cuts or emergencies before they happen.' },
  { title: 'You control your data', body: 'Choose exactly what gets stored and what AI is allowed to see, before you enter anything.' },
  { title: 'A mentor, not an article', body: 'A health score, a cash-flow forecast and a step-by-step plan, explained in plain language from your actual numbers.' },
]

const faqs = [
  { q: 'Is my financial data safe?', a: 'Your data is encrypted, access-controlled, and never shared without your explicit consent.' },
  { q: 'Do I need to enter everything up front?', a: 'No. We only ask for what\u2019s needed right now, and ask for more only when it\u2019s actually relevant.' },
  { q: 'Can I delete my data later?', a: 'Yes, at any time, from the Privacy Center \u2014 in full, not just deactivation.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl font-medium tracking-tight text-gray-900 sm:text-5xl">
          Your personal finance mentor
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          See where you stand, spot money trouble months before it happens, and get a clear plan \u2014 with your data staying under your control.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/signup" className="rounded-lg bg-brand-600 px-6 py-3 text-white hover:bg-brand-800">
            Get started
          </Link>
          <Link to="/login" className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-100">
            Log in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-base font-medium text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy-first promise */}
      <section className="bg-brand-50">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl font-medium text-gray-900">Privacy-first, by design</h2>
          <p className="mt-3 text-gray-700">
            Before we store a single number, you decide what we can keep and whether AI may ever use it.
            Nothing is collected silently.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-medium text-gray-900 text-center">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-4 text-sm text-gray-600">
          <li><span className="font-medium text-gray-900">1. Sign up</span><br />Create a secure account.</li>
          <li><span className="font-medium text-gray-900">2. Choose your privacy</span><br />Decide what we can store.</li>
          <li><span className="font-medium text-gray-900">3. Answer a few questions</span><br />Under two minutes.</li>
          <li><span className="font-medium text-gray-900">4. Get your plan</span><br />Health score, forecast and next steps.</li>
        </ol>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-medium text-gray-900 text-center">Frequently asked questions</h2>
        <div className="mt-8 space-y-6">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="font-medium text-gray-900">{f.q}</h3>
              <p className="mt-1 text-sm text-gray-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
