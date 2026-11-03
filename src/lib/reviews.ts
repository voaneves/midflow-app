import { api } from './api'
import { authHeaders } from './backend'
import type { Briefing, Generation } from './types'

/** Review requests ("Solicitar revisão"): the customer sends a result to the MIDFLOW team. Text only, never images. */

export type ReviewStatus = 'pending' | 'in_progress' | 'resolved'

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  resolved: 'Concluída',
}

export const COMMENT_MAX = 1000
const BRIEFING_MAX_JSON = 7_000
const OUTPUTS_MAX = 8
/** Same bounds as the server's parseOutputs: anything longer is rejected with a 400, so it is trimmed here. */
export const OUT_TITLE_MAX = 120
export const OUT_CAPTION_MAX = 2_200
export const OUT_TAGS_MAX = 15
export const OUT_TAG_LEN = 40
const BRAND_MAX = 80

export interface ReviewOutput {
  kind: 'post' | 'story'
  title: string
  caption: string
  hashtags: string[]
}

/** Text of each creative that the team reviews (first 8: the 4 posts and the 4 stories). */
export function outputsOf(gen: Generation): ReviewOutput[] {
  return [...gen.posts, ...gen.stories].slice(0, OUTPUTS_MAX).map((c) => ({
    kind: c.kind,
    title: c.headline.slice(0, OUT_TITLE_MAX),
    caption: c.caption.slice(0, OUT_CAPTION_MAX),
    hashtags: c.hashtags.slice(0, OUT_TAGS_MAX).map((h) => h.slice(0, OUT_TAG_LEN)),
  }))
}

/** The briefing as sent to the API: capped at ~8 KB of JSON by trimming the longest free-text fields first. */
export function briefingForReview(b: Briefing): Record<string, unknown> {
  const out: Record<string, unknown> = { ...b }
  for (const key of ['references', 'topics', 'audience', 'about'] as const) {
    if (new TextEncoder().encode(JSON.stringify(out)).length <= BRIEFING_MAX_JSON) break
    out[key] = String(out[key] ?? '').slice(0, 800)
  }
  return out
}

export type ReviewSendResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'rate_limit' | 'offline' | 'invalid' | 'server'; message: string }

export const REVIEW_SENT_TOAST = 'Recebemos seu pedido de revisão. Nossa equipe vai analisar.'

/** POST /api/review. Distinguishes "too many requests" and "no backend here" (static host) from real failures. */
export async function sendReviewRequest(input: {
  gen: Generation
  brandName: string
  segment: string
  briefing: Briefing
  comment: string
  contactEmail: string
}): Promise<ReviewSendResult> {
  const body = {
    brandName: input.brandName.trim().slice(0, BRAND_MAX),
    segment: input.segment,
    engine: input.gen.engine ?? 'local',
    aiErrorKind: input.gen.aiErrorKind ?? null,
    comment: input.comment.trim().slice(0, COMMENT_MAX),
    ...(input.contactEmail.trim() ? { contactEmail: input.contactEmail.trim() } : {}),
    briefing: briefingForReview(input.briefing),
    outputs: outputsOf(input.gen),
  }
  let res: Response
  try {
    res = await fetch(api('/api/review'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders().catch(() => ({}))) },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, reason: 'offline', message: 'Sem conexão com o servidor da MIDFLOW. Verifique sua internet e tente de novo.' }
  }
  const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null
  if (res.status === 201 || res.ok) return { ok: true, id: String(data?.id ?? '') }
  if (res.status === 429) return { ok: false, reason: 'rate_limit', message: 'Você enviou muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.' }
  // A static host (no API) answers 404/405 with HTML, not our JSON.
  if (!data?.error && (res.status === 404 || res.status === 405 || res.status === 501))
    return { ok: false, reason: 'offline', message: 'O envio de revisões precisa do servidor da MIDFLOW, que não está disponível nesta versão. Tente novamente mais tarde.' }
  if (res.status === 400 || res.status === 413) return { ok: false, reason: 'invalid', message: data?.error || 'Não foi possível enviar: confira o comentário e o e-mail.' }
  return { ok: false, reason: 'server', message: data?.error || 'Não foi possível enviar o pedido agora. Tente novamente em instantes.' }
}

/** One of the signed-in customer's own requests, as GET /api/reviews/mine returns it (camelCase). */
export interface MyReview {
  id: string
  createdAt: string
  updatedAt?: string
  status: ReviewStatus
  brandName: string
  comment: string | null
  resolvedAt?: string | null
  revisedOutputs?: ReviewOutput[] | null
}

/** GET /api/reviews/mine (needs a signed-in account). */
export async function fetchMyReviews(): Promise<{ ok: true; items: MyReview[] } | { ok: false; message: string }> {
  const headers = await authHeaders().catch(() => ({}) as Record<string, string>)
  if (!headers.Authorization) return { ok: false, message: 'Entre na sua conta para ver seus pedidos de revisão.' }
  try {
    const res = await fetch(api('/api/reviews/mine'), { headers })
    const data = (await res.json().catch(() => null)) as { items?: MyReview[]; error?: string } | null
    if (res.ok && Array.isArray(data?.items)) return { ok: true, items: data.items }
    return { ok: false, message: data?.error || 'Não foi possível carregar seus pedidos agora.' }
  } catch {
    return { ok: false, message: 'Sem conexão com o servidor. Tente novamente em instantes.' }
  }
}
