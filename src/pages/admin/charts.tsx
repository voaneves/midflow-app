import { useId, useState } from 'react'
import { cx } from '../../components/ui'

/**
 * Lightweight inline-SVG charts for the staff panel (no chart library).
 * Colors come from CSS custom properties declared on `.viz-root` (see vizCss.ts; light and dark values), never hard-coded here.
 * Each chart exposes a text summary (aria-label) and a visually hidden data table, and shows a hover/focus readout.
 */

export interface ChartPoint {
  label: string
  /** Full readout text for the hover/focus line. */
  readout: string
}

const W = 640
const H = 190
const PAD = { l: 44, r: 12, t: 10, b: 24 }
const plotW = W - PAD.l - PAD.r
const plotH = H - PAD.t - PAD.b

function niceMax(v: number): number {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / pow) * pow
}

function Axes({ max, unit, labels }: { max: number; unit: string; labels: string[] }) {
  const ticks = [0, 0.5, 1]
  const n = labels.length
  const xs = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0]
  return (
    <g fontSize="11" fill="var(--viz-text-2)">
      {ticks.map((t) => {
        const y = PAD.t + plotH - t * plotH
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--viz-grid)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end">
              {Math.round(max * t).toLocaleString('pt-BR')}
              {t === 1 && unit ? ` ${unit}` : ''}
            </text>
          </g>
        )
      })}
      {xs.map((i, k) => {
        const x = PAD.l + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
        return (
          <text key={i} x={x} y={H - 6} textAnchor={k === 0 ? 'start' : k === xs.length - 1 && xs.length > 1 ? 'end' : 'middle'}>
            {labels[i]}
          </text>
        )
      })}
    </g>
  )
}

function Frame({ title, summary, readout, legend, children, table }: { title: string; summary: string; readout: string; legend: React.ReactNode; children: React.ReactNode; table: React.ReactNode }) {
  const id = useId()
  return (
    <figure className="viz-root rounded-2xl border border-line p-4" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="text-sm font-bold">
        {title}
      </figcaption>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--viz-text-2)' }}>
        {legend}
      </div>
      <p className="mt-2 min-h-5 text-xs font-semibold tabular-nums" aria-hidden>
        {readout}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="mt-1 h-auto w-full">
        {children}
      </svg>
      <div className="sr-only">{table}</div>
    </figure>
  )
}

export function Swatch({ color, shape = 'square' }: { color: string; shape?: 'square' | 'line' }) {
  return shape === 'line' ? (
    <span aria-hidden className="inline-block h-0.5 w-4 align-middle" style={{ background: color }} />
  ) : (
    <span aria-hidden className="inline-block size-2.5 rounded-sm align-middle" style={{ background: color }} />
  )
}

/** Stacked bars: concluded calls (bottom) and fallbacks (top), one bar per time bucket. */
export function CallsChart({ points, ok, fallback, labels, title, summary }: { points: ChartPoint[]; ok: number[]; fallback: number[]; labels: string[]; title: string; summary: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = points.length
  const max = niceMax(Math.max(0, ...ok.map((v, i) => v + fallback[i])))
  const slot = n ? plotW / n : plotW
  const bw = Math.max(2, Math.min(28, slot - 4))
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH
  const totals = ok.reduce((a, b) => a + b, 0)
  return (
    <Frame
      title={title}
      summary={summary}
      readout={hover !== null ? points[hover].readout : `Total no período: ${totals.toLocaleString('pt-BR')} concluídas. Passe o cursor sobre uma barra.`}
      legend={
        <>
          <span>
            <Swatch color="var(--viz-s1)" /> Concluídas pela IA
          </span>
          <span>
            <Swatch color="var(--viz-s2)" /> Modelo de reserva (fallback)
          </span>
        </>
      }
      table={
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Período</th>
              <th scope="col">Concluídas pela IA</th>
              <th scope="col">Fallbacks</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <th scope="row">{p.label}</th>
                <td>{ok[i]}</td>
                <td>{fallback[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <Axes max={max} unit="" labels={labels} />
      {points.map((_, i) => {
        const x = PAD.l + i * slot + (slot - bw) / 2
        const okH = (ok[i] / max) * plotH
        const fbH = (fallback[i] / max) * plotH
        return (
          <g key={i} className="viz-bar" opacity={hover === null || hover === i ? 1 : 0.55}>
            {ok[i] > 0 && <rect x={x} y={y(ok[i])} width={bw} height={okH} rx="3" fill="var(--viz-s1)" stroke="var(--viz-surface)" strokeWidth="2" />}
            {fallback[i] > 0 && <rect x={x} y={y(ok[i] + fallback[i])} width={bw} height={fbH} rx="3" fill="var(--viz-s2)" stroke="var(--viz-surface)" strokeWidth="2" />}
            <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          </g>
        )
      })}
    </Frame>
  )
}

/** Single line (p95 latency). Gaps (null) break the line. */
export function LatencyChart({ points, values, labels, title, summary }: { points: ChartPoint[]; values: (number | null)[]; labels: string[]; title: string; summary: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = points.length
  const real = values.filter((v): v is number => v !== null)
  const max = niceMax(Math.max(0, ...real))
  const x = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v === null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `
    pen = true
  })
  return (
    <Frame
      title={title}
      summary={summary}
      readout={hover !== null ? points[hover].readout : 'Passe o cursor sobre o gráfico para ver cada período.'}
      legend={
        <span>
          <Swatch color="var(--viz-s3)" shape="line" /> Latência p95 (ms)
        </span>
      }
      table={
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Período</th>
              <th scope="col">Latência p95 (ms)</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <th scope="row">{p.label}</th>
                <td>{values[i] ?? 'sem dados'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <Axes max={max} unit="ms" labels={labels} />
      {d && <path d={d} fill="none" stroke="var(--viz-s3)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {values.map((v, i) =>
        v === null ? null : (
          <circle key={i} className="viz-dot" cx={x(i)} cy={y(v)} r={hover === i ? 5 : n > 40 ? 2 : 3.5} fill="var(--viz-s3)" stroke="var(--viz-surface)" strokeWidth="2" />
        ),
      )}
      {points.map((_, i) => (
        <rect key={i} x={x(i) - plotW / n / 2} y={PAD.t} width={plotW / n} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
      ))}
    </Frame>
  )
}

/** Horizontal usage gauge for a daily cap. `max` null = no limit. */
export function CapGauge({ label, used, max, className }: { label: string; used: number; max: number | null; className?: string }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0
  const hot = !!max && pct >= 90
  return (
    <div className={cx('rounded-2xl border border-line bg-white p-4 shadow-card', className)}>
      <p className="text-xs font-semibold text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
        {used.toLocaleString('pt-BR')}
        <span className="text-sm font-semibold text-fg-muted"> / {max ? max.toLocaleString('pt-BR') : 'sem limite'}</span>
      </p>
      {max ? (
        <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(used, max)} aria-valuetext={`${used} de ${max} (${pct}%)`} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={cx('h-full rounded-full', hot ? 'bg-danger' : 'bg-brand-700')} style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-fg-subtle">Nenhum teto diário configurado.</p>
      )}
    </div>
  )
}
