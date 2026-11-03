/**
 * Supabase JWT verification with Web Crypto only, so the same code runs in Node and in the Cloudflare Worker.
 * Supports ES256 / RS256 (public keys from the project's JWKS endpoint) and the legacy HS256 "JWT secret".
 *
 * No dependencies; the only I/O is the cached JWKS request. Time and fetch are injectable for tests.
 * Failure never throws: callers get null.
 */

export interface AuthenticatedUser {
  /** auth.users.id (the JWT "sub" claim). */
  id: string
  email: string | null
  /** Supabase "role" claim: always "authenticated" (other roles are rejected). */
  role: string
  /** Token expiry, seconds since epoch. */
  exp: number
}

export interface VerifyOptions {
  /** Current time in seconds. Defaults to Date.now()/1000. */
  now?: number
  /** Accepted clock skew in seconds. */
  leewaySec?: number
  /** Required "aud" claim. Supabase user tokens use "authenticated". */
  audience?: string
  /** Required "iss" claim, when set. verifyAccessToken derives it from the project URL. */
  issuer?: string
}

const encoder = new TextEncoder()

function b64urlToBytes(input: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4)
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function parseJson(bytes: Uint8Array | null): Record<string, unknown> | null {
  if (!bytes) return null
  try {
    const v: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Extracts the token from "Authorization: Bearer <token>" (case-insensitive scheme). */
export function getBearerToken(header: string | null | undefined): string | null {
  if (!header) return null
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]+)\s*$/i.exec(header)
  return m ? m[1] : null
}

/* ------------------------------------------------------------------ */
/* Claims                                                              */
/* ------------------------------------------------------------------ */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Time, audience, issuer, role and subject checks shared by every algorithm.
 * Supabase user sessions always carry role "authenticated"; the anon and service_role keys are JWTs too and must not pass.
 */
function userFromClaims(claims: Record<string, unknown>, opts: VerifyOptions): AuthenticatedUser | null {
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const leeway = opts.leewaySec ?? 30
  if (typeof claims.exp !== 'number' || claims.exp + leeway < now) return null
  if (typeof claims.nbf === 'number' && claims.nbf - leeway > now) return null

  const audience = opts.audience ?? 'authenticated'
  const aud = claims.aud
  if (!(aud === audience || (Array.isArray(aud) && aud.includes(audience)))) return null

  if (opts.issuer !== undefined && claims.iss !== opts.issuer) return null
  if (claims.role !== 'authenticated') return null

  const sub = claims.sub
  if (typeof sub !== 'string' || !UUID_RE.test(sub)) return null

  return {
    id: sub.toLowerCase(),
    email: typeof claims.email === 'string' ? claims.email : null,
    role: 'authenticated',
    exp: claims.exp,
  }
}

/* ------------------------------------------------------------------ */
/* HS256 (legacy JWT secret)                                           */
/* ------------------------------------------------------------------ */

/**
 * Legacy HS256 verification. The signature check is constant time (subtle.verify).
 * Returns the user or null. Any alg other than HS256 (including "none") is rejected here.
 */
export async function verifySupabaseJwt(token: string, secret: string, opts: VerifyOptions = {}): Promise<AuthenticatedUser | null> {
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, sig] = parts

  const header = parseJson(b64urlToBytes(h))
  if (!header || header.alg !== 'HS256') return null

  const signature = b64urlToBytes(sig)
  if (!signature || signature.length !== 32) return null

  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(`${h}.${p}`))
  if (!valid) return null

  const claims = parseJson(b64urlToBytes(p))
  return claims ? userFromClaims(claims, opts) : null
}

/* ------------------------------------------------------------------ */
/* ES256 / RS256 (JWKS)                                                */
/* ------------------------------------------------------------------ */

const JWKS_TTL_MS = 10 * 60_000
/** Minimum gap between forced refetches, so a stream of unknown key ids cannot become a stream of outbound requests. */
const JWKS_REFETCH_COOLDOWN_MS = 30_000
const JWKS_TIMEOUT_MS = 3_000

type KeyKind = 'ES256' | 'RS256'
interface CachedKey {
  kind: KeyKind
  jwk: JsonWebKey
  key?: CryptoKey
}
interface JwksEntry {
  keys: Map<string, CachedKey>
  fetchedAt: number
}
const jwksCache = new Map<string, JwksEntry>()

/** Forgets cached key sets (tests, or after rotating keys by hand). */
export function clearJwksCache() {
  jwksCache.clear()
}

/** Accepts only the key shapes Supabase issues: EC P-256 for ES256, RSA >= 2048 bits for RS256, usable for verification. */
function classifyJwk(raw: unknown): { kid: string; cached: CachedKey } | null {
  if (!raw || typeof raw !== 'object') return null
  const k = raw as Record<string, unknown>
  if (typeof k.kid !== 'string' || !k.kid) return null
  if (k.use !== undefined && k.use !== 'sig') return null
  if (k.key_ops !== undefined && !(Array.isArray(k.key_ops) && k.key_ops.includes('verify'))) return null
  if (k.kty === 'EC' && k.crv === 'P-256' && typeof k.x === 'string' && typeof k.y === 'string') {
    if (k.alg !== undefined && k.alg !== 'ES256') return null
    return { kid: k.kid, cached: { kind: 'ES256', jwk: { kty: 'EC', crv: 'P-256', x: k.x, y: k.y, ext: true } } }
  }
  if (k.kty === 'RSA' && typeof k.n === 'string' && typeof k.e === 'string') {
    if (k.alg !== undefined && k.alg !== 'RS256') return null
    const n = b64urlToBytes(k.n)
    if (!n || n.length < 256) return null
    return { kid: k.kid, cached: { kind: 'RS256', jwk: { kty: 'RSA', n: k.n, e: k.e, ext: true } } }
  }
  return null
}

