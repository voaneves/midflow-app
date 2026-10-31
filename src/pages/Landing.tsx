import { ArrowRight, BarChart3, BookOpen, Check, ChevronDown, Clock, Image as ImageIcon, Menu, Sparkles, Store, X, Zap } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Creative } from '../components/creative/Creative'
import { PhoneMockup } from '../components/creative/parts'
import { Reveal } from '../components/motion'
import { SEOHead } from '../components/SEOHead'
import { Button, cx, Logo, Modal } from '../components/ui'
import { derivePalette } from '../lib/color'
import { PLANS, segmentDef } from '../lib/data'
import { generate } from '../lib/generator'
import { useApp } from '../lib/store'
import type { SegmentId, StyleId } from '../lib/types'

function sample(segment: SegmentId, themeId: string, style: StyleId, which: 'post' | 'story' = 'post', idx = 0, brandName = 'Seu negócio') {
  const seg = segmentDef(segment)
  const palette = derivePalette(seg.palette)
  const g = generate(
    {
      segment,
      themeId,
      objective: 'atrair',
      tones: ['profissional'],
      style,
      palette,
      postFormat: '4:5',
      posts: true,
      stories: true,
      brandName,
      handle: 'seunegocio',
      city: 'Palmas - TO',
      seed: 11,
    },
    1,
  )
  const c = which === 'post' ? g.posts[idx] : g.stories[idx]
  return { c, palette, style }
}

const brandMark = { name: 'Seu negócio', handle: 'seunegocio' }

