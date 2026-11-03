/** Test helpers: asymmetric key pairs, JWKS documents and signed Supabase-shaped tokens (ES256 / RS256). */

const enc = new TextEncoder()
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const part = (o: unknown) => b64url(enc.encode(JSON.stringify(o)))

export interface TestKey {
  kid: string
  alg: 'ES256' | 'RS256'
  privateKey: CryptoKey
  /** Public JWK as Supabase publishes it (kid, alg, use included). */
  jwk: JsonWebKey & { kid: string; alg: string; use: string }
}

export async function makeEs256Key(kid: string, curve: 'P-256' | 'P-384' = 'P-256'): Promise<TestKey> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: curve }, true, ['sign', 'verify'])
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey
  return { kid, alg: 'ES256', privateKey: pair.privateKey, jwk: { ...jwk, kid, alg: 'ES256', use: 'sig' } }
}

export async function makeRs256Key(kid: string): Promise<TestKey> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey
  return { kid, alg: 'RS256', privateKey: pair.privateKey, jwk: { ...jwk, kid, alg: 'RS256', use: 'sig' } }
}

/** Signs a token with the given key. `header` overrides let tests lie about alg / kid. */
export async function signAsymmetric(key: TestKey, claims: Record<string, unknown>, header: Record<string, unknown> = {}): Promise<string> {
  const head = part({ alg: key.alg, typ: 'JWT', kid: key.kid, ...header })
  const body = part(claims)
  const data = enc.encode(`${head}.${body}`)
  const sig = new Uint8Array(
    await crypto.subtle.sign(key.alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' }, key.privateKey, data),
  )
  return `${head}.${body}.${b64url(sig)}`
}

/** HS256 token signed with an arbitrary secret (to show a public key cannot be replayed as an HMAC secret). */
export async function signHmacWith(secretBytes: Uint8Array, claims: Record<string, unknown>, kid?: string): Promise<string> {
  const head = part({ alg: 'HS256', typ: 'JWT', ...(kid ? { kid } : {}) })
  const body = part(claims)
  const key = await crypto.subtle.importKey('raw', secretBytes as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${head}.${body}`)))
  return `${head}.${body}.${b64url(sig)}`
}

export const jwksOf = (...keys: TestKey[]) => ({ keys: keys.map((k) => k.jwk) })

/** A fetch that serves a mutable JWKS document and counts requests. */
export function jwksFetch(doc: { keys: unknown[] }) {
  const state = { count: 0, doc, status: 200 }
  const f = (async () => {
    state.count++
    return state.status === 200 ? Response.json(state.doc) : new Response('no', { status: state.status })
  }) as unknown as typeof fetch
  return Object.assign(f, { state })
}
