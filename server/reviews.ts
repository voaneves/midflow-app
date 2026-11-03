/**
 * Review requests ("Solicitar revisão"): a customer asks the studio team to look at a generation they are not happy with.
 *
 * Storage: Supabase table `review_requests` (service role) when configured; otherwise the request is only appended to
 * the event log (type "review_request"; on the Cloudflare Worker that means Workers Logs only, no queue, no updates).
 * Every status change, assignment and revision also writes a row to `review_events` (audit trail).
 */
import { randomUUID } from 'node:crypto'
import type { StaffRole } from './authz.ts'
import { dbEq, dbHeaders, dbRequest, type DbConfig, type Fetch } from './db/supabase.ts'
import { HttpError } from './http.ts'
import { logEvent, readEvents } from './telemetry.ts'

export const REVIEW_STATUSES = ['pending', 'in_progress', 'resolved'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]
export const isReviewStatus = (v: unknown): v is ReviewStatus => REVIEW_STATUSES.includes(v as ReviewStatus)

const AI_ERROR_KINDS = ['transient', 'daily_cap', 'config'] as const
export type ReviewAiErrorKind = (typeof AI_ERROR_KINDS)[number]

export const REVIEW_BODY_BYTES = 48 * 1024
const COMMENT_MAX = 1000
const BRIEFING_MAX_BYTES = 8 * 1024
const NOTE_MAX = 2000
const MAX_OUTPUTS = 8
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9-]{1,40}$/i
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,120}\.[^\s@<>"']{2,24}$/

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

export interface ReviewOutput {
  kind: 'post' | 'story'
  title: string
  caption: string
  hashtags: string[]
}

export interface ReviewInput {
  brandName: string
  segment: string
  engine: string
  aiErrorKind: ReviewAiErrorKind | null
  comment: string
  contactEmail: string | null
  briefing: Record<string, unknown>
  outputs: ReviewOutput[]
}

/* ---------------- sanitizing ---------------- */

/** Drops control characters (keeps newline and tab), trims and caps the length. */
// eslint-disable-next-line no-control-regex
const cleanText = (v: string, max: number) => v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max)

function cleanJson(v: unknown, depth = 0): unknown {
  if (v === null || typeof v === 'boolean') return v
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') return cleanText(v, 500)
  if (depth >= 4) return undefined
  if (Array.isArray(v)) return v.slice(0, 30).map((x) => cleanJson(x, depth + 1)).filter((x) => x !== undefined)
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 40)) {
      if (!/^[\w .-]{1,40}$/.test(k) || k === '__proto__') continue
      const c = cleanJson(val, depth + 1)
      if (c !== undefined) out[k] = c
    }
    return out
  }
  return undefined
}

const bad = (message: string) => new HttpError(400, message)

/** Validates 1..8 outputs {kind, title, caption, hashtags}. Used by review requests and by editors' revisions. */
export function parseOutputs(raw: unknown, { required }: { required: boolean }): ReviewOutput[] {
  if (raw === undefined || raw === null) {
    if (required) throw bad('Envie os criativos (outputs).')
    return []
  }
  if (!Array.isArray(raw)) throw bad('outputs deve ser uma lista.')
  if (raw.length > MAX_OUTPUTS || (required && raw.length === 0)) throw bad(`outputs deve ter de 1 a ${MAX_OUTPUTS} itens.`)
  return raw.map((o, i) => {
    if (!o || typeof o !== 'object') throw bad(`Criativo ${i + 1} inválido.`)
    const { kind, title, caption, hashtags } = o as Record<string, unknown>
    if (kind !== 'post' && kind !== 'story') throw bad(`Criativo ${i + 1}: tipo inválido.`)
    if (typeof title !== 'string' || title.length > 120) throw bad(`Criativo ${i + 1}: título inválido (máx. 120 caracteres).`)
    if (typeof caption !== 'string' || caption.length > 2200) throw bad(`Criativo ${i + 1}: legenda inválida (máx. 2200 caracteres).`)
    if (hashtags !== undefined && (!Array.isArray(hashtags) || hashtags.length > 15 || hashtags.some((h) => typeof h !== 'string' || h.length > 40))) {
      throw bad(`Criativo ${i + 1}: hashtags inválidas (máx. 15, 40 caracteres cada).`)
    }
    return {
      kind,
      title: cleanText(title, 120),
      caption: cleanText(caption, 2200),
      hashtags: ((hashtags as string[] | undefined) ?? []).map((h) => cleanText(h, 40)).filter(Boolean),
    }
  })
}

