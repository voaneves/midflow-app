import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { test } from 'node:test'
import { HttpError } from '../http.ts'
import { reviseReview, updateReview, type ReviewActor } from '../reviews.ts'
import { pruneRetention } from '../retention.ts'
import { be, call, config, enableSupabase, generateBody, ids, setupHarness, tokenFor } from './quotaHarness.ts'

setupHarness()

const DB = { url: 'https://fake.supabase.co', serviceRoleKey: 'service-role-test-key' }
const REVIEW = '10000000-0000-4000-8000-000000000001'
const EDITOR_A = '22222222-2222-4222-8222-222222222222'
const EDITOR_B = '66666666-6666-4666-8666-666666666666'
const editor = (userId: string): ReviewActor => ({ role: 'editor', userId, label: `editor:${userId}` })
const admin: ReviewActor = { role: 'admin', userId: ids.customer, label: 'admin' }

const review = (extra: Record<string, unknown> = {}) => ({
  id: REVIEW,
  user_id: null,
  status: 'pending',
  brand_name: 'Studio Teste',
  segment: 'beleza',
  engine: 'template',
  ai_error_kind: null,
  comment: null,
  contact_email: null,
  admin_note: null,
  assigned_to: null,
  revised_outputs: null,
  resolved_at: null,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  payload: { briefing: {}, outputs: [] },
  ...extra,
})

/** A fetch that lets another person take the request between the editor's read and the editor's write. */
function racingFetch(takeBy: string) {
  let raced = false
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (init?.method === 'PATCH' && String(input).includes('review_requests') && !raced) {
      raced = true
      be.tables.review_requests[0].assigned_to = takeBy
    }
    return be.fetch(input, init)
  }) as typeof fetch
}

const justTaken = (e: unknown) => e instanceof HttpError && e.status === 409 && e.message === 'Outra pessoa acabou de assumir este pedido.'

/* ---------------- editor assignment race ---------------- */

test('assign race: two editors read the request as free, the second write matches no row and answers 409 (pt-BR)', async () => {
  be.tables.review_requests.push(review())
  await assert.rejects(updateReview(DB, REVIEW, { assignedTo: EDITOR_A }, editor(EDITOR_A), racingFetch(EDITOR_B)), justTaken)
  assert.equal(be.tables.review_requests[0].assigned_to, EDITOR_B, 'the first editor keeps the request')
  assert.equal(be.tables.review_events.length, 0, 'no audit row for a write that did not happen')
})

test('assign race: a status change is guarded the same way, and so is delivering a revision', async () => {
  be.tables.review_requests.push(review())
  await assert.rejects(updateReview(DB, REVIEW, { status: 'in_progress' }, editor(EDITOR_A), racingFetch(EDITOR_B)), justTaken)
  assert.equal(be.tables.review_requests[0].status, 'pending')

  be.tables.review_requests[0].assigned_to = null
  const outputs = [{ kind: 'post' as const, title: 't', caption: 'c', hashtags: [] }]
  await assert.rejects(reviseReview(DB, REVIEW, outputs, editor(EDITOR_A), racingFetch(EDITOR_B)), justTaken)
  assert.equal(be.tables.review_requests[0].revised_outputs, null)
})

test('assign race: with no race an editor can take a free request, and re-save one that is already theirs', async () => {
  be.tables.review_requests.push(review())
  const item = await updateReview(DB, REVIEW, { assignedTo: EDITOR_A, status: 'in_progress' }, editor(EDITOR_A), be.fetch)
  assert.equal(item.assignedTo, EDITOR_A)
  assert.equal(be.tables.review_requests[0].assigned_to, EDITOR_A)
  const again = await updateReview(DB, REVIEW, { status: 'resolved' }, editor(EDITOR_A), be.fetch)
  assert.equal(again.status, 'resolved')
})

test('assign race: an admin may reassign a request that is held by someone else', async () => {
  be.tables.review_requests.push(review({ assigned_to: EDITOR_B }))
  const item = await updateReview(DB, REVIEW, { assignedTo: EDITOR_A }, admin, be.fetch)
  assert.equal(item.assignedTo, EDITOR_A)
})

