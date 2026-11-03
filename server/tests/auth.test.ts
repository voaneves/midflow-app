import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'
import { authenticate, clearJwksCache, getBearerToken, signHs256Jwt, verifyAccessToken, verifySupabaseJwt } from '../auth.ts'
import { jwksFetch, jwksOf, makeEs256Key, makeRs256Key, signAsymmetric, signHmacWith } from './jwtKeys.ts'

const enc = new TextEncoder()

const SECRET = 'test-secret-with-enough-entropy-0123456789'
const USER = '3f1c2b7e-9a4d-4c1e-8f60-5b2d7a9e1c04'
const NOW = 1_800_000_000

const claims = (over: Record<string, unknown> = {}) => ({ sub: USER, aud: 'authenticated', role: 'authenticated', email: 'ana@example.com', exp: NOW + 3600, ...over })

test('getBearerToken extracts only well-formed Bearer headers', () => {
  assert.equal(getBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi')
  assert.equal(getBearerToken('bearer abc.def.ghi'), 'abc.def.ghi')
  assert.equal(getBearerToken('Basic abc'), null)
  assert.equal(getBearerToken('Bearer'), null)
  assert.equal(getBearerToken('Bearer a b'), null)
  assert.equal(getBearerToken(undefined), null)
  assert.equal(getBearerToken(null), null)
})

test('a valid token yields the user', async () => {
  const token = await signHs256Jwt(claims(), SECRET)
  const user = await verifySupabaseJwt(token, SECRET, { now: NOW })
  assert.deepEqual(user, { id: USER, email: 'ana@example.com', role: 'authenticated', exp: NOW + 3600 })
})

test('wrong secret, tampered payload and tampered signature are rejected', async () => {
  const token = await signHs256Jwt(claims(), SECRET)
  assert.equal(await verifySupabaseJwt(token, 'another-secret', { now: NOW }), null)

  const [h, , s] = token.split('.')
  const forgedBody = btoa(JSON.stringify(claims({ sub: '00000000-0000-4000-8000-000000000000' }))).replace(/=+$/, '')
  assert.equal(await verifySupabaseJwt(`${h}.${forgedBody}.${s}`, SECRET, { now: NOW }), null)

  const flipped = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA')
  assert.equal(await verifySupabaseJwt(flipped, SECRET, { now: NOW }), null)
})

test('expired, not-yet-valid and wrong-audience tokens are rejected', async () => {
  assert.equal(await verifySupabaseJwt(await signHs256Jwt(claims({ exp: NOW - 120 }), SECRET), SECRET, { now: NOW }), null)
  // inside the 30 s leeway still passes
  assert.ok(await verifySupabaseJwt(await signHs256Jwt(claims({ exp: NOW - 10 }), SECRET), SECRET, { now: NOW }))
  assert.equal(await verifySupabaseJwt(await signHs256Jwt(claims({ nbf: NOW + 600 }), SECRET), SECRET, { now: NOW }), null)
  assert.equal(await verifySupabaseJwt(await signHs256Jwt(claims({ aud: 'anon' }), SECRET), SECRET, { now: NOW }), null)
  assert.ok(await verifySupabaseJwt(await signHs256Jwt(claims({ aud: ['x', 'authenticated'] }), SECRET), SECRET, { now: NOW }))
})

test('tokens without exp or with a non-uuid subject are rejected', async () => {
  const { exp: _exp, ...noExp } = claims()
  assert.equal(await verifySupabaseJwt(await signHs256Jwt(noExp, SECRET), SECRET, { now: NOW }), null)
  assert.equal(await verifySupabaseJwt(await signHs256Jwt(claims({ sub: 'admin' }), SECRET), SECRET, { now: NOW }), null)
  assert.equal(await verifySupabaseJwt(await signHs256Jwt(claims({ sub: undefined }), SECRET), SECRET, { now: NOW }), null)
})

test('alg none and other algorithms are rejected', async () => {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims())}.`
  assert.equal(await verifySupabaseJwt(none, SECRET, { now: NOW }), null)
  const rs = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims())}.${'A'.repeat(43)}`
  assert.equal(await verifySupabaseJwt(rs, SECRET, { now: NOW }), null)
})

