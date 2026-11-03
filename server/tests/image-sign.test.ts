import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { config } from '../config.ts'
import { aiImageAuthorized, buildApiImageUrl, canonicalImageQuery, canonicalImageSearch, imageCacheKey, signImageQuery, verifyImageSig } from '../imageService.ts'
import { classifyImageError } from '../ai/image.ts'

const SECRET = 'image-url-secret-for-tests'
const wasProd = config.isProd
afterEach(() => {
  delete process.env.IMAGE_URL_SECRET
  config.isProd = wasProd
})

const paramsOf = (url: string) => new URL(url, 'http://x').searchParams
const searchOf = (url: string) => new URL(url, 'http://x').search
/** The route's view of a request: parsed params plus the raw query string as received. */
const authorized = (url: string) => aiImageAuthorized(paramsOf(url), searchOf(url))
const base = { prompt: 'corte de cabelo', headline: 'Corte', segment: 'beleza', seed: 7, order: 1, kind: 'post' as const, forceAi: true }

test('a signed URL verifies; changing any parameter or the signature breaks it', () => {
  process.env.IMAGE_URL_SECRET = SECRET
  const url = buildApiImageUrl(base)
  const p = paramsOf(url)
  assert.equal(p.get('ai'), '1')
  assert.ok(p.get('sig'))
  assert.equal(verifyImageSig(p, SECRET), true)
  assert.equal(authorized(url), true)

  const tampered = new URLSearchParams(p)
  tampered.set('seed', '8')
  assert.equal(aiImageAuthorized(tampered, canonicalImageSearch(tampered)), false)

  const noSig = new URLSearchParams(p)
  noSig.delete('sig')
  assert.equal(aiImageAuthorized(noSig, canonicalImageSearch(noSig)), false)

  const forged = new URLSearchParams(p)
  forged.set('sig', signImageQuery(p, 'another-secret'))
  assert.equal(aiImageAuthorized(forged, canonicalImageSearch(forged)), false)

  process.env.IMAGE_URL_SECRET = 'rotated-secret'
  assert.equal(authorized(url), false, 'rotating the secret invalidates old URLs')
})

test('the signature does not depend on parameter order', () => {
  const a = new URLSearchParams('b=2&a=1&c=%C3%A9')
  const b = new URLSearchParams('c=%C3%A9&a=1&b=2')
  assert.equal(canonicalImageQuery(a), canonicalImageQuery(b))
  assert.equal(signImageQuery(a, SECRET), signImageQuery(b, SECRET))
})

test('emitted URLs are canonical: sorted parameters, sig last, byte-for-byte what the route accepts', () => {
  process.env.IMAGE_URL_SECRET = SECRET
  const url = buildApiImageUrl(base)
  const p = paramsOf(url)
  assert.equal(searchOf(url).slice(1), canonicalImageQuery(p) + '&sig=' + p.get('sig'))
  const keys = [...p.keys()]
  assert.equal(keys.at(-1), 'sig')
  assert.deepEqual(keys.slice(0, -1), [...keys.slice(0, -1)].sort())
  // Unsigned URLs are canonical too, so the cache key and the emitted URL agree.
  const unsigned = buildApiImageUrl({ ...base, forceAi: false })
  assert.equal(searchOf(unsigned).slice(1), canonicalImageQuery(paramsOf(unsigned)))
})

test('a reordered or re-encoded query with a valid signature is refused for AI, so one signed URL cannot fan out into cache misses', () => {
  process.env.IMAGE_URL_SECRET = SECRET
  const url = buildApiImageUrl(base)
  const p = paramsOf(url)
  assert.equal(authorized(url), true)

  // same parameters and signature, different order
  const reordered = [...p.entries()].reverse().map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&')
  assert.equal(aiImageAuthorized(new URLSearchParams(reordered), reordered), false)
  assert.equal(verifyImageSig(new URLSearchParams(reordered), SECRET), true, 'the signature alone would still verify')

  // same parameters and order, a character spelled differently (%20 instead of +, lowercase hex)
  const respelled = searchOf(url).slice(1).replace(/\+/g, '%20').replace(/%2C/g, '%2c')
  assert.notEqual(respelled, searchOf(url).slice(1))
  assert.equal(aiImageAuthorized(new URLSearchParams(respelled), respelled), false)

  // a repeated sig, or an extra parameter appended after it
  const dupSig = searchOf(url).slice(1) + '&sig=' + p.get('sig')
  assert.equal(aiImageAuthorized(new URLSearchParams(dupSig), dupSig), false)
  const extra = searchOf(url).slice(1) + '&r=1'
  assert.equal(aiImageAuthorized(new URLSearchParams(extra), extra), false)
})