test('assign race over HTTP: the second editor gets 409 with the pt-BR message', async () => {
  enableSupabase()
  be.tables.staff_members.push({ user_id: EDITOR_A, role: 'editor', created_at: '2026-01-01T00:00:00Z' })
  be.tables.review_requests.push(review())
  const realFetch = globalThis.fetch
  globalThis.fetch = racingFetch(EDITOR_B)
  try {
    const r = await call('PATCH', `/api/admin/reviews/${REVIEW}`, { token: await tokenFor(EDITOR_A), body: { assignedTo: EDITOR_A } })
    assert.equal(r.status, 409)
    assert.equal(r.json.error, 'Outra pessoa acabou de assumir este pedido.')
  } finally {
    globalThis.fetch = realFetch
  }
})

/* ---------------- retention ---------------- */

const NOW = Date.parse('2026-11-03T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

test('retention: resolved review requests older than REVIEWS_RETENTION_DAYS are deleted; open ones and recent ones stay', async () => {
  be.tables.review_requests.push(
    review({ id: 'r-old-resolved', status: 'resolved', resolved_at: daysAgo(400) }),
    review({ id: 'r-new-resolved', status: 'resolved', resolved_at: daysAgo(30) }),
    review({ id: 'r-old-pending', status: 'pending', created_at: daysAgo(900) }),
    review({ id: 'r-old-progress', status: 'in_progress', created_at: daysAgo(900) }),
  )
  const r = await pruneRetention(DB, be.fetch, NOW, { reviews: 365, generations: 0 })
  assert.deepEqual(r, { ran: true, reviews: true, generations: false })
  assert.deepEqual(be.tables.review_requests.map((x) => x.id).sort(), ['r-new-resolved', 'r-old-pending', 'r-old-progress'])
  assert.ok(!be.calls.some((c) => c.includes('/rest/v1/generations')), 'generations default to keep')
})

test('retention: generations are pruned only when GENERATIONS_RETENTION_DAYS is set', async () => {
  be.tables.generations.push({ user_id: ids.customer, id: 'g-old', created_at: daysAgo(200) }, { user_id: ids.customer, id: 'g-new', created_at: daysAgo(5) })
  const r = await pruneRetention(DB, be.fetch, NOW, { reviews: 0, generations: 90 })
  assert.deepEqual(r, { ran: true, reviews: false, generations: true })
  assert.deepEqual(be.tables.generations.map((x) => x.id), ['g-new'])
})

test('retention: at most once a day, and 0/0 means keep everything', async () => {
  be.tables.review_requests.push(review({ id: 'r1', status: 'resolved', resolved_at: daysAgo(400) }))
  assert.equal((await pruneRetention(DB, be.fetch, NOW, { reviews: 0, generations: 0 })).ran, false)
  assert.equal(be.tables.review_requests.length, 1)

  assert.equal((await pruneRetention(DB, be.fetch, NOW, { reviews: 365, generations: 0 })).ran, true)
  be.tables.review_requests.push(review({ id: 'r2', status: 'resolved', resolved_at: daysAgo(400) }))
  assert.equal((await pruneRetention(DB, be.fetch, NOW + 3_600_000, { reviews: 365, generations: 0 })).ran, false, 'same day')
  assert.equal(be.tables.review_requests.length, 1)
  assert.equal((await pruneRetention(DB, be.fetch, NOW + 25 * 3_600_000, { reviews: 365, generations: 0 })).ran, true, 'next day')
  assert.equal(be.tables.review_requests.length, 0)
})

test('retention: a failing delete only logs a short warning and never throws', async () => {
  const failing = (async () => new Response('{}', { status: 500 })) as typeof fetch
  const r = await pruneRetention(DB, failing, NOW, { reviews: 365, generations: 30 })
  assert.deepEqual(r, { ran: true, reviews: false, generations: false })
})

test('retention rides on the AI health recording: a generate call with the database triggers the daily prune', async () => {
  enableSupabase()
  const real = config.reviewsRetentionDays
  config.reviewsRetentionDays = 365
  try {
    be.tables.review_requests.push(review({ id: 'r-old', status: 'resolved', resolved_at: daysAgo(4000) }))
    const r = await call('POST', '/api/generate', { body: generateBody, token: await tokenFor(ids.customer) })
    assert.equal(r.status, 200)
    for (let i = 0; i < 20 && be.tables.review_requests.length > 0; i++) await sleep(10)
    assert.equal(be.tables.review_requests.length, 0)
  } finally {
    config.reviewsRetentionDays = real
  }
})