test('garbage input never throws', async () => {
  for (const t of ['', 'abc', 'a.b', 'a.b.c', '...', '###.###.###', 'a.b.c.d']) {
    assert.equal(await verifySupabaseJwt(t, SECRET, { now: NOW }), null)
  }
  assert.equal(await verifySupabaseJwt('x.y.z', '', { now: NOW }), null)
})

test('authenticate combines header parsing, secret presence and verification', async () => {
  const token = await signHs256Jwt(claims({ exp: Math.floor(Date.now() / 1000) + 600 }), SECRET)
  assert.equal((await authenticate(`Bearer ${token}`, SECRET))?.id, USER)
  assert.equal(await authenticate(`Bearer ${token}`, undefined), null)
  assert.equal(await authenticate(undefined, SECRET), null)
  assert.equal(await authenticate('Bearer nope', SECRET), null)
})

/* ------------------------------------------------------------------ */
/* Role and issuer (HS256)                                             */
/* ------------------------------------------------------------------ */

const URL_BASE = 'https://proj.supabase.co'
const ISS = `${URL_BASE}/auth/v1`

test('HS256: role must be "authenticated" (anon and service_role keys are JWTs too)', async () => {
  for (const role of ['anon', 'service_role', undefined]) {
    assert.equal(await verifySupabaseJwt(await signHs256Jwt(claims({ role }), SECRET), SECRET, { now: NOW }), null, String(role))
  }
})

test('verifyAccessToken: HS256 needs the configured secret and the project issuer', async () => {
  const cfg = { supabaseUrl: URL_BASE, hs256Secret: SECRET }
  assert.ok(await verifyAccessToken(await signHs256Jwt(claims({ iss: ISS }), SECRET), cfg, { now: NOW }))
  assert.equal(await verifyAccessToken(await signHs256Jwt(claims({ iss: 'https://evil.supabase.co/auth/v1' }), SECRET), cfg, { now: NOW }), null)
  assert.equal(await verifyAccessToken(await signHs256Jwt(claims(), SECRET), cfg, { now: NOW }), null) // no iss
  // HS256 is refused outright when no secret is configured
  assert.equal(await verifyAccessToken(await signHs256Jwt(claims({ iss: ISS }), SECRET), { supabaseUrl: URL_BASE }, { now: NOW }), null)
})

/* ------------------------------------------------------------------ */
/* ES256 / RS256 through JWKS                                          */
/* ------------------------------------------------------------------ */

beforeEach(() => clearJwksCache())
afterEach(() => mock.restoreAll())

const good = (over: Record<string, unknown> = {}) => claims({ iss: ISS, ...over })

test('ES256: a token signed by a key in the JWKS verifies, and the key set is cached', async () => {
  const key = await makeEs256Key('k1')
  const f = jwksFetch(jwksOf(key))
  const cfg = { supabaseUrl: URL_BASE, fetch: f }
  const t1 = await signAsymmetric(key, good())
  assert.deepEqual(await verifyAccessToken(t1, cfg, { now: NOW }), { id: USER, email: 'ana@example.com', role: 'authenticated', exp: NOW + 3600 })
  assert.ok(await verifyAccessToken(await signAsymmetric(key, good()), cfg, { now: NOW }))
  assert.equal(f.state.count, 1)
})

