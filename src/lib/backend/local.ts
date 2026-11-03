import type { AuthProvider, AuthResult, AuthSession, Repository } from './types.ts'

/**
 * Offline adapter. It reproduces what the app did before a backend existed:
 * any credentials are accepted, the "session" lives only in the persisted store,
 * and the repository is a no-op because the Zustand store already persists everything to localStorage.
 */
const localSession = (email: string, name: string): AuthSession => ({
  user: { id: 'local', email, name: name || email.split('@')[0] || 'Você' },
  accessToken: null,
})

export function createLocalAuth(): AuthProvider {
  const listeners = new Set<(s: AuthSession | null) => void>()
  let current: AuthSession | null = null
  const emit = (s: AuthSession | null) => {
    current = s
    listeners.forEach((cb) => cb(s))
  }
  return {
    kind: 'local',
    async signUp({ email, name }): Promise<AuthResult> {
      const session = localSession(email, name)
      emit(session)
      return { ok: true, session }
    },
    async signIn({ email }): Promise<AuthResult> {
      const session = localSession(email, '')
      emit(session)
      return { ok: true, session }
    },
    async signInWithOAuth() {
      return { ok: false as const, error: 'O login com Google não está disponível nesta versão.' }
    },
    async signOut() {
      emit(null)
    },
    async resetPassword() {
      return { ok: false as const, error: 'A recuperação de senha não está disponível nesta versão.' }
    },
    async updatePassword() {
      return { ok: false as const, error: 'A recuperação de senha não está disponível nesta versão.' }
    },
    onPasswordRecovery() {
      return () => {}
    },
    async getSession() {
      return current
    },
    onChange(cb) {
      listeners.add(cb)
      return () => void listeners.delete(cb)
    },
  }
}

export function createLocalRepository(): Repository {
  return {
    kind: 'local',
    listBrands: async () => [],
    upsertBrands: async () => {},
    deleteBrands: async () => {},
    listGenerations: async () => [],
    saveGeneration: async () => {},
    listLibrary: async () => [],
    upsertLibrary: async () => {},
    deleteLibrary: async () => {},
    getPlanUsage: async () => null,
  }
}
