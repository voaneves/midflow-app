import { api } from './api'
import { authHeaders } from './backend'
import type { ReviewOutput, ReviewStatus } from './reviews'

/**
 * Client for the staff API (/api/admin/*). The server decides what each role may do; this module only
 * attaches the credential and turns answers into typed results with pt-BR messages.
 */

export type StaffRole = 'admin' | 'editor'
export type AiRange = '24h' | '7d' | '30d'

/** A signed-in account (Supabase session) or the break-glass ADMIN_TOKEN. */
export type Credential = { kind: 'session' } | { kind: 'token'; token: string }

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

const TOKEN_KEY = 'mf.admin-token'

/** The access token lives in sessionStorage only (gone when the tab closes). */
export function readStoredToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}
export function storeToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage blocked: the token only lives in memory for this page.
  }
}

const DEFAULT_ERROR: Record<number, string> = {
  0: 'Sem conexão com o servidor da MIDFLOW. Tente novamente em instantes.',
  400: 'Dados inválidos. Confira e tente de novo.',
  401: 'Sessão ou token inválido. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Não encontrado. O painel da equipe pode não estar ativado neste servidor.',
  409: 'Esta ação não pode ser concluída.',
  429: 'Muitas tentativas. Aguarde um instante.',
  501: 'Este recurso precisa do banco de dados, que não está configurado neste ambiente.',
}

async function call<T>(cred: Credential, method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const auth = cred.kind === 'token' ? { Authorization: `Bearer ${cred.token}` } : await authHeaders()
    const res = await fetch(api(path), {
      method,
      headers: { ...auth, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (res.ok && data !== null) return { ok: true, data }
    // A static host answers HTML 404/405: there is no API there.
    // The server's own "Not found" (staff access not configured) is English; show the pt-BR default instead.
    const serverMsg = data?.error && !/^not found$/i.test(data.error) ? data.error : ''
    const error = serverMsg || (res.status >= 500 ? 'O servidor não respondeu. Tente novamente em instantes.' : DEFAULT_ERROR[res.status] || 'Não foi possível concluir agora.')
    return { ok: false, status: res.status, error }
  } catch {
    return { ok: false, status: 0, error: DEFAULT_ERROR[0] }
  }
}

export interface Me {
  role: StaffRole
  userId: string | null
  via: 'token' | 'session'
}

/** One review request as the staff API returns it (camelCase). The queue list omits `briefing` / `outputs`; the detail has them. */
export interface AdminReview {
  id: string
  createdAt: string
  updatedAt?: string
  userId?: string | null
  status: ReviewStatus
  brandName: string
  segment: string | null
  engine: string | null
  aiErrorKind: string | null
  comment: string | null
  contactEmail: string | null
  adminNote: string | null
  assignedTo: string | null
  resolvedAt: string | null
  briefing?: unknown
  outputs?: unknown
  revisedOutputs?: unknown
}

export interface ReviewAuditEvent {
  id: string
  review_id: string
  actor_label: string
  action: string
  from_status: string | null
  to_status: string | null
  note: string | null
  created_at: string
}

export interface StaffMember {
  userId: string
  email: string
  name?: string | null
  role: StaffRole
  createdAt: string
  createdBy?: string | null
}

export interface AiHealth {
  range: AiRange
  storage: 'supabase' | 'events'
  totals: { calls: number; ok: number; fallback: number; successRate: number | null; fallbackByKind: { transient: number; daily_cap: number; config: number } }
  latency: { p50: number | null; p95: number | null }
  quality: { avg: number | null; belowThreshold: number }
  images: { ai: number; stock: number; procedural: number }
  dailyCap: { text: { used: number; max: number | null }; images: { used: number; max: number | null } }
  providers: { name: string; configured: boolean; model: string | null }[]
  lastError: { at: number; route: string; outcome: string; errorCode: string | null } | null
  series: { bucket: string; calls: number; ok: number; fallback: number; p95: number | null }[]
}

export interface Metrics {
  periodDays: number
  generations: number
  businesses: number
  aiShare: number | null
  avgQualityAI: number | null
  avgQualityAll: number | null
  avgLatencyMs: number | null
  ratings: { count: number; average: number | null }
  usage: Record<string, number>
  aiUnavailable?: { total: number; transient: number; daily_cap: number; config: number }
  reviewRequests?: number
  aiErrors: { at: string | number; error: string }[]
  topIssues: { issue: string; n: number }[]
  recentFeedback: { at: string | number; rating: number; comment: string; brandName?: string }[]
}

export const staffApi = {
  me: (c: Credential) => call<Me>(c, 'GET', '/api/admin/me'),
  reviews: (c: Credential, f: { status?: ReviewStatus | '' }) => {
    const qs = f.status ? `?status=${encodeURIComponent(f.status)}` : ''
    return call<{ items: AdminReview[]; storage: 'supabase' | 'events' }>(c, 'GET', `/api/admin/reviews${qs}`)
  },
  /** Full request (briefing, original texts, delivered revision) plus its audit trail. */
  review: (c: Credential, id: string) =>
    call<{ item: AdminReview; events: ReviewAuditEvent[]; storage: 'supabase' | 'events' }>(c, 'GET', `/api/admin/reviews/${encodeURIComponent(id)}`),
  patchReview: (c: Credential, id: string, patch: { status?: ReviewStatus; adminNote?: string | null; assignedTo?: string | null }) =>
    call<{ item: AdminReview }>(c, 'PATCH', `/api/admin/reviews/${encodeURIComponent(id)}`, patch),
  sendRevision: (c: Credential, id: string, outputs: ReviewOutput[]) =>
    call<{ item: AdminReview }>(c, 'POST', `/api/admin/reviews/${encodeURIComponent(id)}/revision`, { outputs }),
  metrics: (c: Credential) => call<Metrics>(c, 'GET', '/api/admin/metrics'),
  aiHealth: (c: Credential, range: AiRange) => call<AiHealth>(c, 'GET', `/api/admin/ai-health?range=${range}`),
  testAi: (c: Credential) => call<{ ok: boolean; provider?: string; model?: string; latencyMs?: number; message?: string }>(c, 'POST', '/api/test-ai', {}),
  staff: (c: Credential) => call<{ items: StaffMember[] }>(c, 'GET', '/api/admin/staff'),
  addStaff: (c: Credential, email: string, role: StaffRole) => call<{ staff: StaffMember }>(c, 'POST', '/api/admin/staff', { email, role }),
  removeStaff: (c: Credential, userId: string) => call<{ success: boolean }>(c, 'DELETE', `/api/admin/staff/${encodeURIComponent(userId)}`),
}

/** Reads the briefing and the original texts out of a review (present on the detail answer, not on the queue list). */
export function parsePayload(item: Pick<AdminReview, 'briefing' | 'outputs'>): { briefing: Record<string, unknown> | null; outputs: ReviewOutput[] } {
  const briefing = item.briefing && typeof item.briefing === 'object' && !Array.isArray(item.briefing) ? (item.briefing as Record<string, unknown>) : null
  return { briefing, outputs: cleanOutputs(item.outputs) }
}

export function cleanOutputs(v: unknown): ReviewOutput[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map((o) => ({
      kind: o.kind === 'story' ? ('story' as const) : ('post' as const),
      title: String(o.title ?? ''),
      caption: String(o.caption ?? ''),
      hashtags: Array.isArray(o.hashtags) ? o.hashtags.map(String) : [],
    }))
}
