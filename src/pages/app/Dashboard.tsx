import { ArrowRight, CalendarHeart, FolderOpen, Lightbulb, PenSquare, Sparkles, Wand2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Creative } from '../../components/creative/Creative'
import { CountUp } from '../../components/motion'
import { Button, Card, CardLink, UsageMeter } from '../../components/ui'
import { planDef, segmentDef, STYLES, TONES } from '../../lib/data'
import { themesFor } from '../../lib/generator'
import { photoUrl } from '../../lib/photos'
import { useApp } from '../../lib/store'

function nextSpecialDate() {
  const today = new Date()
  const y = today.getFullYear()
  const dates: [Date, string][] = [
    [new Date(y, 2, 8), 'Dia da Mulher'],
    [new Date(y, 4, 11), 'Dia das Mães'],
    [new Date(y, 5, 12), 'Dia dos Namorados'],
    [new Date(y, 7, 10), 'Dia dos Pais'],
    [new Date(y, 9, 5), 'Dia do Empreendedor'],
    [new Date(y, 9, 12), 'Dia das Crianças'],
    [new Date(y, 10, 27), 'Black Friday'],
    [new Date(y, 11, 25), 'Natal'],
    [new Date(y + 1, 2, 8), 'Dia da Mulher'],
  ]
  const [d, label] = dates.find(([d]) => d >= new Date(y, today.getMonth(), today.getDate())) ?? dates[0]
  const days = Math.round((d.getTime() - new Date(y, today.getMonth(), today.getDate()).getTime()) / 86_400_000)
  return { label, days, date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) }
}

