import { CheckCircle2, FlaskConical, ShieldAlert, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, ChoiceGroup, ConfirmDialog, Spinner } from '../../components/ui'
import { staffApi, type AiHealth, type AiRange, type Credential } from '../../lib/staff'
import { bucketLabel, HEALTH_LABEL, HEALTH_THRESHOLDS, healthStatus, type HealthStatus } from './aiHealthLogic'
import { CallsChart, CapGauge, LatencyChart } from './charts'
import { AI_KIND_LABEL, fmtDateTime, fmtMs, fmtNum, fmtPct } from './format'
import { Card, Notice, StatusPill, TableWrap, td, th } from './shared'
import { VIZ_CSS } from './vizCss'

/** The panel re-reads the endpoint at this interval while the tab is visible. */
const REFRESH_MS = 60_000

const RANGES: { value: AiRange; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
]

const PILL: Record<HealthStatus, { tone: 'ok' | 'warn' | 'bad' | 'neutral'; Icon: typeof CheckCircle2 }> = {
  healthy: { tone: 'ok', Icon: CheckCircle2 },
  unstable: { tone: 'warn', Icon: ShieldAlert },
  down: { tone: 'bad', Icon: XCircle },
  unknown: { tone: 'neutral', Icon: ShieldAlert },
}

export function AiHealthPanel({ cred }: { cred: Credential }) {
  const [range, setRange] = useState<AiRange>('24h')
  const [data, setData] = useState<AiHealth | null>(null)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [confirmTest, setConfirmTest] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [tick, setTick] = useState(0)
  const reload = () => setTick((n) => n + 1)

  useEffect(() => {
    let live = true
    const fetchNow = () =>
      void staffApi.aiHealth(cred, range).then((res) => {
        if (!live) return // another range or a closed tab owns the screen now
        if (res.ok) {
          setData(res.data)
          setError('')
          setUpdatedAt(Date.now())
        } else setError(res.error)
      })
    fetchNow()
    // Auto-refresh while the tab is visible.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNow()
    }, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNow()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      live = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [cred, range, tick])

  const runTest = async () => {
    setConfirmTest(false)
    setTesting(true)
    setTestResult(null)
    const res = await staffApi.testAi(cred)
    setTesting(false)
    if (res.ok) setTestResult({ ok: res.data.ok, message: res.data.message || (res.data.ok ? 'A IA respondeu normalmente.' : 'A IA não respondeu.') })
    else setTestResult({ ok: false, message: res.error })
    reload()
  }

  if (!data && !error) return <Spinner label="Carregando saúde da IA" />

  const status = data ? healthStatus(data) : 'unknown'
  const { Icon, tone } = PILL[status]
  const series = data?.series ?? []
  const labels = series.map((s) => bucketLabel(s.bucket, range))
  const unitWord = range === '24h' ? 'hora' : 'dia'
  const points = series.map((s, i) => ({
    label: labels[i],
    readout: `${labels[i]}: ${s.calls} chamadas, ${s.ok} concluídas pela IA, ${s.fallback} fallbacks${s.p95 !== null ? `, p95 ${fmtMs(s.p95)}` : ''}`,
  }))
  const latencyPoints = series.map((s, i) => ({ label: labels[i], readout: `${labels[i]}: p95 ${s.p95 === null ? 'sem dados' : fmtMs(s.p95)}` }))
  const t = data?.totals

  return (
    <div className="grid gap-5">
      <style>{VIZ_CSS}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChoiceGroup legend="Período" legendHidden variant="segmented" value={range} onChange={setRange} options={RANGES} />
        <div className="flex flex-wrap items-center gap-3">
          {data && (
            <StatusPill tone={tone}>
              <Icon className="size-3.5" aria-hidden />
              <span>
                <span className="sr-only">Status geral: </span>
                {HEALTH_LABEL[status]}
              </span>
            </StatusPill>
          )}
          <Button variant="secondary" onClick={() => setConfirmTest(true)} loading={testing}>
            <FlaskConical className="size-4" aria-hidden /> Testar IA agora
          </Button>
        </div>
      </div>

      <p className="text-xs text-fg-subtle">
        Status: &ldquo;Saudável&rdquo; com sucesso de {HEALTH_THRESHOLDS.healthyMinSuccessPct}% ou mais e sem erro nos últimos {HEALTH_THRESHOLDS.recentErrorWindowMs / 60_000} minutos; &ldquo;Fora do ar&rdquo; abaixo de {HEALTH_THRESHOLDS.downBelowSuccessPct}% ou com a IA sem configuração; entre os dois, &ldquo;Instável&rdquo;.
        {updatedAt ? ` Atualizado às ${new Date(updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}; renova sozinho a cada minuto.` : ''}
      </p>

      {error && <Notice tone="error">{error}</Notice>}
      <div role="status">{testResult && <Notice tone={testResult.ok ? 'info' : 'warn'}>{testResult.message}</Notice>}</div>

      {data && t && (
        <>
          {data.storage === 'events' && <Notice tone="warn">O banco de dados não está configurado: o histórico é limitado ao registro de eventos do servidor e pode ser menor que o período escolhido.</Notice>}

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <dt className="text-xs font-semibold text-fg-muted">Taxa de sucesso</dt>
              <dd className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">{fmtPct(t.successRate)}</dd>
              <dd className="mt-1 text-xs text-fg-subtle">
                {fmtNum(t.ok)} de {fmtNum(t.calls)} chamadas
              </dd>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <dt className="text-xs font-semibold text-fg-muted">Fallbacks</dt>
              <dd className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">{fmtNum(t.fallback)}</dd>
              <dd className="mt-1 text-xs text-fg-subtle">
                {AI_KIND_LABEL.transient.toLowerCase()} {fmtNum(t.fallbackByKind.transient)} · limite diário {fmtNum(t.fallbackByKind.daily_cap)} · configuração {fmtNum(t.fallbackByKind.config)}
              </dd>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <dt className="text-xs font-semibold text-fg-muted">Latência p50 / p95</dt>
              <dd className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
                {fmtMs(data.latency.p50)} / {fmtMs(data.latency.p95)}
              </dd>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <dt className="text-xs font-semibold text-fg-muted">Qualidade média</dt>
              <dd className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">{fmtNum(data.quality.avg, 1)}</dd>
              <dd className="mt-1 text-xs text-fg-subtle">{fmtNum(data.quality.belowThreshold)} abaixo do mínimo</dd>
            </div>
          </dl>

          <div className="grid gap-3 sm:grid-cols-2">
            <CapGauge label="Limite diário de textos (hoje)" used={data.dailyCap.text.used} max={data.dailyCap.text.max} />
            <CapGauge label="Limite diário de imagens (hoje)" used={data.dailyCap.images.used} max={data.dailyCap.images.max} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CallsChart
              title={`Chamadas por ${unitWord}`}
              points={points}
              labels={labels}
              ok={series.map((s) => s.ok)}
              fallback={series.map((s) => s.fallback)}
              summary={`Chamadas por ${unitWord}: ${fmtNum(t.ok)} concluídas pela IA e ${fmtNum(t.fallback)} com modelo de reserva em ${series.length} períodos.`}
            />
            <LatencyChart
              title={`Latência p95 por ${unitWord}`}
              points={latencyPoints}
              labels={labels}
              values={series.map((s) => s.p95)}
              summary={`Latência p95 por ${unitWord}. Geral: p50 ${fmtMs(data.latency.p50)}, p95 ${fmtMs(data.latency.p95)}.`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Provedores">
              <TableWrap label="Provedores de IA">
                <table className="w-full border-collapse">
                  <caption className="sr-only">Provedores de IA e se estão configurados</caption>
                  <thead className="border-b border-line bg-slate-50">
                    <tr>
                      <th scope="col" className={th}>
                        Provedor
                      </th>
                      <th scope="col" className={th}>
                        Configurado
                      </th>
                      <th scope="col" className={th}>
                        Modelo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.providers.map((p) => (
                      <tr key={p.name}>
                        <th scope="row" className={`${td} text-left font-semibold`}>
                          {p.name}
                        </th>
                        <td className={td}>{p.configured ? 'Sim' : 'Não'}</td>
                        <td className={td}>{p.model ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <p className="mt-3 text-xs text-fg-subtle">
                Imagens no período: IA {fmtNum(data.images.ai)} · banco de fotos {fmtNum(data.images.stock)} · geradas por modelo {fmtNum(data.images.procedural)}.
              </p>
            </Card>

            <Card title="Último erro">
              {data.lastError ? (
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-fg-muted">Quando</dt>
                    <dd>{fmtDateTime(data.lastError.at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-fg-muted">Rota</dt>
                    <dd>{data.lastError.route}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-fg-muted">Tipo</dt>
                    <dd>{AI_KIND_LABEL[data.lastError.outcome] ?? data.lastError.outcome}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-fg-muted">Código</dt>
                    <dd className="break-all">{data.lastError.errorCode ?? '—'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-fg-subtle">Nenhum erro no período.</p>
              )}
            </Card>
          </div>
        </>
      )}

      <ConfirmDialog open={confirmTest} onClose={() => setConfirmTest(false)} onConfirm={() => void runTest()} title="Testar a IA agora?" confirmLabel="Fazer teste">
        O teste faz uma chamada real ao provedor de IA e pode gerar um pequeno custo. Use só quando precisar confirmar que a IA está respondendo.
      </ConfirmDialog>
    </div>
  )
}