test('ES256: tampered payload, wrong key, expired token and bad signature length are rejected', async () => {
  const key = await makeEs256Key('k1')
  const attacker = await makeEs256Key('k1') // same kid, different key
  const cfg = { supabaseUrl: URL_BASE, fetch: jwksFetch(jwksOf(key)) }

  assert.equal(await verifyAccessToken(await signAsymmetric(attacker, good()), cfg, { now: NOW }), null)
  assert.equal(await verifyAccessToken(await signAsymmetric(key, good({ exp: NOW - 120 })), cfg, { now: NOW }), null)

  const [h, , s] = (await signAsymmetric(key, good())).split('.')
  const forged = btoa(JSON.stringify(good({ sub: '00000000-0000-4000-8000-000000000000' }))).replace(/=+$/, '')
  assert.equal(await verifyAccessToken(`${h}.${forged}.${s}`, cfg, { now: NOW }), null)

  // a DER-style / truncated signature is not 64 raw bytes
  const [h2, p2] = (await signAsymmetric(key, good())).split('.')
  assert.equal(await verifyAccessToken(`${h2}.${p2}.${'A'.repeat(60)}`, cfg, { now: NOW }), null)
})

test('ES256: wrong issuer and non-authenticated roles are rejected', async () => {
  const key = await makeEs256Key('k1')
  const cfg = { supabaseUrl: URL_BASE, fetch: jwksFetch(jwksOf(key)) }
  assert.equal(await verifyAccessToken(await signAsymmetric(key, good({ iss: 'https://other.supabase.co/auth/v1' })), cfg, { now: NOW }), null)
  assert.equal(await verifyAccessToken(await signAsymmetric(key, claims()), cfg, { now: NOW }), null) // missing iss
  assert.equal(await verifyAccessToken(await signAsymmetric(key, good({ role: 'anon' })), cfg, { now: NOW }), null)
  assert.equal(await verifyAccessToken(await signAsymmetric(key, good({ role: 'service_role' })), cfg, { now: NOW }), null)
  assert.equal(await verifyAccessToken(await signAsymmetric(key, good({ aud: 'anon' })), cfg, { now: NOW }), null)
})

test('ES256: an unknown kid is rejected; a rotated-in key is found after one refetch (rate limited)', async () => {
  const k1 = await makeEs256Key('k1')
  const k2 = await makeEs256Key('k2')
  const doc = jwksOf(k1)
  const f = jwksFetch(doc)
  const cfg = { supabaseUrl: URL_BASE, fetch: f }
  let clock = 1_000_000
  mock.method(Date, 'now', () => clock)

  assert.ok(await verifyAccessToken(await signAsymmetric(k1, good()), cfg, { now: NOW }))
  assert.equal(f.state.count, 1)

  const t2 = await signAsymmetric(k2, good())
  assert.equal(await verifyAccessToken(t2, cfg, { now: NOW }), null) // k2 not published yet; JWKS was just fetched, no hammering
  assert.equal(f.state.count, 1)

  doc.keys = jwksOf(k1, k2).keys
  clock += 31_000
  assert.ok(await verifyAccessToken(t2, cfg, { now: NOW }))
  assert.equal(f.state.count, 2)

  // a token naming a kid that never exists costs no extra fetch inside the cooldown
  const ghost = await signAsymmetric(k1, good(), { kid: 'ghost' })
  assert.equal(await verifyAccessToken(ghost, cfg, { now: NOW }), null)
  assert.equal(await verifyAccessToken(ghost, cfg, { now: NOW }), null)
  assert.equal(f.state.count, 2)
})

test('ES256: key sets expire after 10 minutes, and stale keys survive a JWKS outage', async () => {
  const key = await makeEs256Key('k1')
  const f = jwksFetch(jwksOf(key))
  const cfg = { supabaseUrl: URL_BASE, fetch: f }
  let clock = 5_000_000
  mock.method(Date, 'now', () => clock)
  const token = await signAsymmetric(key, good())
  assert.ok(await verifyAccessToken(token, cfg, { now: NOW }))
  clock += 11 * 60_000
  f.state.status = 503
  assert.ok(await verifyAccessToken(token, cfg, { now: NOW })) // refetch failed, cached key still verifies
  assert.equal(f.state.count, 2)
})

