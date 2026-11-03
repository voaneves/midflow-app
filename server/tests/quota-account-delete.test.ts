import assert from 'node:assert/strict'
import { test } from 'node:test'
import { be, call, enableSupabase, setupHarness, tokenFor } from './quotaHarness.ts'

setupHarness()

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

test('account delete: the last admin is refused through the guarded RPC', async () => {
  enableSupabase()
  be.tables.staff_members.push({ user_id: A, role: 'admin', created_at: '2026-01-01T00:00:00Z' })
  const r = await call('POST', '/api/account/delete', { token: await tokenFor(A), body: { confirm: 'EXCLUIR' } })
  assert.equal(r.status, 409)
  assert.ok(be.calls.some((c) => c.endsWith('/rpc/remove_staff_guarded')))
  assert.equal(be.tables.staff_members.length, 1)
})

test('account delete: a staff role is restored when a later step fails', async () => {
  enableSupabase()
  be.tables.staff_members.push({ user_id: A, role: 'admin', created_at: '2026-01-01T00:00:00Z' }, { user_id: B, role: 'admin', created_at: '2026-01-02T00:00:00Z' })
  be.authDeleteStatus = 500
  const r = await call('POST', '/api/account/delete', { token: await tokenFor(A), body: { confirm: 'EXCLUIR' } })
  assert.notEqual(r.status, 200)
  assert.deepEqual(be.tables.staff_members.map((s) => s.user_id).sort(), [A, B])
})