/** Validates the public POST /api/review body. Throws HttpError 400 (pt-BR) on anything out of bounds. */
export function parseReviewRequest(body: unknown): ReviewInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Corpo da requisição inválido.')
  const b = body as Record<string, unknown>

  if (typeof b.brandName !== 'string' || !b.brandName.trim() || b.brandName.length > 80) throw bad('Informe o nome da marca (até 80 caracteres).')
  const segment = typeof b.segment === 'string' && SLUG.test(b.segment) ? b.segment : 'outro'
  const engine = typeof b.engine === 'string' && /^[\w-]{1,20}$/.test(b.engine) ? b.engine : 'template'
  if (b.aiErrorKind !== undefined && b.aiErrorKind !== null && !AI_ERROR_KINDS.includes(b.aiErrorKind as ReviewAiErrorKind)) throw bad('aiErrorKind inválido.')

  if (b.comment !== undefined && b.comment !== null && typeof b.comment !== 'string') throw bad('Comentário inválido.')
  const comment = typeof b.comment === 'string' ? b.comment : ''
  if (comment.length > COMMENT_MAX) throw bad(`O comentário pode ter no máximo ${COMMENT_MAX} caracteres.`)

  let contactEmail: string | null = null
  if (b.contactEmail !== undefined && b.contactEmail !== null && b.contactEmail !== '') {
    if (typeof b.contactEmail !== 'string' || !EMAIL.test(b.contactEmail.trim())) throw bad('E-mail de contato inválido.')
    contactEmail = b.contactEmail.trim().toLowerCase()
  }

  if (!b.briefing || typeof b.briefing !== 'object' || Array.isArray(b.briefing)) throw bad('Envie o briefing (objeto).')
  if (Buffer.byteLength(JSON.stringify(b.briefing), 'utf-8') > BRIEFING_MAX_BYTES) throw bad('Briefing grande demais (máx. 8 KB).')

  return {
    brandName: cleanText(b.brandName, 80),
    segment,
    engine,
    aiErrorKind: (b.aiErrorKind as ReviewAiErrorKind | null | undefined) ?? null,
    comment: cleanText(comment, COMMENT_MAX),
    contactEmail,
    briefing: cleanJson(b.briefing) as Record<string, unknown>,
    outputs: parseOutputs(b.outputs, { required: false }),
  }
}

/* ---------------- items ---------------- */

export interface ReviewRow {
  id: string
  created_at: string
  updated_at: string
  user_id: string | null
  status: ReviewStatus
  brand_name: string
  segment: string | null
  engine: string | null
  ai_error_kind: string | null
  comment: string | null
  contact_email: string | null
  payload?: { briefing?: unknown; outputs?: unknown } | null
  admin_note: string | null
  assigned_to: string | null
  revised_outputs?: unknown
  resolved_at: string | null
}

/** Columns for the queue listing: no payload / outputs, which can be large. */
const LIST_COLUMNS =
  'id,created_at,updated_at,user_id,status,brand_name,segment,engine,ai_error_kind,comment,contact_email,admin_note,assigned_to,resolved_at'

