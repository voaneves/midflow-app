import assert from 'node:assert/strict'
import { test } from 'node:test'
import { be, call, config, enableSupabase, ids, setupHarness, tokenFor } from './quotaHarness.ts'

setupHarness()

function enableStripe() {
  process.env.STRIPE_SECRET_KEY = 'sk_test_portal'
  process.env.STRIPE_PRICE_PRO = 'price_pro_m'
}

const sub = (extra: Record<string, unknown> = {}) => ({ user_id: ids.customer, plan: 'pro', status: 'active', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', ...extra })

test('portal: opens a Stripe billing portal session for the signed-in customer and returns its url', async () => {
  enableSupabase()
  enableStripe()
  be.tables.subscriptions.push(sub())
  const r = await call('POST', '/api/billing/portal', { token: await tokenFor(ids.customer) })
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { url: 'https://billing.stripe.com/p/session/test_1' })

  const req = be.stripeRequests.at(-1)!
  assert.equal(req.url, 'https://api.stripe.com/v1/billing_portal/sessions')
  assert.equal(req.headers.Authorization, 'Bearer sk_test_portal')
  const form = new URLSearchParams(req.body)
  assert.equal(form.get('customer'), 'cus_1', 'the customer comes from the subscriptions table')
  assert.equal(form.get('return_url'), 'https://voaneves.com/midflow-app/#/app/config')
  assert.equal(form.get('locale'), 'pt-BR')
})

test('portal: a customer id sent by the browser is ignored', async () => {
  enableSupabase()
  enableStripe()
  be.tables.subscriptions.push(sub())
  await call('POST', '/api/billing/portal', { token: await tokenFor(ids.customer), body: { customer: 'cus_someone_else' } })
  assert.equal(new URLSearchParams(be.stripeRequests.at(-1)!.body).get('customer'), 'cus_1')
})

test('portal: the return url follows APP_URL', async () => {
  enableSupabase()
  enableStripe()
  process.env.APP_URL = 'https://app.example.com/base/'
  try {
    be.tables.subscriptions.push(sub())
    await call('POST', '/api/billing/portal', { token: await tokenFor(ids.customer) })
    assert.equal(new URLSearchParams(be.stripeRequests.at(-1)!.body).get('return_url'), 'https://app.example.com/base/#/app/config')
  } finally {
    delete process.env.APP_URL
  }
})

test('portal: needs a signed-in user (401), and a subscription with a Stripe customer (404, pt-BR)', async () => {
  enableSupabase()
  enableStripe()
  assert.equal((await call('POST', '/api/billing/portal')).status, 401)

  const token = await tokenFor(ids.customer)
  const none = await call('POST', '/api/billing/portal', { token })
  assert.equal(none.status, 404)
  assert.equal(none.json.error, 'Nenhuma assinatura encontrada.')

  be.tables.subscriptions.push(sub({ stripe_customer_id: null, stripe_subscription_id: null, status: 'incomplete' }))
  assert.equal((await call('POST', '/api/billing/portal', { token })).status, 404)
  assert.equal(be.stripeRequests.length, 0, 'Stripe was never called')
})

test('portal: 503 when payments or the database are not configured', async () => {
  const token = await tokenFor(ids.customer)
  enableSupabase()
  assert.equal((await call('POST', '/api/billing/portal', { token })).status, 503) // no STRIPE_SECRET_KEY
  delete process.env.SUPABASE_URL
  enableStripe()
  assert.equal((await call('POST', '/api/billing/portal', { token })).status, 503) // no database
})

test('portal: a Stripe failure is a 502 in pt-BR and the Stripe message stays out of the response', async () => {
  enableSupabase()
  enableStripe()
  be.tables.subscriptions.push(sub())
  be.stripePortalStatus = 400
  const r = await call('POST', '/api/billing/portal', { token: await tokenFor(ids.customer) })
  assert.equal(r.status, 502)
  assert.match(r.json.error, /gerenciamento da assinatura/)
  assert.ok(!JSON.stringify(r.json).includes('configuration'))
})

test('portal: shares the billing rate limit with checkout', async () => {
  enableSupabase()
  enableStripe()
  config.limits.billingPerHour = 2
  be.tables.subscriptions.push(sub())
  const token = await tokenFor(ids.customer)
  assert.equal((await call('POST', '/api/billing/portal', { token })).status, 200)
  assert.equal((await call('POST', '/api/billing/checkout', { token, body: { plan: 'pro' } })).status, 409) // counts as the second hit
  assert.equal((await call('POST', '/api/billing/portal', { token })).status, 429)
})
