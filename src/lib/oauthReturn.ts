/**
 * Remembers across the provider redirect that this tab started an OAuth sign-in, so that only the return
 * from that flow (and not any persisted session) signs the user into the app.
 */
const KEY = 'mf.oauth-pending'

export function markOAuthPending(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // Storage blocked: the return will still hold a session, but the user must open the app themselves.
  }
}

export function clearOAuthPending(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function isOAuthPending(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Same idea for the password-recovery link: supabase-js reports PASSWORD_RECOVERY once the "?code=" in the e-mail link
 * has been exchanged. The flag lets /nova-senha tell a real recovery session from a plain visit to that address.
 */
const RECOVERY_KEY = 'mf.recovery-pending'

export function markRecoveryPending(): void {
  try {
    sessionStorage.setItem(RECOVERY_KEY, '1')
  } catch {
    // Storage blocked: the new-password screen will ask for a fresh link.
  }
}

export function clearRecoveryPending(): void {
  try {
    sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    // ignore
  }
}

export function isRecoveryPending(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}