export function toItem(r: ReviewRow) {
  return {
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    userId: r.user_id,
    status: r.status,
    brandName: r.brand_name,
    segment: r.segment,
    engine: r.engine,
    aiErrorKind: r.ai_error_kind,
    comment: r.comment,
    contactEmail: r.contact_email,
    adminNote: r.admin_note,
    assignedTo: r.assigned_to,
    resolvedAt: r.resolved_at,
    ...(r.payload !== undefined ? { briefing: r.payload?.briefing ?? null, outputs: r.payload?.outputs ?? [] } : {}),
    ...(r.revised_outputs !== undefined ? { revisedOutputs: r.revised_outputs ?? null } : {}),
  }
}
export type ReviewItem = ReturnType<typeof toItem>

/* ---------------- create ---------------- */

export async function createReview(input: ReviewInput, userId: string | null, db: DbConfig | null, f: Fetch = fetch): Promise<{ id: string; storage: 'supabase' | 'events' }> {
  const id = randomUUID()
  if (db) {
    await dbRequest(
      db,
      'review_requests',
      {
        method: 'POST',
        headers: dbHeaders(db, { Prefer: 'return=minimal' }),
        body: JSON.stringify({
          id,
          user_id: userId,
          brand_name: input.brandName,
          segment: input.segment,
          engine: input.engine,
          ai_error_kind: input.aiErrorKind,
          comment: input.comment,
          contact_email: input.contactEmail,
          payload: { briefing: input.briefing, outputs: input.outputs },
        }),
      },
      f,
    )
    return { id, storage: 'supabase' }
  }
  logEvent({
    type: 'review_request',
    reviewId: id,
    userId,
    brandName: input.brandName,
    segment: input.segment,
    engine: input.engine,
    aiErrorKind: input.aiErrorKind,
    comment: input.comment,
    // Sizes only: the log must not hold the contact e-mail or the briefing (see sanitizeEvent in telemetry.ts).
    hasContact: !!input.contactEmail,
    briefingBytes: Buffer.byteLength(JSON.stringify(input.briefing), 'utf-8'),
    outputs: input.outputs,
  })
  return { id, storage: 'events' }
}

/* ---------------- admin reads ---------------- */

export async function listReviews(db: DbConfig | null, status: ReviewStatus | null, f: Fetch = fetch) {
  if (db) {
    const filter = status ? `&status=eq.${status}` : ''
    const rows = (await dbRequest(db, `review_requests?select=${LIST_COLUMNS}${filter}&order=created_at.desc&limit=100`, { headers: dbHeaders(db) }, f)) as ReviewRow[]
    return { items: rows.map(toItem), storage: 'supabase' as const }
  }
  const items = status && status !== 'pending' ? [] : fromEvents().slice(0, 100).map(({ briefing: _b, outputs: _o, ...rest }) => rest)
  return { items, storage: 'events' as const }
}

function fromEvents() {
  return readEvents(0)
    .filter((e) => e.type === 'review_request')
    .reverse()
    .map((e) => ({
      id: String(e.reviewId),
      createdAt: new Date(e.at).toISOString(),
      updatedAt: new Date(e.at).toISOString(),
      userId: (e.userId as string | null) ?? null,
      status: 'pending' as ReviewStatus,
      brandName: String(e.brandName ?? ''),
      segment: (e.segment as string) ?? null,
      engine: (e.engine as string) ?? null,
      aiErrorKind: (e.aiErrorKind as string) ?? null,
      comment: (e.comment as string) ?? null,
      contactEmail: null,
      adminNote: null,
      assignedTo: null,
      resolvedAt: null,
      briefing: null,
      outputs: e.outputs ?? [],
    }))
}

async function fetchRow(db: DbConfig, id: string, f: Fetch): Promise<ReviewRow> {
  const rows = (await dbRequest(db, `review_requests?id=${dbEq(id)}&select=*&limit=1`, { headers: dbHeaders(db) }, f)) as ReviewRow[]
  if (!rows[0]) throw new HttpError(404, 'Pedido de revisão não encontrado.')
  return rows[0]
}

export interface ReviewAuditEvent {
  id: string
  review_id: string
  actor_id: string | null
  actor_label: string
  action: string
  from_status: string | null
  to_status: string | null
  note: string | null
  created_at: string
}

