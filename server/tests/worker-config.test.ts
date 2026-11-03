import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { call, config, setupHarness } from './quotaHarness.ts'

setupHarness()

/** No credentials and no staff backend configured: the staff gate answers 404 (hidden) or 401/403. */
const DENIED = [401, 403, 404]

test('ADMIN_TOKEN shorter than 32 characters is ignored with a warning; a long one is kept', () => {
  const probe = (token: string) =>
    spawnSync(process.execPath, ['--input-type=module', '-e', "const { config } = await import('./server/config.ts'); console.log('TOKEN=' + config.adminToken)"], {
      env: { ...process.env, ADMIN_TOKEN: token },
      encoding: 'utf-8',
    })
  const short = probe('too-short-token')
  assert.match(short.stdout, /TOKEN=\s*$/m)
  assert.match(short.stderr, /ADMIN_TOKEN ignored/)
  const long = 'x'.repeat(40)
  const ok = probe(long)
  assert.ok(ok.stdout.includes(`TOKEN=${long}`))
  assert.doesNotMatch(ok.stderr, /ADMIN_TOKEN ignored/)
})

test('POST /api/test-ai is staff-only in production and on the Worker, open for a local dev server', async () => {
  config.isProd = true
  assert.ok(DENIED.includes((await call('POST', '/api/test-ai')).status))
  config.isProd = false
  const dev = await call('POST', '/api/test-ai')
  assert.equal(dev.status, 200)
  assert.equal(dev.json.ok, false) // no AI configured in the test, but the route itself is reachable
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Cloudflare-Workers' }, configurable: true })
  try {
    assert.ok(DENIED.includes((await call('POST', '/api/test-ai')).status), 'also gated under wrangler dev (not production)')
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete (globalThis as { navigator?: unknown }).navigator
  }
})