test('JWKS: only EC P-256 and RSA keys are accepted; other curves and kty are ignored', async () => {
  const p384 = await makeEs256Key('k384', 'P-384')
  const cfg = { supabaseUrl: URL_BASE, fetch: jwksFetch({ keys: [p384.jwk, { kty: 'oct', k: 'AAAA', kid: 'sym', alg: 'HS256' }] }) }
  // the P-384 key must not even be loaded
  assert.equal(await verifyAccessToken(await signAsymmetric(p384, good()), cfg, { now: NOW }), null)
  assert.equal(await verifyAccessToken(await signAsymmetric(p384, good(), { kid: 'sym' }), cfg, { now: NOW }), null)
})

test('algorithm confusion: HS256 signed with the public key material is rejected, with or without a configured secret', async () => {
  const key = await makeEs256Key('k1')
  const f = jwksFetch(jwksOf(key))
  const publicBytes = [enc.encode(JSON.stringify(key.jwk)), enc.encode(String(key.jwk.x)), enc.encode(`${key.jwk.x}${key.jwk.y}`)]
  for (const bytes of publicBytes) {
    const t = await signHmacWith(bytes, good(), 'k1')
    assert.equal(await verifyAccessToken(t, { supabaseUrl: URL_BASE, fetch: f }, { now: NOW }), null)
    assert.equal(await verifyAccessToken(t, { supabaseUrl: URL_BASE, hs256Secret: SECRET, fetch: f }, { now: NOW }), null)
  }
  // an ES256 header glued onto an HMAC-signed body fails the signature check
  const hmacBody = (await signHmacWith(enc.encode(SECRET), good(), 'k1')).split('.')
  const es = (await signAsymmetric(key, good())).split('.')
  assert.equal(await verifyAccessToken(`${es[0]}.${hmacBody[1]}.${hmacBody[2]}`, { supabaseUrl: URL_BASE, fetch: f }, { now: NOW }), null)
})

test('unsupported algorithms are rejected: none, HS384, PS256, and ES256 without a kid', async () => {
  const key = await makeEs256Key('k1')
  const cfg = { supabaseUrl: URL_BASE, hs256Secret: SECRET, fetch: jwksFetch(jwksOf(key)) }
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  for (const alg of ['none', 'HS384', 'HS512', 'PS256', 'ES384', 'EdDSA']) {
    assert.equal(await verifyAccessToken(`${b64({ alg, typ: 'JWT', kid: 'k1' })}.${b64(good())}.${'A'.repeat(86)}`, cfg, { now: NOW }), null, alg)
  }
  assert.equal(await verifyAccessToken(await signAsymmetric(key, good(), { kid: undefined }), cfg, { now: NOW }), null)
})

test('an EC key cannot verify an RS256-labelled token, and an RSA key cannot verify an ES256-labelled one', async () => {
  const ec = await makeEs256Key('ec1')
  const rsa = await makeRs256Key('rsa1')
  const cfg = { supabaseUrl: URL_BASE, fetch: jwksFetch(jwksOf(ec, rsa)) }
  assert.ok(await verifyAccessToken(await signAsymmetric(rsa, good()), cfg, { now: NOW }))
  assert.equal(await verifyAccessToken(await signAsymmetric(ec, good(), { alg: 'RS256' }), cfg, { now: NOW }), null)
  assert.equal(await verifyAccessToken(await signAsymmetric(rsa, good(), { alg: 'ES256' }), cfg, { now: NOW }), null)
})

test('verifyAccessToken never throws on garbage and authenticate accepts a config object', async () => {
  const key = await makeEs256Key('k1')
  const cfg = { supabaseUrl: URL_BASE, fetch: jwksFetch(jwksOf(key)) }
  for (const t of ['', 'abc', 'a.b', 'a.b.c', '...', '###.###.###', 'a.b.c.d']) assert.equal(await verifyAccessToken(t, cfg, { now: NOW }), null, t)
  const token = await signAsymmetric(key, good({ exp: Math.floor(Date.now() / 1000) + 600 }))
  assert.equal((await authenticate(`Bearer ${token}`, cfg))?.id, USER)
  assert.equal(await authenticate(`Bearer ${token}`, {}), null)
})
