import type { ReviewStatus } from '../../lib/reviews'

export const fmtDateTime = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export const fmtNum = (n: number | null | undefined, digits = 0): string => (n === null || n === undefined ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: digits }))
export const fmtMs = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : n >= 1000 ? `${fmtNum(n / 1000, 1)} s` : `${fmtNum(n)} ms`)
export const fmtPct = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : `${fmtNum(n, 1)}%`)

export const STATUS_OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Concluída' },
]

export const AI_KIND_LABEL: Record<string, string> = {
  transient: 'Instabilidade',
  daily_cap: 'Limite diário',
  config: 'Configuração',
}

export const ENGINE_LABEL: Record<string, string> = {
  gemini: 'IA',
  openai: 'IA',
  template: 'Modelo de reserva',
  local: 'Modelo offline',
}

