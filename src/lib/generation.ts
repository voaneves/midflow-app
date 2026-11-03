/**
 * Generation request policy shared by the store and the UI: how many times a temporary AI failure is retried,
 * how long to wait between tries, and the typed errors the API can answer with.
 */

/** Wait before each automatic retry (ms): 5 s, 15 s, 30 s. */
export const RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const
export const MAX_RETRIES = RETRY_DELAYS_MS.length

export interface RetryInfo {
  /** 1-based number of the retry about to run. */
  attempt: number
  max: number
  delayMs: number
}

export type GenerateErrorCode = 'quota' | 'auth' | 'account'

/** An API answer the UI treats specially: plan limit reached (402), invalid session (401) or an account needed for AI. */
export class GenerateError extends Error {
  readonly code: GenerateErrorCode
  constructor(code: GenerateErrorCode, message: string) {
    super(message)
    this.name = 'GenerateError'
    this.code = code
  }
}

export const ACCOUNT_REQUIRED_MESSAGE = 'Crie uma conta gratuita para gerar com IA.'

/** Resolves after `ms`, or rejects with an AbortError as soon as `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
