import { ArrowRight, CalendarHeart, FolderOpen, Lightbulb, PenSquare, Sparkles, Wand2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../components/creative/Creative'
import { CountUp } from '../../components/motion'
import { Button, Card } from '../../components/ui'
import { photoUrl } from '../../lib/photos'
import { planDef, segmentDef, STYLES, TONES } from '../../lib/data'
import { themesFor } from '../../lib/generator'
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
  const ideas = themesFor(brand.segment, 'ia').slice(0, 4)
  const special = nextSpecialDate()
  const first = (user?.name ?? '').split(' ')[0]
  const briefingReady = !!(briefing.about && briefing.segment && briefing.audience)

  const startWith = (themeId: string) => {
    setContent({ themeId, customTheme: '' })
    if (briefingReady) {
      markDone(1)
      nav('/app/criar/2')
    } else nav('/app/criar/1')
  }

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-9">
        <div className="pointer-events-none absolute -top-24 right-10 size-72 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute right-0 bottom-0 hidden h-full w-[42%] xl:block">
          <div className="absolute right-8 bottom-[-40px] flex gap-3">
            {library.slice(0, 3).map((l, i) => (
              <div key={l.id} className="w-[140px] overflow-hidden rounded-xl shadow-pop" style={{ transform: `rotate(${[-6, 0, 6][i]}deg) translateY(${[20, 0, 24][i]}px)` }}>
                <Creative c={l.creative} style={l.style} palette={l.palette} format={l.postFormat} brand={{ name: brand.name, handle: brand.handle, logo: brand.logo }} />
              </div>
            ))}
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-sm font-semibold text-mint">Olá, {first || 'tudo bem'}!</p>
          <h2 className="mt-2 text-[26px] leading-tight font-extrabold tracking-tight sm:text-4xl">O que a {brand.name} vai publicar esta semana?</h2>
          <p className="mt-3 text-slate-300">Responda o briefing ou escolha uma ideia abaixo. A MIDFLOW cria posts, Stories e legendas em minutos.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => nav('/app/criar/1')}>
              <PenSquare className="size-5" /> Criar conteúdo
            </Button>
            {generations.length > 0 && (
              <Button size="lg" variant="secondary" onClick={() => nav('/app/criar/4')}>
                Ver última geração <ArrowRight className="size-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <div className="text-sm text-slate-500">Conteúdos este mês</div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">
            <CountUp value={used} />
            <span className="text-base font-semibold text-slate-400"> / {p.contents}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full origin-left rounded-full bg-brand-500 [animation:grow-x_1s_var(--ease-out-soft)_both]" style={{ width: `${Math.min(100, (used / p.contents) * 100)}%` }} />
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Salvos na biblioteca</div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums"><CountUp value={library.length} /></div>
          <button onClick={() => nav('/app/biblioteca')} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
            Abrir biblioteca <ArrowRight className="size-4" />
          </button>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Gerações nesta sessão</div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">{generations.length}</div>
          <div className="mt-2 text-sm text-slate-500">Plano {p.name}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CalendarHeart className="size-4 text-brand-600" /> Próxima data
          </div>
          <div className="mt-1 text-xl font-extrabold">{special.label}</div>
          <div className="mt-1 text-sm text-slate-500 tabular-nums">
            {special.date} · {special.days === 0 ? 'é hoje' : `em ${special.days} dias`}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Ideas */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <Sparkles className="size-5 text-brand-600" /> Ideias para {seg.short.toLowerCase()}
              </h3>
              <p className="text-sm text-slate-500">Sugestões da IA com base no seu segmento. Um clique para começar.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {ideas.map((t) => (
              <button key={t.id} onClick={() => startWith(t.id)} className="lift group overflow-hidden rounded-xl border border-line bg-white text-left">
                <span className="block overflow-hidden"><img src={photoUrl(t.photo)} alt="" className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-105" /></span>
                <div className="p-3">
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{t.desc}</div>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 opacity-0 transition group-hover:opacity-100">
                    Criar <ArrowRight className="size-3.5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Brand */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Minha marca</h3>
            <Button variant="ghost" size="sm" onClick={() => nav('/app/marca')}>
              Editar
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="grid size-12 place-items-center overflow-hidden rounded-xl bg-slate-100 text-lg font-bold">
              {brand.logo ? <img src={brand.logo} alt="" className="size-full object-contain p-1" /> : brand.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{brand.name}</div>
              <div className="truncate text-sm text-slate-500">
                @{brand.handle} {brand.city && `· ${brand.city}`}
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            {brand.colors.map((c) => (
              <span key={c} className="h-9 flex-1 rounded-lg border border-black/5" style={{ background: c }} title={c} />
            ))}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Estilo</dt>
              <dd className="font-semibold">{STYLES.find((s) => s.id === brand.style)?.label}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Tom</dt>
              <dd className="truncate font-semibold">{brand.tones.map((t) => TONES.find((x) => x.id === t)?.label).join(' + ')}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Salvos recentemente</h3>
            <Button variant="ghost" size="sm" onClick={() => nav('/app/biblioteca')}>
              <FolderOpen className="size-4" /> Ver todos
            </Button>
          </div>
          {library.length ? (
            <div className="mt-4 grid grid-cols-2 items-start gap-3 sm:grid-cols-4">
              {library.slice(0, 4).map((l) => (
                <button key={l.id} onClick={() => nav('/app/biblioteca')} className="overflow-hidden rounded-xl text-left">
                  <Creative c={l.creative} style={l.style} palette={l.palette} format={l.postFormat} brand={{ name: brand.name, handle: brand.handle, logo: brand.logo }} />
                  <div className="truncate pt-2 text-xs text-slate-500">{l.themeLabel}</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Os criativos que você salvar aparecem aqui.</p>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Lightbulb className="size-5 text-amber-500" /> Dicas rápidas
          </h3>
          <ul className="mt-4 space-y-4 text-sm">
            {[
              ['Publique com constância', '3 posts e 2 sequências de Stories por semana já mantêm sua marca lembrada.'],
              ['Use enquetes', 'O primeiro story com pergunta aumenta as respostas no direct.'],
              ['Peça nova versão', 'Não gostou? “Gerar nova versão” mantém o briefing e cria outra variação.'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Wand2 className="size-4" />
                </span>
                <span>
                  <b className="block">{t}</b>
                  <span className="text-slate-500">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
