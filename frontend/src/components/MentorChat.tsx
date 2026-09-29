import { FormEvent, Fragment, ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { MentorMessage } from '../lib/types'

const SUGGESTIONS = [
  'Why is my health score what it is?',
  'Can I afford a ₹60,000 phone?',
  'What should I fix first?',
  'Will I run short of money in the next few months?',
  'How fast can I clear my credit card?',
]

type ChatMessage = Pick<MentorMessage, 'role' | 'content'> & { id: string }

export function MentorChat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<{ text: string; consent?: boolean } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    api.get<MentorMessage[]>('/mentor/history').then(setMessages).catch(() => {})
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || streaming) return
    setInput('')
    setError(null)
    setStreaming(true)
    const replyId = `a-${Date.now()}`
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: message },
                         { id: replyId, role: 'assistant', content: '' }])
    abortRef.current = new AbortController()
    try {
      for await (const chunk of api.stream('/mentor/chat', { message }, abortRef.current.signal)) {
        setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: x.content + chunk } : x)))
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setMessages((m) => m.filter((x) => x.id !== replyId || x.content))
      const consent = e instanceof ApiError && e.status === 403
      setError({ text: (e as Error).message, consent })
    } finally {
      setStreaming(false)
    }
  }

  const clear = async () => {
    await api.delete('/mentor/history')
    setMessages([])
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Grounded in your data · numbers computed by FinMentor
        </span>
        {messages.length > 0 && (
          <button onClick={clear} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className={compact ? 'py-4' : 'py-10'}>
            <div className="flex items-center gap-2 text-gray-900">
              <Sparkles className="h-5 w-5 text-brand-600" aria-hidden />
              <p className="font-medium">Ask me anything about your money</p>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              I explain your own numbers — your score, risks, forecast and plan — in plain language.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-left text-sm text-gray-700 hover:border-brand-400 hover:text-brand-800">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === 'user' ? 'bg-brand-600 text-white' : 'border border-gray-200 bg-white text-gray-800'}`}>
              {m.content ? <RichText text={m.content} /> : <TypingDots />}
            </div>
          </div>
        ))}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error.text}
            {error.consent && (
              <Link to="/consent" className="ml-1 font-medium underline">Update privacy choices</Link>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-gray-100 pt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Can I afford a ₹1.5 lakh bike on EMI for 24 months?"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          maxLength={2000}
          aria-label="Message FinMentor"
        />
        <button type="submit" disabled={streaming || !input.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
                aria-label="Send">
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="FinMentor is typing">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
}

/** Minimal markdown: paragraphs, "- " bullets, **bold**, _italic_. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
          {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
        </ul>,
      )
      bullets = []
    }
  }
  text.split('\n').forEach((line) => {
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
    if (bullet) {
      bullets.push(bullet[1])
      return
    }
    flush()
    if (line.trim()) blocks.push(<p key={`p-${blocks.length}`} className="my-1">{inline(line)}</p>)
  })
  flush()
  return <>{blocks}</>
}

function inline(s: string): ReactNode {
  return s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) return <em key={i} className="text-gray-500">{part.slice(1, -1)}</em>
    return <Fragment key={i}>{part}</Fragment>
  })
}
