import type { Brand, Generation, LibraryItem, PlanId, SegmentId } from '../types.ts'

/** Minimal identity the app needs from an auth provider. */
export interface AuthUser {
  /** Stable id: Supabase user uuid, or "local" for the offline adapter. */
  id: string
  email: string
  name: string
  /** Business name and segment captured at sign-up (stored as user metadata). */
  company?: string
  segment?: SegmentId
}

export interface AuthSession {
  user: AuthUser
  /** JWT sent as "Authorization: Bearer" to the API. Null for the local adapter. */
  accessToken: string | null
}

export type AuthResult = { ok: true; session: AuthSession | null; needsConfirmation?: boolean } | { ok: false; error: string }

export interface AuthProvider {
  readonly kind: 'local' | 'supabase'
  signUp(input: { email: string; password: string; name: string; company?: string; segment?: SegmentId }): Promise<AuthResult>
  signIn(input: { email: string; password: string }): Promise<AuthResult>
  /**
   * Starts an OAuth sign-in (full-page redirect to the provider). `ok: true` means the browser is leaving the page;
   * the session is picked up on return via getSession / onChange.
   */
  signInWithOAuth(provider: 'google'): Promise<{ ok: true } | { ok: false; error: string }>
  signOut(): Promise<void>
  /** Sends the "set a new password" e-mail. The local adapter has no passwords, so it reports that it is unavailable. */
  resetPassword(email: string): Promise<{ ok: true } | { ok: false; error: string }>
  /** Sets the password of the signed-in (recovery) session. */
  updatePassword(password: string): Promise<{ ok: true } | { ok: false; error: string }>
  /** Fires when the app is opened from a password-recovery link. Returns the unsubscribe function. */
  onPasswordRecovery(cb: () => void): () => void
  getSession(): Promise<AuthSession | null>
  /** Subscribes to sign-in / sign-out / token refresh. Returns the unsubscribe function. */
  onChange(cb: (session: AuthSession | null) => void): () => void
}

export interface PlanUsage {
  plan: PlanId
  /** Contents used in the current billing month. */
  used: number
  /** Subscription status as stored by the billing webhook, if any. */
  status: string | null
}

/**
 * Per-user persistence. Every method is scoped to the signed-in user (Row Level Security on Supabase).
 * The local adapter does nothing: the persisted Zustand store already is the local database.
 */
export interface Repository {
  readonly kind: 'local' | 'supabase'
  listBrands(): Promise<Brand[]>
  upsertBrands(brands: Brand[]): Promise<void>
  deleteBrands(ids: string[]): Promise<void>
  listGenerations(limit?: number): Promise<Generation[]>
  saveGeneration(gen: Generation, brandId?: string): Promise<void>
  listLibrary(): Promise<LibraryItem[]>
  upsertLibrary(items: LibraryItem[]): Promise<void>
  deleteLibrary(ids: string[]): Promise<void>
  /** Read-only: written by the billing webhook with the service role. */
  getPlanUsage(): Promise<PlanUsage | null>
}

export interface Backend {
  kind: 'local' | 'supabase'
  auth: AuthProvider
  repo: Repository
}