export async function getReview(db: DbConfig | null, id: string, f: Fetch = fetch) {
  if (!db) {
    const item = fromEvents().find((i) => i.id === id)
    if (!item) throw new HttpError(404, 'Pedido de revisão não encontrado.')
    return { item, events: [] as ReviewAuditEvent[], storage: 'events' as const }
  }
  const row = await fetchRow(db, id, f)
  const events = (await dbRequest(db, `review_events?review_id=${dbEq(id)}&select=*&order=created_at.asc&limit=200`, { headers: dbHeaders(db) }, f)) as ReviewAuditEvent[]
  return { item: toItem(row), events, storage: 'supabase' as const }
}

/* ---------------- admin writes ---------------- */

export interface ReviewActor {
  role: StaffRole
  /** null for the ADMIN_TOKEN identity. */
  userId: string | null
  label: string
}

export interface ReviewPatch {
  status?: ReviewStatus
  adminNote?: string | null
  assignedTo?: string | null
}

export function parseReviewPatch(body: unknown): ReviewPatch {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Corpo da requisição inválido.')
  const b = body as Record<string, unknown>
  const patch: ReviewPatch = {}
  if (b.status !== undefined) {
    if (!isReviewStatus(b.status)) throw bad('Status inválido. Use pending, in_progress ou resolved.')
    patch.status = b.status
  }
  if (b.adminNote !== undefined) {
    if (b.adminNote !== null && (typeof b.adminNote !== 'string' || b.adminNote.length > NOTE_MAX)) throw bad(`A nota pode ter no máximo ${NOTE_MAX} caracteres.`)
    patch.adminNote = b.adminNote === null ? null : cleanText(b.adminNote, NOTE_MAX)
  }
  if (b.assignedTo !== undefined) {
    if (b.assignedTo !== null && !isUuid(b.assignedTo)) throw bad('assignedTo inválido.')
    patch.assignedTo = b.assignedTo === null ? null : b.assignedTo.toLowerCase()
  }
  if (Object.keys(patch).length === 0) throw bad('Nada para atualizar.')
  return patch
}

async function writeAudit(db: DbConfig, rows: Omit<ReviewAuditEvent, 'id' | 'created_at'>[], f: Fetch) {
  if (!rows.length) return
  await dbRequest(db, 'review_events', { method: 'POST', headers: dbHeaders(db, { Prefer: 'return=minimal' }), body: JSON.stringify(rows) }, f)
}

const ASSIGNED_TO_OTHER = 'Este pedido está atribuído a outra pessoa.'
const JUST_TAKEN = 'Outra pessoa acabou de assumir este pedido.'

/**
 * Row filter that makes an editor's write conditional on the request still being free or already theirs. The check in
 * updateReview/reviseReview reads the row first, so two editors can both pass it; this filter lets the database decide
 * (the PATCH matches no row for the second one) and closes that window. Admins write unconditionally.
 */
const editorGuard = (actor: ReviewActor) => (actor.role === 'editor' && actor.userId ? `&or=(assigned_to.is.null,assigned_to.eq.${encodeURIComponent(actor.userId)})` : '')
const isAssignedToOther = (row: Pick<ReviewRow, 'assigned_to'>, actor: ReviewActor) => !!row.assigned_to && row.assigned_to !== actor.userId

