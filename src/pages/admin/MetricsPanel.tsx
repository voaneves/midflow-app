import { useEffect, useState } from 'react'
import { Button, Spinner } from '../../components/ui'
import { staffApi, type Credential, type Metrics } from '../../lib/staff'
import { AI_KIND_LABEL, fmtDateTime, fmtMs, fmtNum, fmtPct } from './format'
import { Card, Notice, Stat, TableWrap, td, th } from './shared'

const USAGE_LABEL: Record<string, string> = {
  downloads: 'Downloads',
  edits: 'Edições',
  saves: 'Salvos na biblioteca',
  captionCopies: 'Legendas copiadas',
  newVersions: 'Novas versões',
  clientFallbacks: 'Gerações sem servidor',
}

export function MetricsPanel({ cred }: { cred: Credential }) {
  const [data, setData] = useState<Metrics | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    const res = await staffApi.metrics(cred)
    if (res.ok) setData(res.data)
    else setError(res.error)
  }

  useEffect(() => {
    let live = true
    void staffApi.metrics(cred).then((res) => {
      if (!live) return
      if (res.ok) setData(res.data)
      else setError(res.error)
    })
    return () => {
      live = false
    }
  }, [cred])

  if (error)
    return (
      <div className="grid gap-3">
        <Notice tone="error">{error}</Notice>
        <div>
          <Button variant="secondary" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  if (!data) return <Spinner label="Carregando métricas" />

  const unavailable = data.aiUnavailable

  return (
    <div className="grid gap-5">
      <p className="text-sm text-fg-subtle">Últimos {data.periodDays} dias.</p>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gerações" value={fmtNum(data.generations)} />
        <Stat label="Negócios atendidos" value={fmtNum(data.businesses)} />
        <Stat label="Parte feita com IA" value={fmtPct(data.aiShare)} />
        <Stat label="Qualidade média (IA)" value={fmtNum(data.avgQualityAI, 1)} hint={`Geral: ${fmtNum(data.avgQualityAll, 1)}`} />
        <Stat label="Latência média (IA)" value={fmtMs(data.avgLatencyMs)} />
        <Stat label="Avaliação dos clientes" value={data.ratings.count ? `${fmtNum(data.ratings.average, 1)}/5` : '—'} hint={`${fmtNum(data.ratings.count)} ${data.ratings.count === 1 ? 'avaliação' : 'avaliações'}`} />
        <Stat label="Pedidos de revisão" value={fmtNum(data.reviewRequests)} />
        <Stat label="IA indisponível" value={fmtNum(unavailable?.total)} hint="Resultados entregues com modelos de reserva" />
      </dl>

      <Card title="Falhas da IA por tipo">
        {unavailable ? (
          <TableWrap label="Falhas da IA por tipo">
            <table className="w-full border-collapse">
              <caption className="sr-only">Falhas da IA por tipo: respostas entregues com modelos de reserva</caption>
              <thead className="border-b border-line bg-slate-50">
                <tr>
                  <th scope="col" className={th}>
                    Tipo
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Ocorrências
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(['transient', 'daily_cap', 'config'] as const).map((k) => (
                  <tr key={k}>
                    <th scope="row" className={`${td} text-left font-medium`}>
                      {AI_KIND_LABEL[k]}
                    </th>
                    <td className={`${td} text-right tabular-nums`}>{fmtNum(unavailable[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <p className="text-sm text-fg-subtle">Sem dados de falhas neste período.</p>
        )}
      </Card>

      <Card title="Uso">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {Object.entries(data.usage ?? {}).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold text-fg-muted">{USAGE_LABEL[k] ?? k}</dt>
              <dd className="font-bold tabular-nums">{fmtNum(v)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Principais problemas de qualidade">
          {data.topIssues.length === 0 ? (
            <p className="text-sm text-fg-subtle">Nenhum problema registrado.</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {data.topIssues.map((t) => (
                <li key={t.issue} className="flex justify-between gap-3">
                  <span>{t.issue}</span>
                  <b className="tabular-nums">{fmtNum(t.n)}</b>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Últimos erros da IA">
          {data.aiErrors.length === 0 ? (
            <p className="text-sm text-fg-subtle">Nenhum erro registrado.</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {data.aiErrors.map((e, i) => (
                <li key={i}>
                  <span className="text-fg-muted">{fmtDateTime(e.at)}</span> · {e.error}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Comentários recentes">
        {data.recentFeedback.length === 0 ? (
          <p className="text-sm text-fg-subtle">Nenhum comentário ainda.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {data.recentFeedback.map((f, i) => (
              <li key={i}>
                <b>{f.rating}/5</b> {f.brandName ? `· ${f.brandName} ` : ''}
                <span className="text-fg-muted">({fmtDateTime(f.at)})</span>: {f.comment}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