test('the edge cache key is normalized: variants of one image share a key, and only canonical or unsigned responses are stored', () => {
  process.env.IMAGE_URL_SECRET = SECRET
  const canonical = new URL('https://voaneves.com/midflow-app' + buildApiImageUrl(base))
  const p = canonical.searchParams
  const a = imageCacheKey(canonical)
  assert.equal(a.cacheable, true)
  assert.equal(a.key, canonical.origin + canonical.pathname + '?' + canonicalImageSearch(p))

  const reordered = new URL('https://voaneves.com/midflow-app/api/image?' + [...p.entries()].reverse().map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'))
  const b = imageCacheKey(reordered)
  assert.equal(b.key, a.key, 'same key for a reordered query')
  assert.equal(b.cacheable, false, 'a signed non-canonical response (stock) must not overwrite the AI image')

  // unsigned requests never reach the paid model, so any spelling can be cached under the canonical key
  const plain = imageCacheKey(new URL('https://voaneves.com/midflow-app/api/image?segment=beleza&prompt=a+b'))
  const plainReordered = imageCacheKey(new URL('https://voaneves.com/midflow-app/api/image?prompt=a%20b&segment=beleza'))
  assert.equal(plain.key, plainReordered.key)
  assert.equal(plainReordered.cacheable, true)
})

test('a raw ai=1 URL is rejected when a secret is set, and in production without one', () => {
  const raw = 'ai=1&segment=beleza&seed=1'
  process.env.IMAGE_URL_SECRET = SECRET
  assert.equal(aiImageAuthorized(new URLSearchParams(raw), raw), false)
  delete process.env.IMAGE_URL_SECRET
  config.isProd = false
  assert.equal(aiImageAuthorized(new URLSearchParams(raw), raw), true, 'development accepts it')
  config.isProd = true
  assert.equal(aiImageAuthorized(new URLSearchParams(raw), raw), false, 'production never accepts an unsigned ai=1')
  assert.equal(aiImageAuthorized(new URLSearchParams('segment=beleza'), 'segment=beleza'), false)
})

test('without a secret: dev URLs carry a bare ai=1, production URLs carry no ai at all', () => {
  config.isProd = false
  assert.equal(paramsOf(buildApiImageUrl(base)).get('ai'), '1')
  config.isProd = true
  const prod = paramsOf(buildApiImageUrl(base))
  assert.equal(prod.get('ai'), null)
  assert.equal(prod.get('sig'), null)
})

test('URLs built without forceAi are never signed', () => {
  process.env.IMAGE_URL_SECRET = SECRET
  const p = paramsOf(buildApiImageUrl({ ...base, forceAi: false }))
  assert.equal(p.get('ai'), null)
  assert.equal(p.get('sig'), null)
})

test('image failures: auth, permission and token problems are config, quota is not', () => {
  assert.equal(classifyImageError('Cloudflare: token inválido ou sem permissão "Workers AI".'), 'invalid_key')
  assert.equal(classifyImageError('Cloudflare: CF_AI_ACCOUNT_ID inválido (confira o Account ID no painel).'), 'invalid_key')
  assert.equal(classifyImageError('Gemini gemini-x: chave sem permissão (403).'), 'invalid_key')
  assert.equal(classifyImageError('Cloudflare: cota gratuita diária esgotada (renova à meia-noite UTC).'), 'rate_limit')
  assert.equal(classifyImageError('Cloudflare: tempo limite excedido'), 'timeout')
  assert.equal(classifyImageError('Cloudflare 500: boom'), 'provider_error')
})