async function fetchJwks(url: string, f: typeof fetch): Promise<JwksEntry | null> {
  try {
    const res = await f(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(JWKS_TIMEOUT_MS) })
    if (!res.ok) return null
    const body: unknown = await res.json()
    const list = (body as { keys?: unknown } | null)?.keys
    if (!Array.isArray(list)) return null
    const keys = new Map<string, CachedKey>()
    for (const raw of list) {
      const c = classifyJwk(raw)
      if (c) keys.set(c.kid, c.cached)
    }
    return { keys, fetchedAt: Date.now() }
  } catch {
    return null
  }
}

/** Looks a key up by kid: from the cache (10 min), refetching once when the kid is unknown. Stale keys beat no keys if Supabase is unreachable. */
async function getJwk(jwksUrl: string, kid: string, f: typeof fetch): Promise<CachedKey | null> {
  let entry = jwksCache.get(jwksUrl)
  if (!entry || Date.now() - entry.fetchedAt > JWKS_TTL_MS) {
    const fresh = await fetchJwks(jwksUrl, f)
    if (fresh) jwksCache.set(jwksUrl, (entry = fresh))
    else if (!entry) return null
  }
  const hit = entry.keys.get(kid)
  if (hit) return hit
  if (Date.now() - entry.fetchedAt < JWKS_REFETCH_COOLDOWN_MS) return null
  const fresh = await fetchJwks(jwksUrl, f)
  if (!fresh) return null
  jwksCache.set(jwksUrl, fresh)
  return fresh.keys.get(kid) ?? null
}

async function importVerifyKey(c: CachedKey): Promise<CryptoKey> {
  if (c.key) return c.key
  c.key =
    c.kind === 'ES256'
      ? await crypto.subtle.importKey('jwk', c.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
      : await crypto.subtle.importKey('jwk', c.jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  return c.key
}

export interface AuthConfig {
  /** https://<project>.supabase.co. Enables ES256/RS256 (JWKS) and the issuer check. */
  supabaseUrl?: string
  /** Legacy HS256 "JWT secret". HS256 tokens are rejected when this is not set. */
  hs256Secret?: string
  /** Test hook for the JWKS request. */
  fetch?: typeof fetch
}

/**
 * Verifies a Supabase access token. The algorithm named in the (untrusted) header only selects which verifier runs;
 * it is never derived from the key, so a public key cannot be replayed as an HMAC secret:
 *   ES256  -> JWKS key with kty EC / crv P-256, ECDSA SHA-256, 64-byte raw signature
 *   RS256  -> JWKS key with kty RSA, RSASSA-PKCS1-v1_5 SHA-256
 *   HS256  -> only when a secret is configured
 * Everything else (none, HS384, PS256...) is rejected. The issuer must be `${supabaseUrl}/auth/v1` when the URL is known,
 * and the role must be "authenticated".
 */
export async function verifyAccessToken(token: string, cfg: AuthConfig, opts: VerifyOptions = {}): Promise<AuthenticatedUser | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const header = parseJson(b64urlToBytes(parts[0]))
  if (!header || typeof header.alg !== 'string') return null

  const baseUrl = cfg.supabaseUrl?.trim().replace(/\/+$/, '')
  const o: VerifyOptions = { ...opts, issuer: opts.issuer ?? (baseUrl ? `${baseUrl}/auth/v1` : undefined) }

  if (header.alg === 'HS256') return cfg.hs256Secret ? verifySupabaseJwt(token, cfg.hs256Secret, o) : null
  if (header.alg !== 'ES256' && header.alg !== 'RS256') return null
  if (!baseUrl || typeof header.kid !== 'string' || !header.kid) return null

  const signature = b64urlToBytes(parts[2])
  if (!signature) return null
  if (header.alg === 'ES256' && signature.length !== 64) return null

  const found = await getJwk(`${baseUrl}/auth/v1/.well-known/jwks.json`, header.kid, cfg.fetch ?? fetch)
  if (!found || found.kind !== header.alg) return null

  let valid = false
  try {
    const key = await importVerifyKey(found)
    const data = encoder.encode(`${parts[0]}.${parts[1]}`)
    valid =
      found.kind === 'ES256'
        ? await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, data)
        : await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, signature, data)
  } catch {
    return null
  }
  if (!valid) return null

  const claims = parseJson(b64urlToBytes(parts[1]))
  return claims ? userFromClaims(claims, o) : null
}

/** Convenience for route handlers: header value + config in, user or null out. A plain string is treated as the HS256 secret. */
export async function authenticate(authorizationHeader: string | null | undefined, cfg: AuthConfig | string | undefined, opts?: VerifyOptions): Promise<AuthenticatedUser | null> {
  const c: AuthConfig | undefined = typeof cfg === 'string' ? { hs256Secret: cfg } : cfg
  if (!c || (!c.hs256Secret && !c.supabaseUrl)) return null
  const token = getBearerToken(authorizationHeader)
  return token ? verifyAccessToken(token, c, opts) : null
}

/** Test helper and local tooling: signs a Supabase-shaped HS256 token. Not used by request handling. */
export async function signHs256Jwt(claims: Record<string, unknown>, secret: string): Promise<string> {
  const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const head = b64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64url(encoder.encode(JSON.stringify(claims)))
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${head}.${body}`)))
  return `${head}.${body}.${b64url(sig)}`
}
