import { supabase } from './supabaseClient'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function toError(res: Response, method: string, path: string) {
  const body = await res.text()
  let detail = body
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed.detail === 'string') detail = parsed.detail
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, detail || `API ${method} ${path} failed: ${res.status}`)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...((options.headers as Record<string, string>) || {}),
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) throw await toError(res, options.method || 'GET', path)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** POSTs and yields the plain-text response body as it streams in. */
async function* stream(path: string, body: unknown, signal?: AbortSignal): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw await toError(res, 'POST', path)
  if (!res.body) {
    yield await res.text()
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    yield decoder.decode(value, { stream: true })
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  stream,
}