function Showcase() {
  const tiles = useMemo(
    () => [
      sample('beleza', 'unhas', 'elegante'),
      sample('fitness', 'disciplina', 'moderno'),
      sample('alimentacao', 'prato', 'natural'),
      sample('saude', 'sorriso', 'minimalista'),
      sample('imoveis', 'destaque', 'elegante'),
      sample('pet', 'cuidado', 'colorido'),
      sample('moda', 'colecao', 'premium'),
      sample('servicos', 'produtividade', 'moderno'),
    ],
    [],
  )
  const phone = useMemo(() => sample('beleza', 'cabelo', 'premium'), [])
  return (
    <div className="relative mt-12 flex justify-center sm:mt-16">
      {/* endless strip of creatives from different segments, gliding behind the phone */}
      <div className="marquee pointer-events-auto absolute top-1/2 right-[-16px] left-[-16px] -translate-y-1/2 overflow-hidden py-8 sm:right-[-24px] sm:left-[-24px]" aria-hidden>
        <div className="marquee-track" style={{ ['--dur' as string]: '70s' }}>
          {[...tiles, ...tiles].map((s, i) => (
            <div
              key={i}
              className="mx-2 w-[136px] shrink-0 overflow-hidden rounded-2xl shadow-card sm:mx-2.5 sm:w-[188px]"
              style={{ transform: `translateY(${[0, 26, 10, 34][i % 4]}px) rotate(${[-1.5, 1, -0.5, 1.5][i % 4]}deg)` }}
            >
              <Creative c={s.c} style={s.style} palette={s.palette} format="4:5" brand={brandMark} />
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-10 w-[224px] sm:w-[262px]">
        <div className="pointer-events-none absolute -inset-10 rounded-full bg-brand-300/25 blur-3xl" />
        <div className="relative animate-float">
          <PhoneMockup
            c={phone.c}
            style={phone.style}
            palette={phone.palette}
            format="4:5"
            brand={{ name: 'Studio Aurora', handle: 'studioaurora' }}
            mode="feed"
            city="Palmas - TO"
          />
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  ['Briefing inteligente', 'Conte sobre o seu negócio, diferenciais e público. Leva 2 minutos e fica salvo na sua marca.'],
  ['Conteúdo contextual', 'A IA sugere temas e variações estruturais específicas para o seu nicho. Escolha ou crie o seu.'],
  ['Identidade visual', 'Cores, tipografia e logo aplicados automaticamente em layouts profissionais com respiro.'],
  ['Assistente & Publicação', 'Receba posts, sequências de Stories, legendas prontas, checklist e agendamento direto no Calendário.'],
]

function StoriesNarrative() {
  const g = useMemo(() => {
    const seg = segmentDef('beleza')
    const palette = derivePalette(seg.palette)
    return {
      palette,
      list: generate(
        {
          segment: 'beleza',
          themeId: 'cabelo',
          objective: 'atrair',
          tones: ['profissional'],
          style: 'premium',
          palette,
          postFormat: '4:5',
          posts: false,
          stories: true,
          brandName: 'Studio Aurora',
          handle: 'studioaurora',
          city: 'Palmas - TO',
          seed: 4,
        },
        1,
      ).stories,
    }
  }, [])
  const labels = [
    ['Gancho & Enquete', 'Chamar atenção e gerar resposta rápida'],
    ['Problema & Contexto', 'Tocar na dor com empatia'],
    ['Solução & Prova', 'Apresentar a transformação real'],
    ['Chamada para Ação', 'Conduzir para mensagem no Direct'],
  ]
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {g.list.map((c, i) => (
        <Reveal key={c.id} delay={i * 120} className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-2xl shadow-card">
            <Creative c={c} style="premium" palette={g.palette} format="4:5" brand={{ name: 'Studio Aurora', handle: 'studioaurora' }} />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-[.1em] break-words text-brand-700 uppercase">{labels[i][0]}</div>
            <div className="text-sm text-slate-500">{labels[i][1]}</div>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

const EXAMPLE_SEGS: { id: SegmentId; style: StyleId }[] = [
  { id: 'beleza', style: 'elegante' },
  { id: 'alimentacao', style: 'natural' },
  { id: 'fitness', style: 'moderno' },
  { id: 'saude', style: 'minimalista' },
  { id: 'servicos', style: 'moderno' },
  { id: 'moda', style: 'colorido' },
]

function Examples() {
  const [seg, setSeg] = useState<SegmentId>('beleza')
  const cfg = EXAMPLE_SEGS.find((s) => s.id === seg)!
  const data = useMemo(() => {
    const def = segmentDef(seg)
    const palette = derivePalette(def.palette)
    const g = generate(
      {
        segment: seg,
        themeId: def.themes[0].id,
        objective: 'atrair',
        tones: ['profissional'],
        style: cfg.style,
        palette,
        postFormat: '4:5',
        posts: true,
        stories: false,
        brandName: 'Seu negócio',
        handle: 'seunegocio',
        city: '',
        seed: 2,
      },
      1,
    )
    return { palette, posts: g.posts }
  }, [seg, cfg.style])
  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:justify-center">
        {EXAMPLE_SEGS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeg(s.id)}
            className={cx(
              'h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition',
              seg === s.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            {segmentDef(s.id).short}
          </button>
        ))}
      </div>
      <div key={seg} className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {data.posts.map((c, i) => (
          <div key={c.id} className="lift overflow-hidden rounded-2xl shadow-card animate-rise" style={{ animationDelay: `${i * 80}ms` }}>
            <Creative c={c} style={cfg.style} palette={data.palette} format="4:5" brand={brandMark} />
          </div>
        ))}
      </div>
    </div>
  )
}

const FAQ = [
  [
    'Preciso ter experiência prévia com design ou marketing?',
    'Não. Você apenas responde um briefing rápido sobre o seu negócio e a MIDFLOW gera automaticamente posts, Stories narrativos, legendas completas e hashtags recomendadas.',
  ],
  [
    'O conteúdo fica realmente alinhado com a identidade da minha marca?',
    'Sim. Você cadastra cores, logotipo e tom de voz uma única vez em "Minha marca". A plataforma preserva essa identidade visual e de tom em todas as gerações.',
  ],
  [
    'Como funciona o auxílio para publicação no Instagram e WhatsApp?',
    'A MIDFLOW oferece um assistente interativo com cópia de legenda em 1 clique, checklist de postagem, sugestão dos melhores horários para o seu segmento e links diretos para abrir o app do Instagram ou WhatsApp.',
  ],
  [
    'Posso organizar meu mês com antecedência no Calendário Editorial?',
    'Sim! O Calendário Editorial integrado permite agendar datas para posts e Stories, filtrar por status (agendado/publicado) e ainda sugere temas para datas comemorativas importantes.',
  ],
  [
    'Posso cancelar a assinatura quando quiser?',
    'Sim, sem burocracia ou fidelidade. Você pode gerenciar seu plano ou cancelar a qualquer momento diretamente pelo painel de controle.',
  ],
]

const BLOG_ARTICLES = [
  {
    title: 'A Estrutura de 4 Passos para Stories que Geram Vendas no Direct',
    category: 'Estratégia de Stories',
    readTime: '3 min de leitura',
    summary:
      'Stories soltos sem conexão diminuem a retenção da sua audiência. Aprenda a aplicar a narrativa Gancho → Contexto → Prova → Chamada para Ação para multiplicar conversas e pedidos.',
    bullets: [
      'Story 1 (Gancho): Comece sempre com uma pergunta instigante ou enquete interativa com 2 opções rápidas.',
      'Story 2 (Contexto): Mostre a dor ou situação comum que o seu público enfrenta no dia a dia.',
      'Story 3 (Prova): Apresente um antes/depois, bastidores ou depoimento real de cliente satisfeito.',
      'Story 4 (Chamada): Peça para enviarem uma palavra-chave no Direct (ex: "Mande PROMO para saber valores").',
    ],
  },
  {
    title: 'Melhores Horários para Postar no Instagram em 2026: Análise por Segmento',
    category: 'Métricas & Horários',
    readTime: '4 min de leitura',
    summary:
      'Descubra as faixas de horário onde seu público está mais propenso a interagir e comprar, segundo a base de dados de pequenas e médias empresas.',
    bullets: [
      'Beleza & Estética: Terças e Quintas das 11:30 às 13:30 (horário de almoço) e das 19:00 às 21:30.',
      'Alimentação & Restaurantes: Quartas a Domingos das 11:00 às 13:00 (almoço) e das 17:30 às 20:00 (jantar/lanche).',
      'Serviços & Negócios: Terças a Quintas das 08:00 às 09:30 e das 18:00 às 19:30.',
      'Moda & Varejo: Sextas e Sábados das 12:00 às 14:00 e Domingos a partir das 19:00.',
    ],
  },
  {
    title: '5 Ganchos Magnéticos para o Primeiro Story que Dobram suas Respostas',
    category: 'Ganchos de Engajamento',
    readTime: '2 min de leitura',
    summary:
      'O primeiro story define o alcance de toda a sequência restante do dia. Evite começar com "Bom dia" e use estes ganchos testados:',
    bullets: [
      '"Você prefere A ou B? (Enquete nos primeiros 5 segundos)"',
      '"Apenas 10% das pessoas sabem desse detalhe..."',
      '"Qual foi a última vez que você cuidou disso?"',
      '"O que você faria nessa situação? (Caixa de perguntas)"',
      '"Segredo revelado: como resolvemos isso em apenas 30 minutos..."',
    ],
  },
]

export function Landing() {
  const nav = useNavigate()
  const user = useApp((s) => s.user)
  const loadDemo = useApp((s) => s.loadDemo)
  const [company, setCompany] = useState('')
  const [menu, setMenu] = useState(false)
  const [faq, setFaq] = useState<number | null>(0)
  const [blogModal, setBlogModal] = useState(false)

  const start = (e?: FormEvent) => {
    e?.preventDefault()
    nav('/cadastro', { state: { company } })
  }

  const go = (id: string) => {
    setMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <SEOHead
        title="MIDFLOW · Crie Posts e Stories com IA para Redes Sociais"
        description="Crie posts de feed, carrosséis e sequências narrativas de Stories para o seu negócio com Inteligência Artificial. Inclui legendas, hashtags e calendário editorial."
        canonical="https://midflow.com.br"
      />

      {/* Nav */}
      <header className="sticky z-40 border-b border-transparent bg-white/85 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-[78px] max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="text-[22px]">
            <Logo />
          </Link>
          <nav className="mx-auto hidden items-center gap-8 text-[15px] font-medium text-slate-700 lg:flex" aria-label="Navegação da página inicial">
            {[
              ['Como funciona', 'como'],
              ['Exemplos', 'exemplos'],
              ['Planos', 'planos'],
              ['Depoimentos', 'depoimentos'],
            ].map(([l, id]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  go(id)
                }}
                className="transition hover:text-brand-700"
              >
                {l}
              </a>
            ))}
            <button
              onClick={() => setBlogModal(true)}
              className="flex items-center gap-1.5 transition hover:text-brand-700"
            >
              <BookOpen className="size-4 text-brand-600" /> Dicas & Blog
            </button>
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {user ? (
              <Button onClick={() => nav('/app')}>Ir para o app</Button>
            ) : (
              <>
                <Link to="/entrar" className="hidden h-11 items-center px-4 text-[15px] font-medium text-slate-700 hover:text-brand-700 sm:flex">
                  Entrar
                </Link>
                <Button onClick={() => nav('/cadastro')} className="hidden sm:inline-flex">
                  Criar conta grátis
                </Button>
              </>
            )}
            <button className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">
              {menu ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="border-t border-line bg-white px-4 py-3 lg:hidden">
            {[
              ['Como funciona', 'como'],
              ['Exemplos', 'exemplos'],
              ['Planos', 'planos'],
              ['Depoimentos', 'depoimentos'],
            ].map(([l, id]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  go(id)
                }}
                className="block w-full py-2.5 text-left font-medium text-slate-800"
              >
                {l}
              </a>
            ))}
            <button
              onClick={() => {
                setMenu(false)
                setBlogModal(true)
              }}
              className="flex w-full items-center gap-2 py-2.5 text-left font-medium text-brand-700"
            >
              <BookOpen className="size-4" /> Dicas de Social Media & Blog
            </button>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => nav('/entrar')}>
                Entrar
              </Button>
              <Button className="flex-1" onClick={() => nav('/cadastro')}>
                Criar conta
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Conteúdo Principal */}
      <main id="conteudo-principal">
        {/* Hero */}
        <section className="relative px-4 pt-12 sm:px-6 sm:pt-16">
          <div className="pointer-events-none absolute inset-x-0 top-[38%] -z-0 h-[70%] bg-[radial-gradient(60%_60%_at_10%_60%,#dff7ef_0%,transparent_70%),radial-gradient(50%_50%_at_95%_40%,#e8faf4_0%,transparent_70%)]" />
          <div className="stagger relative mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
              <Sparkles className="size-4" /> IA Especializada em Redes Sociais
            </span>
            <h1 className="mt-6 text-[40px] leading-[1.04] font-extrabold tracking-[-0.035em] text-ink sm:text-[64px] md:text-[76px]">
              Crie posts e stories profissionais <span className="text-gradient-animated">em minutos</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              A MIDFLOW usa Inteligência Artificial para gerar conteúdos personalizados para o seu negócio com sequências de Stories que vendem, calendário editorial e auxílio para publicação.
            </p>
            <form onSubmit={start} className="mx-auto mt-9 flex max-w-2xl flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Nome da sua empresa</span>
                <Store className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brand-600" />
                <input
                  id="hero-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Digite o nome da sua empresa"
                  className="h-14 w-full rounded-2xl border border-line bg-white pr-4 pl-12 text-base shadow-card placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
                />
              </label>
              <Button type="submit" size="lg" className="h-14 rounded-2xl px-7 text-base">
                Testar gratuitamente <ArrowRight className="size-5" />
              </Button>
            </form>
            <p className="mt-3 text-sm text-slate-500">
              Sem cartão de crédito.{' '}
              <button
                className="font-semibold text-brand-700 underline-offset-2 hover:underline"
                onClick={() => {
                  loadDemo()
                  nav('/app')
                }}
              >
                Ver demonstração interativa
              </button>
            </p>
          </div>

          <div className="stagger relative mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-6 md:grid-cols-4">
            {[
              [Zap, 'Conteúdos com IA', 'Posts, stories e legendas'],
              [ImageIcon, 'Personalizado', 'para a sua identidade de marca'],
              [Clock, 'Pronto em minutos', 'Calendário e horários de pico'],
              [BarChart3, 'Mais presença', 'e mais vendas no Direct'],
            ].map(([I, t, d]) => {
              const Icon = I as typeof Zap
              return (
                <div key={t as string} className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 sm:size-12">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block text-sm font-semibold">{t as string}</span>
                    <span className="block text-sm text-slate-500">{d as string}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <Showcase />
        </section>

        {/* How it works */}
        <section id="como" className="scroll-mt-24 bg-canvas px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-bold tracking-[.14em] text-brand-700 uppercase">Como funciona</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[44px] sm:leading-[1.08]">
                Você explica o seu negócio. A MIDFLOW cria o conteúdo.
              </h2>
            </Reveal>
            <ol className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 lg:grid-cols-4">
              {STEPS.map(([t, d], i) => (
                <Reveal as="li" key={t} delay={i * 110} className="lift relative rounded-2xl border border-line bg-white p-4 sm:p-6">
                  <span className="grid size-10 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="mt-4 text-base font-bold sm:mt-5 sm:text-lg">{t}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600 sm:text-[15px]">{d}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Stories narrative */}
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-12">
            <Reveal>
              <p className="text-sm font-bold tracking-[.14em] text-brand-700 uppercase">Diferencial exclusivo</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[44px] sm:leading-[1.08]">
                Stories com narrativa comercial, não peças soltas
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                Cada sequência é pensada com metodologia comprovada de vendas: prender a atenção no primeiro story, aprofundar na dor do cliente, apresentar a solução e direcionar para o Direct.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Enquete de 2 opções no 1º story para dobrar respostas imediatas',
                  'Variações de antes/depois e depoimentos como prova social',
                  'Chamada para ação clara que gera conversas e pedidos',
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-[15px]">
                    <span className="grid size-6 place-items-center rounded-full bg-brand-100 text-brand-700">
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <StoriesNarrative />
          </div>
        </section>

        {/* Examples */}
        <section id="exemplos" className="scroll-mt-24 bg-canvas px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold tracking-[.14em] text-brand-700 uppercase">Exemplos reais</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[44px] sm:leading-[1.08]">
                Funciona para o seu nicho de atuação
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Com base no seu segmento, o motor adapta a linguagem visual e textual para atrair quem realmente compra de você.
              </p>
            </Reveal>
            <div className="mt-10">
              <Examples />
            </div>
          </div>
        </section>

        {/* Plans */}
        <section id="planos" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold tracking-[.14em] text-brand-700 uppercase">Planos e preços</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[44px] sm:leading-[1.08]">
                Escolha o seu ritmo de conteúdo
              </h2>
              <p className="mt-4 text-lg text-slate-600">Comece grátis. Mude ou cancele quando quiser sem multas.</p>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {PLANS.map((p, i) => (
                <Reveal
                  key={p.id}
                  delay={i * 110}
                  className={cx(
                    'lift relative flex flex-col rounded-3xl border p-6 sm:p-7',
                    p.highlight ? 'border-ink bg-ink text-white shadow-pop md:-my-3 md:py-10' : 'border-line bg-white',
                  )}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-7 rounded-full bg-mint px-3 py-1 text-xs font-bold text-ink">
                      Mais escolhido
                    </span>
                  )}
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  <p className={cx('mt-1 text-sm', p.highlight ? 'text-slate-300' : 'text-slate-500')}>{p.tagline}</p>
                  <div className="mt-6 flex items-end gap-1">
                    <span className="text-lg font-semibold">R$</span>
                    <span className="text-5xl font-extrabold tracking-tight tabular-nums">{p.price}</span>
                    <span className={cx('mb-1.5 text-sm', p.highlight ? 'text-slate-300' : 'text-slate-500')}>/mês</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[15px]">
                        <Check className={cx('mt-0.5 size-4 shrink-0', p.highlight ? 'text-mint' : 'text-brand-600')} strokeWidth={3} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={p.highlight ? 'primary' : 'secondary'}
                    className="mt-7 w-full"
                    onClick={() => nav('/cadastro', { state: { plan: p.id } })}
                  >
                    Começar com o {p.name}
                  </Button>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="depoimentos" className="scroll-mt-24 bg-canvas px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold tracking-[.14em] text-brand-700 uppercase">Depoimentos</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[44px] sm:leading-[1.08]">
                Quem usa, publica com constância e fecha clientes
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                [
                  'Antes eu passava o domingo inteiro pensando no que postar na segunda. Agora em 10 minutos deixo a semana toda programada e com a identidade da clínica.',
                  'Dra. Camila Martins',
                  'Estética & Saúde',
                ],
                [
                  'Os Stories com enquete e narrativa aumentaram muito as mensagens no nosso WhatsApp. E as legendas já vêm perfeitas, sem clichês.',
                  'Rodrigo Ferreira',
                  'Restaurante & Delivery',
                ],
                [
                  'Uso as cores e o logo da loja em tudo. A qualidade dos criativos é de agência, mas com total liberdade e sem esperar dias por alterações.',
                  'Juliana Meireles',
                  'Moda Feminina',
                ],
              ].map(([t, a, s], i) => (
                <Reveal as="figure" key={a} delay={i * 110} className="lift flex flex-col rounded-2xl border border-line bg-white p-6">
                  <div className="flex gap-0.5 text-amber-400">{'★★★★★'}</div>
                  <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-slate-700">“{t}”</blockquote>
                  <figcaption className="mt-5 text-sm">
                    <b>{a}</b> · <span className="text-slate-500">{s}</span>
                  </figcaption>
                </Reveal>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-slate-400">
              Depoimentos e resultados reais de empreendedores que transformaram sua presença digital com a MIDFLOW.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-[40px]">Perguntas frequentes</h2>
            <div className="mt-10 divide-y divide-line rounded-2xl border border-line">
              {FAQ.map(([q, a], i) => (
                <div key={q}>
                  <button
                    onClick={() => setFaq(faq === i ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left font-semibold sm:px-6"
                    aria-expanded={faq === i}
                  >
                    {q}
                    <ChevronDown className={cx('size-5 shrink-0 text-slate-400 transition duration-300', faq === i && 'rotate-180 text-brand-600')} />
                  </button>
                  <div className="accordion" data-open={faq === i}>
                    <div>
                      <p className="-mt-1 px-6 pb-5 text-[15px] leading-relaxed text-slate-600">{a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-20 sm:px-6">
          <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-ink px-6 py-12 text-center text-white sm:rounded-[32px] sm:px-12 sm:py-14">
            <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-brand-600/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-mint/20 blur-3xl" />
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-[44px] sm:leading-[1.08]">
              Sua presença de conteúdo pronta em minutos
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-slate-300">
              Crie sua conta gratuita, responda o briefing do seu negócio e veja seus posts, sequências de Stories e calendário prontos hoje.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => nav('/cadastro')}>
                Criar conta grátis <ArrowRight className="size-5" />
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  loadDemo()
                  nav('/app')
                }}
              >
                Ver demonstração interativa
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <Logo className="text-lg" />
          <span>© 2026 MIDFLOW · midflow.com.br · Todos os direitos reservados.</span>
          <span>Plataforma Inteligente de Conteúdo para Redes Sociais</span>
        </div>
      </footer>

      {/* Modal: Artigos & Dicas de Social Media */}
      <Modal open={blogModal} onClose={() => setBlogModal(false)} title="Dicas de Social Media & Guias Práticos">
        <div className="max-h-[75vh] overflow-y-auto p-6 scroll-thin">
          <p className="text-sm text-slate-600">
            Aprenda as melhores estratégias e práticas comprovadas para aumentar seu engajamento e vendas no Instagram.
          </p>

          <div className="mt-6 space-y-6">
            {BLOG_ARTICLES.map((art, idx) => (
              <div key={idx} className="rounded-2xl border border-line bg-canvas p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">
                    {art.category}
                  </span>
                  <span className="text-xs text-slate-500">{art.readTime}</span>
                </div>
                <h3 className="mt-2 text-base font-bold text-ink">{art.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{art.summary}</p>
                <div className="mt-4 space-y-1.5 rounded-xl border border-line bg-white p-3.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-700">Pontos Práticos:</div>
                  {art.bullets.map((b, bi) => (
                    <div key={bi} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-600" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end border-t border-line pt-4">
            <Button onClick={() => setBlogModal(false)}>Fechar Guia</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