export function Dashboard() {
  const nav = useNavigate()
  const user = useApp((s) => s.user)
  const brand = useApp((s) => s.brand)
  const plan = useApp((s) => s.plan)
  const used = useApp((s) => s.used)
  const library = useApp((s) => s.library)
  const generations = useApp((s) => s.generations)
  const setContent = useApp((s) => s.setContent)
  const markDone = useApp((s) => s.markDone)
  const briefing = useApp((s) => s.briefing)
  const p = planDef(plan)
  const seg = segmentDef(brand.segment)
  const ideas = themesFor(brand.segment, 'ia').slice(0, 6)
  const special = nextSpecialDate()
  const first = (user?.name ?? '').split(' ')[0]
  const briefingReady = !!(briefing.about && briefing.segment && briefing.audience)
  const mark = { name: brand.name, handle: brand.handle, logo: brand.logo }

  const startWith = (themeId: string) => {
    setContent({ themeId, customTheme: '' })
    if (briefingReady) {
      markDone(1)
      nav('/app/criar/2')
    } else nav('/app/criar/1')
  }

  return (
    <div className="mx-auto grid max-w-[1400px] gap-5 lg:gap-6">
      {/* Primary card */}
      <section aria-labelledby="dash-hero" className="relative overflow-hidden rounded-3xl bg-ink p-5 text-white sm:p-9">
        <div className="pointer-events-none absolute -top-24 right-10 size-72 rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute right-0 bottom-0 hidden h-full w-[42%] xl:block" aria-hidden>
          <div className="absolute right-8 bottom-[-40px] flex gap-3">
            {library.slice(0, 3).map((l, i) => (
              <div key={l.id} className="w-[140px] overflow-hidden rounded-xl shadow-pop" style={{ transform: `rotate(${[-6, 0, 6][i]}deg) translateY(${[20, 0, 24][i]}px)` }}>
                <Creative c={l.creative} style={l.style} palette={l.palette} format={l.postFormat} brand={mark} label="" />
              </div>
            ))}
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-sm font-semibold text-mint">Olá, {first || 'tudo bem'}!</p>
          <h2 id="dash-hero" className="mt-2 text-headline font-extrabold tracking-tight sm:text-display">
            Crie o conteúdo da semana da {brand.name}
          </h2>
          <p className="mt-3 text-slate-300">4 posts, 4 Stories, legendas e hashtags em poucos minutos.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => nav('/app/criar/1')}>
              <PenSquare className="size-5" aria-hidden /> Criar conteúdo da semana
            </Button>
            {generations.length > 0 && (
              <Button size="lg" variant="glass" onClick={() => nav('/app/criar/4')}>
                Ver última geração <ArrowRight className="size-5" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Ideas: horizontal scroll on phones */}
      <section aria-labelledby="dash-ideas">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="dash-ideas" className="flex items-center gap-2 text-title-sm font-bold">
              <Sparkles className="size-5 text-brand-700" aria-hidden /> Ideias para {seg.short.toLowerCase()}
            </h2>
            <p className="text-sm text-fg-subtle">Toque em uma ideia para começar com ela.</p>
          </div>
        </div>
        <ul className="no-scrollbar snap-row edge-fade -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0 lg:[mask-image:none]">
          {ideas.map((t) => (
            <li key={t.id} className="w-[46%] shrink-0 sm:w-[30%] lg:w-auto">
              <button type="button" onClick={() => startWith(t.id)} className="lift group block w-full overflow-hidden rounded-xl border border-line bg-white text-left">
                <img src={photoUrl(t.photo)} alt="" width={320} height={200} loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover" />
                <span className="block p-3">
                  <span className="block text-sm font-semibold">{t.label}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-fg-subtle">{t.desc}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-800">
                    Criar com esta ideia <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Stats 2×2 */}
      <section aria-label="Resumo" className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <UsageMeter used={used} total={p.contents} label={`Plano ${p.name}`} />
          <div className="mt-2 text-xs text-fg-subtle">conteúdos usados este mês</div>
        </Card>
        <CardLink to="/app/biblioteca" className="p-4 sm:p-5">
          <div className="text-sm text-fg-subtle">Salvos</div>
          <div className="mt-1 text-headline font-extrabold tabular-nums">
            <CountUp value={library.length} />
          </div>
          <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-800">
            Abrir biblioteca <ArrowRight className="size-3.5" aria-hidden />
          </div>
        </CardLink>
        <CardLink to="/app/posts" className="p-4 sm:p-5">
          <div className="text-sm text-fg-subtle">Gerações</div>
          <div className="mt-1 text-headline font-extrabold tabular-nums">{generations.length}</div>
          <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-800">
            Meus posts <ArrowRight className="size-3.5" aria-hidden />
          </div>
        </CardLink>
        <CardLink to="/app/calendario" className="p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-sm text-fg-subtle">
            <CalendarHeart className="size-4 text-brand-700" aria-hidden /> Próxima data
          </div>
          <div className="mt-1 text-base font-extrabold sm:text-title-sm">{special.label}</div>
          <div className="mt-0.5 text-xs text-fg-subtle tabular-nums">
            {special.date} · {special.days === 0 ? 'é hoje' : `em ${special.days} dias`}
          </div>
        </CardLink>
      </section>

      <div className="grid gap-5 lg:gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card as="section" aria-labelledby="dash-recent" className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 id="dash-recent" className="text-title-sm font-bold">
              Salvos recentemente
            </h2>
            <Link to="/app/biblioteca" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50">
              <FolderOpen className="size-4" aria-hidden /> Ver todos
            </Link>
          </div>
          {library.length ? (
            <ul className="mt-3 grid grid-cols-2 items-start gap-3 sm:grid-cols-4">
              {library.slice(0, 4).map((l) => (
                <li key={l.id}>
                  <Link to="/app/biblioteca" className="block overflow-hidden rounded-xl">
                    <Creative c={l.creative} style={l.style} palette={l.palette} format={l.postFormat} brand={mark} />
                    <span className="block truncate pt-2 text-xs text-fg-subtle">{l.themeLabel}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-fg-subtle">Os criativos que você salvar aparecem aqui.</p>
          )}
        </Card>
        <div className="grid content-start gap-5">
          <Card as="section" aria-labelledby="dash-brand" className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 id="dash-brand" className="text-title-sm font-bold">
                Minha marca
              </h2>
              <Link to="/app/marca" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50">
                Editar<span className="sr-only"> marca</span>
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid size-12 place-items-center overflow-hidden rounded-xl bg-slate-100 text-lg font-bold" aria-hidden>
                {brand.logo ? <img src={brand.logo} alt="" className="size-full object-contain p-1" /> : brand.name.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{brand.name}</div>
                <div className="truncate text-sm text-fg-subtle">
                  @{brand.handle} {brand.city && `· ${brand.city}`}
                </div>
              </div>
            </div>
            <ul className="mt-4 flex gap-2" aria-label="Cores da marca">
              {brand.colors.map((c) => (
                <li key={c} className="h-9 flex-1 rounded-lg border border-black/10" style={{ background: c }}>
                  <span className="sr-only">{c}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-fg-subtle">Estilo</dt>
                <dd className="font-semibold">{STYLES.find((s) => s.id === brand.style)?.label}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-fg-subtle">Tom</dt>
                <dd className="truncate font-semibold">{brand.tones.map((t) => TONES.find((x) => x.id === t)?.label).join(' + ')}</dd>
              </div>
            </dl>
          </Card>
          <Card as="section" aria-labelledby="dash-tips" className="p-4 sm:p-6">
            <h2 id="dash-tips" className="flex items-center gap-2 text-title-sm font-bold">
              <Lightbulb className="size-5 text-amber-600" aria-hidden /> Dicas rápidas
            </h2>
            <ul className="mt-3 space-y-3 text-sm">
              {[
                ['Publique com constância', '3 posts e 2 sequências de Stories por semana mantêm sua marca lembrada.'],
                ['Use enquetes', 'O primeiro story com pergunta aumenta as respostas no direct.'],
                ['Peça nova versão', 'Não gostou? “Nova versão” mantém o briefing e cria outra variação.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700" aria-hidden>
                    <Wand2 className="size-4" />
                  </span>
                  <span>
                    <b className="block">{t}</b>
                    <span className="text-fg-subtle">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
