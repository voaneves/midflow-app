import { BarChart3, CalendarCheck2, CheckCircle2, Circle, Compass, PenSquare, Sparkles, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CountUp } from '../../components/motion'
import { Button, Card, cx, ProgressBar, UsageMeter } from '../../components/ui'
import { planDef } from '../../lib/data'
import { getSocialTips } from '../../lib/social'
import { useApp } from '../../lib/store'

const WEEKLY_GOAL = 5 // 3 feed posts + 2 Stories sequences

const MIX = [
  { label: 'Atrair novos seguidores', detail: 'Dicas, Reels e ganchos', pct: 40, color: 'bg-brand-500' },
  { label: 'Autoridade e educação', detail: 'Explicações e métodos', pct: 30, color: 'bg-emerald-600' },
  { label: 'Prova social e bastidores', detail: 'Antes e depois, equipe', pct: 20, color: 'bg-amber-500' },
  { label: 'Venda direta e ofertas', detail: 'Promoção e agendamento', pct: 10, color: 'bg-ink' },
]

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function ReportsPage() {
  const nav = useNavigate()
  const brand = useApp((s) => s.brand)
  const plan = useApp((s) => s.plan)
  const used = useApp((s) => s.used)
  const library = useApp((s) => s.library)
  const scheduledPosts = useApp((s) => s.scheduledPosts)
  const [today] = useState(() => new Date())

  const p = planDef(plan)
  const tips = getSocialTips(brand.segment)

  const { publishedCount, scheduledCount, thisWeek } = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    const [from, to] = [isoDay(start), isoDay(end)]
    return {
      publishedCount: scheduledPosts.filter((sp) => sp.status === 'publicado').length,
      scheduledCount: scheduledPosts.filter((sp) => sp.status === 'agendado' || sp.status === 'pronto').length,
      thisWeek: scheduledPosts.filter((sp) => sp.date >= from && sp.date <= to).length,
    }
  }, [scheduledPosts, today])

  const weeklyProgress = Math.min(WEEKLY_GOAL, thisWeek)
  const consistencyScore = Math.round((weeklyProgress / WEEKLY_GOAL) * 100)

  // `done` only when the app can verify it; otherwise the item is a recommendation.
  const checklist: { title: string; desc: string; done?: boolean }[] = [
    { title: '3 posts no Feed por semana', desc: 'Gere os posts na MIDFLOW e publique nos horários de pico.', done: thisWeek >= 3 },
    { title: 'Stories diários com enquete', desc: 'Use o 1º story para fazer uma pergunta e abrir conversas.' },
    { title: 'Localização em todas as postagens', desc: `Marque ${brand.city || 'sua cidade'} para atrair pessoas da sua região.`, done: !!brand.city },
    { title: 'CTA claro para Direct ou WhatsApp', desc: 'Todas as legendas devem indicar o próximo passo do cliente.' },
    { title: 'Bio do Instagram otimizada', desc: 'Nome claro, especialidade e link direto para agendamento.' },
    { title: 'Destaques organizados', desc: 'Crie destaques para: Serviços, Preços, Depoimentos e Endereço.' },
  ]

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 sm:gap-6">
      <section aria-labelledby="rp-hero" className="relative overflow-hidden rounded-3xl bg-ink p-5 text-white sm:p-8">
        <div className="pointer-events-none absolute -top-24 right-10 size-72 rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-caption font-semibold text-mint">
            <BarChart3 className="size-3.5" aria-hidden /> Desempenho e constância
          </p>
          <h2 id="rp-hero" className="mt-3 text-headline font-extrabold">
            Presença digital — {brand.name}
          </h2>
          <p className="mt-2 text-sm text-slate-200">
            Acompanhe o ritmo de publicações, metas de constância e orientações para o segmento de <b>{brand.segment}</b>.
          </p>
          <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <Button onClick={() => nav('/app/criar/1')}>
              <PenSquare className="size-4" aria-hidden /> Criar novo conteúdo
            </Button>
            <Button variant="glass" onClick={() => nav('/app/calendario')}>
              <CalendarCheck2 className="size-4" aria-hidden /> Ver calendário
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="rp-kpis">
        <h2 id="rp-kpis" className="sr-only">
          Indicadores do mês
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <li>
            <Card className="h-full p-4 sm:p-5">
              <UsageMeter used={used} total={p.contents} label="Conteúdos no mês" />
              <p className="mt-2 text-caption text-fg-subtle">Plano {p.name}</p>
            </Card>
          </li>
          <li>
            <Card className="h-full p-4 sm:p-5">
              <h3 className="text-caption font-semibold text-fg-subtle">Salvos na biblioteca</h3>
              <p className="mt-1 text-3xl font-extrabold text-ink tabular-nums">
                <CountUp value={library.length} />
              </p>
              <Link to="/app/biblioteca" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
                Abrir biblioteca <span aria-hidden>→</span>
              </Link>
            </Card>
          </li>
          <li>
            <Card className="h-full p-4 sm:p-5">
              <h3 className="text-caption font-semibold text-fg-subtle">Posts agendados</h3>
              <p className="mt-1 text-3xl font-extrabold text-ink tabular-nums">
                <CountUp value={scheduledCount} />
              </p>
              <p className="mt-2 text-caption text-fg-subtle">
                <b>{publishedCount}</b> já publicados
              </p>
            </Card>
          </li>
          <li>
            <Card className="h-full p-4 sm:p-5">
              <h3 className="text-caption font-semibold text-fg-subtle">Constância da semana</h3>
              <p className="mt-1 text-3xl font-extrabold text-brand-700 tabular-nums">{consistencyScore}%</p>
              <ProgressBar value={consistencyScore} label={`${weeklyProgress} de ${WEEKLY_GOAL} publicações na semana`} className="mt-2" />
              <p className="mt-2 text-caption text-fg-subtle">
                {weeklyProgress} de {WEEKLY_GOAL} publicações na semana
              </p>
            </Card>
          </li>
        </ul>
      </section>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card as="section" aria-labelledby="rp-mix" className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="rp-mix" className="font-bold text-ink">
                Mix estratégico de conteúdo
              </h2>
              <p className="text-sm text-fg-subtle">Distribuição recomendada para manter o público engajado e comprando</p>
            </div>
            <Target className="size-5 shrink-0 text-brand-700" aria-hidden />
          </div>
          {/* Horizontal bars with the value as text: readable at 360 px and by screen readers. */}
          <ul className="mt-5 space-y-4">
            {MIX.map(({ label, detail, pct, color }) => (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    <b className="text-ink">{label}</b> <span className="text-fg-subtle">· {detail}</span>
                  </span>
                  <span className="font-bold text-ink tabular-nums">{pct}%</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div className={cx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-brand-900">
              <Sparkles className="size-4 text-brand-700" aria-hidden /> Dica para {brand.name}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-900">
              Negócios de <b>{brand.segment}</b> costumam converter mais quando alternam posts educativos no Feed com sequências de Stories que convidam para uma conversa no WhatsApp ou Direct.
            </p>
          </div>
        </Card>

        <Card as="section" aria-labelledby="rp-params" className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 id="rp-params" className="font-bold text-ink">
              Parâmetros de publicação
            </h2>
            <Compass className="size-5 text-brand-700" aria-hidden />
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="rounded-xl border border-line bg-slate-50 p-3.5">
              <dt className="text-caption font-bold text-fg-subtle">Horários de maior audiência</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5 font-bold text-brand-800">
                {tips.bestHours.map((h) => (
                  <span key={h} className="rounded border border-line bg-white px-2 py-0.5">
                    {h}
                  </span>
                ))}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-slate-50 p-3.5">
              <dt className="text-caption font-bold text-fg-subtle">Dias mais fortes</dt>
              <dd className="mt-1 font-semibold text-fg-muted">{tips.bestDays.join(' · ')}</dd>
            </div>
            <div className="rounded-xl border border-line bg-slate-50 p-3.5">
              <dt className="text-caption font-bold text-fg-subtle">Hashtags com maior alcance</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1 font-semibold text-brand-800">
                {tips.keyHashtags.map((tag) => (
                  <span key={tag} className="rounded bg-brand-50 px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card as="section" aria-labelledby="rp-check" className="p-4 sm:p-6">
        <h2 id="rp-check" className="font-bold text-ink">
          Checklist semanal do Instagram
        </h2>
        <p className="text-sm text-fg-subtle">Mantenha esta rotina para atrair clientes de forma orgânica e constante.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {checklist.map(({ title, desc, done }) => (
            <li key={title} className={cx('flex items-start gap-3 rounded-2xl border p-4', done ? 'border-brand-200 bg-brand-50/40' : 'border-line bg-white')}>
              {done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden /> : <Circle className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden />}
              <div>
                <h3 className="text-sm font-bold text-ink">
                  {title}
                  {done && <span className="sr-only"> (concluído)</span>}
                </h3>
                <p className="mt-0.5 text-sm leading-relaxed text-fg-subtle">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
