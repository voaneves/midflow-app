import { useMemo } from 'react'
import {
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Compass,
  PenSquare,
  Sparkles,
  Target,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CountUp } from '../../components/motion'
import { Button, Card, cx } from '../../components/ui'
import { planDef } from '../../lib/data'
import { getSocialTips } from '../../lib/social'
import { useApp } from '../../lib/store'

export function ReportsPage() {
  const nav = useNavigate()
  const brand = useApp((s) => s.brand)
  const plan = useApp((s) => s.plan)
  const used = useApp((s) => s.used)
  const library = useApp((s) => s.library)
  const scheduledPosts = useApp((s) => s.scheduledPosts)

  const p = planDef(plan)
  const tips = getSocialTips(brand.segment)

  const publishedCount = useMemo(
    () => scheduledPosts.filter((sp) => sp.status === 'publicado').length,
    [scheduledPosts],
  )
  const scheduledCount = useMemo(
    () => scheduledPosts.filter((sp) => sp.status === 'agendado' || sp.status === 'pronto').length,
    [scheduledPosts],
  )

  // Meta semanal: 3 posts + 2 sequências de stories = 5 entregas/semana
  const weeklyGoal = 5
  const weeklyProgress = Math.min(weeklyGoal, Math.round((used / p.contents) * weeklyGoal) || 2)
  const consistencyScore = Math.min(100, Math.round((weeklyProgress / weeklyGoal) * 100))

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      {/* Banner de Visão Geral */}
      <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -top-24 right-10 size-72 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-mint">
            <BarChart3 className="size-3.5" /> Desempenho & Consistência de Social Media
          </span>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">
            Visão de Presença Digital — {brand.name}
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Acompanhe o ritmo de publicações, metas de constância e orientações estratégicas de marketing para o
            segmento de <b>{brand.segment}</b>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => nav('/app/criar/1')}>
              <PenSquare className="size-4" /> Criar novo conteúdo
            </Button>
            <Button variant="secondary" onClick={() => nav('/app/calendario')}>
              <CalendarCheck2 className="size-4" /> Ver calendário editorial
            </Button>
          </div>
        </div>
      </div>

      {/* Cartões de Métricas Principais */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conteúdos no Mês</div>
          <div className="mt-1.5 text-3xl font-extrabold tabular-nums text-ink">
            <CountUp value={used} />
            <span className="text-sm font-semibold text-slate-400"> / {p.contents}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-700"
              style={{ width: `${Math.min(100, (used / p.contents) * 100)}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">Plano {p.name}</div>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salvos na Biblioteca</div>
          <div className="mt-1.5 text-3xl font-extrabold tabular-nums text-ink">
            <CountUp value={library.length} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Prontos para baixar ou reutilizar</p>
          <button
            onClick={() => nav('/app/biblioteca')}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
          >
            Abrir biblioteca →
          </button>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Posts Agendados</div>
          <div className="mt-1.5 text-3xl font-extrabold tabular-nums text-ink">
            <CountUp value={scheduledCount} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            <b>{publishedCount}</b> já marcados como publicados
          </p>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Índice de Constância</div>
          <div className="mt-1.5 text-3xl font-extrabold tabular-nums text-brand-700">
            {consistencyScore}%
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${consistencyScore}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {weeklyProgress} de {weeklyGoal} publicações na semana
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Distribuição Estratégica de Conteúdo */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-ink">Mix Estratégico de Conteúdo</h3>
              <p className="text-xs text-slate-500">Distribuição recomendada para manter o público engajado e comprando</p>
            </div>
            <Target className="size-5 text-brand-600" />
          </div>

          <div className="mt-6 space-y-4">
            {[
              { label: 'Atrair Novos Seguidores (Dicas, Reels e Ganchos)', pct: 40, color: 'bg-brand-500' },
              { label: 'Autoridade & Educação (Explicações e Métodos)', pct: 30, color: 'bg-emerald-500' },
              { label: 'Prova Social & Bastidores (Antes e Depois, Equipe)', pct: 20, color: 'bg-amber-500' },
              { label: 'Venda Direta & Ofertas (Promoção e Agendamento)', pct: 10, color: 'bg-ink' },
            ].map(({ label, pct, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700">{label}</span>
                  <span className="text-slate-900 tabular-nums">{pct}%</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={cx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
            <div className="flex items-center gap-2 font-bold text-brand-900 text-xs">
              <Sparkles className="size-4 text-brand-700" />
              <span>Dica da IA para {brand.name}:</span>
            </div>
            <p className="mt-1.5 text-xs text-brand-800 leading-relaxed">
              Negócios no segmento de <b>{brand.segment}</b> têm 3.2x mais conversões quando alternam posts educativos no
              feed com sequências de Stories que convidam para um diálogo direto no WhatsApp ou Direct.
            </p>
          </div>
        </Card>

        {/* Guia de Social Media para o Segmento */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink">Parâmetros de Publicação</h3>
            <Compass className="size-5 text-brand-600" />
          </div>

          <div className="mt-5 space-y-4 text-sm">
            <div className="rounded-xl border border-line bg-slate-50 p-3.5">
              <div className="text-xs font-bold text-slate-500 uppercase">Horários de Maior Audiência</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 font-bold text-brand-800">
                {tips.bestHours.map((h) => (
                  <span key={h} className="rounded bg-white px-2 py-0.5 text-xs border border-line">
                    {h}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-slate-50 p-3.5">
              <div className="text-xs font-bold text-slate-500 uppercase">Dias Mais Fortes</div>
              <div className="mt-1 text-xs font-semibold text-slate-700">{tips.bestDays.join(' · ')}</div>
            </div>

            <div className="rounded-xl border border-line bg-slate-50 p-3.5">
              <div className="text-xs font-bold text-slate-500 uppercase">Hashtags com Maior Alcance</div>
              <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] font-semibold text-brand-700">
                {tips.keyHashtags.map((tag) => (
                  <span key={tag} className="rounded bg-brand-50 px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Estimativas e Boas Práticas do Social Media */}
      <Card className="p-6">
        <h3 className="font-bold text-ink">Checklist Semanal de Sucesso no Instagram</h3>
        <p className="text-xs text-slate-500">Mantenha esta rotina ativa para atrair clientes de forma orgânica e constante</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {[
            {
              title: '3 Posts no Feed por Semana',
              desc: 'Gere os posts no MIDFLOW e publique nos horários de pico.',
              done: library.length >= 3,
            },
            {
              title: 'Stories Diários com Enquete',
              desc: 'Use o 1º story para fazer uma pergunta e abrir conversas.',
              done: true,
            },
            {
              title: 'Localização em Todas as Postagens',
              desc: `Marque ${brand.city || 'sua cidade'} para atrair pessoas da sua região.`,
              done: !!brand.city,
            },
            {
              title: 'CTA Claro para Direct ou WhatsApp',
              desc: 'Todas as legendas devem indicar o próximo passo do cliente.',
              done: true,
            },
            {
              title: 'Bio do Instagram Otimizada',
              desc: 'Nome claro, especialidade e link direto para agendamento.',
              done: true,
            },
            {
              title: 'Destaques Estruturados',
              desc: 'Crie destaques para: Serviços, Preços, Depoimentos e Endereço.',
              done: false,
            },
          ].map(({ title, desc, done }, idx) => (
            <div
              key={idx}
              className={cx(
                'flex items-start gap-3 rounded-2xl border p-4 transition',
                done ? 'border-brand-200 bg-brand-50/40' : 'border-line bg-white',
              )}
            >
              <CheckCircle2
                className={cx('mt-0.5 size-5 shrink-0', done ? 'text-brand-600' : 'text-slate-300')}
              />
              <div>
                <div className="text-sm font-bold text-ink">{title}</div>
                <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

