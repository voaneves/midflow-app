/** A repository failure that keeps the Postgres SQLSTATE (when the backend reported one). */
export class RepoError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'RepoError'
    this.code = code
  }
}

/**
 * SQLSTATEs that mean "this row will never be accepted as is": 23514 = check violation (size caps in the schema),
 * 54000 = program limit exceeded (row or index too big). Retrying the same row is pointless.
 */
export const isPermanentRowError = (e: unknown): boolean => {
  const code = (e as { code?: unknown } | null)?.code
  return code === '23514' || code === '54000'
}
