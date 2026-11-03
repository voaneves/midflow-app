/**
 * Staff authorization (RBAC) for /api/admin/*.
 *
 * Two kinds of Bearer credentials reach the admin routes:
 *   1. ADMIN_TOKEN: the shared break-glass secret, always an "admin" (audit label "admin-token").
 *   2. A Supabase session JWT of a user listed in public.staff_members, with role "admin" or "editor".
 * The token is compared first (constant time); only if it does not match is it treated as a JWT.
 * Customers (valid JWT, not staff) get 403; missing or invalid credentials get 401.
 */
import type { IncomingMessage } from 'http'
import { verifyAccessToken, getBearerToken, type AuthConfig, type AuthenticatedUser } from './auth.ts'
import { config, getDbConfig, supabaseJwtSecret } from './config.ts'
import { getStaffRole, type DbConfig, type StaffRole } from './db/supabase.ts'
import { HttpError, rateLimit, safeEqual } from './http.ts'

export type { StaffRole }

export interface StaffIdentity {
  role: StaffRole
  /** auth.users id; null for the ADMIN_TOKEN identity. */
  userId: string | null
  via: 'token' | 'session'
  /** Written to review_events.actor_label. */
  label: string
}

export type Caller =
  | { kind: 'anonymous' }
  | { kind: 'invalid' }
  | { kind: 'customer'; user: AuthenticatedUser }
  | { kind: 'staff'; staff: StaffIdentity }

const ROLE_CACHE_MS = 60_000
const ADMIN_AUTH_FAILS_PER_HOUR = 20
const roleCache = new Map<string, { role: StaffRole | null; until: number }>()

/** Forget cached roles (after a staff change, and between tests). Other isolates catch up within a minute. */
export function clearStaffCache(userId?: string) {
  if (userId) roleCache.delete(userId)
  else roleCache.clear()
}

async function roleOf(db: DbConfig, userId: string, now = Date.now()): Promise<StaffRole | null> {
  const hit = roleCache.get(userId)
  if (hit && hit.until > now) return hit.role
  let role: StaffRole | null
  try {
    role = await getStaffRole(db, userId)
  } catch {
    throw new HttpError(503, 'Não foi possível verificar suas permissões agora. Tente novamente.')
  }
  roleCache.set(userId, { role, until: now + ROLE_CACHE_MS })
  if (roleCache.size > 500) for (const [k, v] of roleCache) if (v.until <= now) roleCache.delete(k)
  return role
}

/**
 * How session tokens are verified: ES256/RS256 through the project's JWKS (needs only SUPABASE_URL),
 * plus legacy HS256 when SUPABASE_JWT_SECRET is set.
 */
function authConfig(): AuthConfig {
  return { supabaseUrl: getDbConfig()?.url ?? (process.env.SUPABASE_URL?.trim().replace(/\/+$/, '') || undefined), hs256Secret: supabaseJwtSecret() }
}

const canVerifySessions = (c: AuthConfig) => !!(c.supabaseUrl || c.hs256Secret)

/** Whether staff routes can work at all: the shared token, or Supabase sessions plus the database (the role table). */
export function staffAccessConfigured(): boolean {
  return !!config.adminToken || !!(canVerifySessions(authConfig()) && getDbConfig())
}

/** Classifies the Bearer credential of a request. Never throws except when the role lookup itself fails. */
export async function identifyCaller(req: IncomingMessage): Promise<Caller> {
  const header = String(req.headers.authorization || '').trim()
  const raw = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim()
  if (!raw) return { kind: 'anonymous' }

  if (config.adminToken && safeEqual(raw, config.adminToken)) {
    return { kind: 'staff', staff: { role: 'admin', userId: null, via: 'token', label: 'admin-token' } }
  }

  const cfg = authConfig()
  const token = getBearerToken(header)
  if (!canVerifySessions(cfg) || !token) return { kind: 'invalid' }
  const user = await verifyAccessToken(token, cfg)
  if (!user) return { kind: 'invalid' }

  const db = getDbConfig()
  const role = db ? await roleOf(db, user.id) : null
  if (!role) return { kind: 'customer', user }
  return { kind: 'staff', staff: { role, userId: user.id, via: 'session', label: `${role}:${user.id}` } }
}

/** The staff identity of the request, or null (anonymous, invalid token, customer). */
export async function resolveStaff(req: IncomingMessage): Promise<StaffIdentity | null> {
  const caller = await identifyCaller(req)
  return caller.kind === 'staff' ? caller.staff : null
}

/**
 * Guard for admin routes. `allow` lists the roles that may call the route (default: any staff).
 * 404 when no staff access is configured at all, 401 without valid credentials, 403 for customers and wrong roles.
 */
export async function requireStaff(req: IncomingMessage, allow: readonly StaffRole[] = ['admin', 'editor']): Promise<StaffIdentity> {
  if (!staffAccessConfigured()) throw new HttpError(404, 'Not found')
  const caller = await identifyCaller(req)
  if (caller.kind === 'anonymous') throw new HttpError(401, 'Não autorizado.')
  // A Bearer credential that does not grant access counts against a small per-IP budget, so the shared token cannot be guessed freely.
  if (caller.kind === 'invalid') {
    await rateLimit(req, 'admin-auth', ADMIN_AUTH_FAILS_PER_HOUR)
    throw new HttpError(401, 'Não autorizado.')
  }
  if (caller.kind === 'customer') {
    await rateLimit(req, 'admin-auth', ADMIN_AUTH_FAILS_PER_HOUR)
    throw new HttpError(403, 'Acesso restrito à equipe.')
  }
  if (!allow.includes(caller.staff.role)) throw new HttpError(403, 'Seu perfil não tem permissão para esta ação.')
  return caller.staff
}

/** Optional end-user auth for the generation routes: null = anonymous; an invalid Bearer token is a 401. */
export async function optionalUser(req: IncomingMessage): Promise<AuthenticatedUser | null> {
  const cfg = authConfig()
  const token = getBearerToken(String(req.headers.authorization || ''))
  if (!token || !canVerifySessions(cfg)) return null
  const user = await verifyAccessToken(token, cfg)
  if (!user) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.')
  return user
}

/** Required end-user auth (billing, "my reviews"). */
export async function requireUser(req: IncomingMessage, message = 'Entre na sua conta para continuar.'): Promise<AuthenticatedUser> {
  const user = await optionalUser(req)
  if (!user) throw new HttpError(401, message)
  return user
}
