import type { AiHealth } from '../../lib/staff'

/** Thresholds behind the overall status pill. Percentages are of calls in the selected range. */
export const HEALTH_THRESHOLDS = {
  /** At or above this success rate (and no recent error) the AI is "Saudável". */
  healthyMinSuccessPct: 95,
  /** Below this success rate the AI is "Fora do ar". Between the two it is "Instável". */
  downBelowSuccessPct: 70,
  /** An error this recent counts against the status (config errors mean the AI cannot run at all). */
  recentErrorWindowMs: 15 * 60_000,
} as const

export type HealthStatus = 'healthy' | 'unstable' | 'down' | 'unknown'

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  healthy: 'Saudável',
  unstable: 'Instável',
  down: 'Fora do ar',
  unknown: 'Sem chamadas no período',
}

/** One status from the success rate and the most recent error. */
export function healthStatus(h: Pick<AiHealth, 'totals' | 'lastError' | 'providers'>, now = Date.now()): HealthStatus {
  const { successRate, calls } = h.totals
  if (calls === 0 || successRate === null) return h.providers.length > 0 && h.providers.every((p) => !p.configured) ? 'down' : 'unknown'
  const recent = h.lastError && now - h.lastError.at <= HEALTH_THRESHOLDS.recentErrorWindowMs ? h.lastError : null
  if (successRate < HEALTH_THRESHOLDS.downBelowSuccessPct) return 'down'
  if (recent?.outcome === 'config') return 'down'
  if (successRate < HEALTH_THRESHOLDS.healthyMinSuccessPct || recent) return 'unstable'
  return 'healthy'
}

/** Short bucket label: hour for the 24 h range, day/month otherwise. */
export function bucketLabel(iso: string, range: AiHealth['range']): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return range === '24h' ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