export async function updateReview(db: DbConfig, id: string, patch: ReviewPatch, actor: ReviewActor, f: Fetch = fetch) {
  // Editors may only take a review for themselves (or release it); admins can assign anyone.
  if (patch.assignedTo !== undefined && actor.role === 'editor' && patch.assignedTo !== null && patch.assignedTo !== actor.userId) {
    throw new HttpError(403, 'Editores só podem atribuir pedidos a si mesmos.')
  }
  const current = await fetchRow(db, id, f)
  // A review assigned to someone else is theirs: editors cannot take it over, release it or move its status. Admins can.
  if (actor.role === 'editor' && isAssignedToOther(current, actor) && (patch.assignedTo !== undefined || patch.status !== undefined)) {
    throw new HttpError(403, ASSIGNED_TO_OTHER)
  }

  const now = new Date().toISOString()
  const row: Record<string, unknown> = { updated_at: now }
  if (patch.status !== undefined) {
    row.status = patch.status
    row.resolved_at = patch.status === 'resolved' ? now : null
  }
  if (patch.adminNote !== undefined) row.admin_note = patch.adminNote
  if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo

  // Only the writes that depend on who holds the request are guarded; a plain note on a request assigned elsewhere stays allowed.
  const guarded = patch.assignedTo !== undefined || patch.status !== undefined
  const updated = (await dbRequest(
    db,
    `review_requests?id=${dbEq(id)}${guarded ? editorGuard(actor) : ''}`,
    { method: 'PATCH', headers: dbHeaders(db, { Prefer: 'return=representation' }), body: JSON.stringify(row) },
    f,
  )) as ReviewRow[]
  if (guarded && actor.role === 'editor' && updated.length === 0) throw new HttpError(409, JUST_TAKEN)

  const base = { review_id: id, actor_id: actor.userId, actor_label: actor.label }
  const audit: Omit<ReviewAuditEvent, 'id' | 'created_at'>[] = []
  if (patch.status !== undefined && patch.status !== current.status) {
    audit.push({ ...base, action: 'status', from_status: current.status, to_status: patch.status, note: null })
  }
  if (patch.assignedTo !== undefined && patch.assignedTo !== current.assigned_to) {
    audit.push({ ...base, action: 'assign', from_status: null, to_status: null, note: patch.assignedTo })
  }
  if (patch.adminNote !== undefined && patch.adminNote !== current.admin_note) {
    audit.push({ ...base, action: 'note', from_status: null, to_status: null, note: patch.adminNote ? patch.adminNote.slice(0, 200) : null })
  }
  await writeAudit(db, audit, f)
  return toItem(updated[0] ?? { ...current, ...row })
}

/** An editor delivers the revised creatives: stored next to the original, status becomes "resolved". */
export async function reviseReview(db: DbConfig, id: string, outputs: ReviewOutput[], actor: ReviewActor, f: Fetch = fetch) {
  const current = await fetchRow(db, id, f)
  if (actor.role === 'editor' && isAssignedToOther(current, actor)) throw new HttpError(403, ASSIGNED_TO_OTHER)
  const now = new Date().toISOString()
  const row = { revised_outputs: outputs, status: 'resolved', resolved_at: now, updated_at: now }
  const updated = (await dbRequest(
    db,
    `review_requests?id=${dbEq(id)}${editorGuard(actor)}`,
    { method: 'PATCH', headers: dbHeaders(db, { Prefer: 'return=representation' }), body: JSON.stringify(row) },
    f,
  )) as ReviewRow[]
  if (actor.role === 'editor' && updated.length === 0) throw new HttpError(409, JUST_TAKEN)
  await writeAudit(
    db,
    [{ review_id: id, actor_id: actor.userId, actor_label: actor.label, action: 'revision', from_status: current.status, to_status: 'resolved', note: `${outputs.length} criativo(s)` }],
    f,
  )
  return toItem(updated[0] ?? { ...current, ...row } as ReviewRow)
}

/* ---------------- customer ---------------- */

/** What a customer may see about their own requests (no internal notes, no contact data, no assignee). */
export async function listMyReviews(db: DbConfig, userId: string, f: Fetch = fetch) {
  const rows = (await dbRequest(
    db,
    `review_requests?user_id=${dbEq(userId)}&select=id,created_at,updated_at,status,brand_name,comment,revised_outputs,resolved_at&order=created_at.desc&limit=50`,
    { headers: dbHeaders(db) },
    f,
  )) as Pick<ReviewRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'brand_name' | 'comment' | 'revised_outputs' | 'resolved_at'>[]
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    status: r.status,
    brandName: r.brand_name,
    comment: r.comment,
    revisedOutputs: r.revised_outputs ?? null,
    resolvedAt: r.resolved_at,
  }))
}
