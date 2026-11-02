import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  Crown,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  PenSquare,
  Plus,
  Settings,
  Sparkles,
  Store,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { planDef } from '../lib/data'
import { useApp } from '../lib/store'
import { ExportHost } from './creative/parts'
import { InstallHint } from './InstallHint'
import { cx, IconButton, Logo, Popover, useIsPhone, useKeyboardFlag, usePref, UsageMeter } from './ui'

const NAV = [
  { to: '/app', label: 'Início', icon: Home, end: true },
  { to: '/app/criar', label: 'Criar conteúdo', icon: PenSquare },
  { to: '/app/posts', label: 'Meus posts', icon: FileText },
  { to: '/app/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/app/biblioteca', label: 'Biblioteca', icon: FolderOpen },
  { to: '/app/marca', label: 'Minha marca', icon: Store },
  { to: '/app/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/app/planos', label: 'Planos', icon: CreditCard },
  { to: '/app/config', label: 'Configurações', icon: Settings },
]

/** Page title (the single <h1>), subtitle and where the mobile back arrow goes. */
function routeMeta(path: string): { title: string; sub: string; back?: string } {
  const step = path.match(/^\/app\/criar\/(\d)/)
  if (step) {
    const n = Number(step[1])
    return { title: 'Criar conteúdo', sub: 'Preencha o briefing e gere posts e stories personalizados para a sua marca.', back: n > 1 ? `/app/criar/${n - 1}` : '/app' }
  }
  const table: [RegExp, string, string, string?][] = [
    [/^\/app\/posts/, 'Meus posts', 'Todas as gerações, com as versões que a IA criou para você.'],
    [/^\/app\/calendario/, 'Calendário', 'Planeje datas, agende publicações e veja as datas comemorativas.'],
    [/^\/app\/biblioteca/, 'Biblioteca', 'Criativos salvos, prontos para baixar e publicar.'],
    [/^\/app\/marca/, 'Minha marca', 'A identidade que a MIDFLOW usa em cada conteúdo.', '/app'],
    [/^\/app\/relatorios/, 'Relatórios', 'Frequência, mix de formatos e checklist de crescimento.', '/app'],
    [/^\/app\/planos/, 'Planos', 'Escolha o ritmo de conteúdo ideal para o seu negócio.', '/app'],
    [/^\/app\/config/, 'Configurações', 'Conta, motor de IA, notificações e dados.', '/app'],
  ]
  const hit = table.find(([re]) => re.test(path))
  return hit ? { title: hit[1], sub: hit[2], back: hit[3] } : { title: 'Início', sub: 'Seu conteúdo da semana começa aqui.' }
}

const NOTIFICATIONS = [
  ['Dica da semana', 'Sequências de Stories com enquete no 1º story têm mais respostas.'],
  ['Novidade', 'Agora você pode baixar vários criativos de uma vez em .zip.'],
  ['Lembrete', 'Que tal preparar os conteúdos do Dia das Crianças?'],
]

/** Places one contextual action in the app header (e.g. the Step 4 kebab on phones). */
export function HeaderAction({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => setEl(document.getElementById('header-action')), [])
  return el ? createPortal(children, el) : null
}

function PlanCard({ dark, onNavigate, compact }: { dark?: boolean; onNavigate?: () => void; compact?: boolean }) {
  const plan = useApp((s) => s.plan)
  const used = useApp((s) => s.used)
  const p = planDef(plan)
  if (compact)
    return (
      <Link to="/app/planos" className="mx-auto mb-2 grid size-11 place-items-center rounded-xl text-mint hover:bg-white/5" aria-label={`Plano ${p.name}: ${used} de ${p.contents} conteúdos usados`} title={`Plano ${p.name}: ${used}/${p.contents}`}>
        <Crown className="size-5" aria-hidden />
      </Link>
    )
  return (
    <div className={cx('rounded-2xl p-4', dark ? 'm-3 border border-white/10 bg-white/[.04]' : 'border border-line bg-slate-50')}>
      <div className={cx('mb-3 flex items-center gap-2 text-sm font-semibold', dark ? 'text-white' : 'text-ink')}>
        <Crown className={cx('size-5', dark ? 'text-mint' : 'text-brand-700')} aria-hidden /> Plano {p.name}
      </div>
      <UsageMeter used={used} total={p.contents} label="Conteúdos este mês" tone={dark ? 'dark' : 'light'} />
      <Link
        to="/app/planos"
        onClick={onNavigate}
        className={cx('mt-3 flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition', dark ? 'bg-white text-ink hover:bg-brand-50' : 'border border-line bg-white text-ink hover:bg-brand-50')}
      >
        Ver planos
      </Link>
    </div>
  )
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="flex h-full flex-col bg-ink text-slate-300">
      <Link to="/app" className={cx('flex h-16 shrink-0 items-center text-lg', collapsed ? 'justify-center' : 'px-6')} aria-label="MIDFLOW, início">
        <Logo dark mark={collapsed} />
      </Link>
      <div className="mx-4 border-t border-white/10" />
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scroll-thin" aria-label="Menu principal">
        {NAV.map(({ to, label, icon: I, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cx(
                'flex h-11 items-center gap-3.5 rounded-xl text-sm font-medium transition',
                collapsed ? 'justify-center' : 'px-3.5',
                isActive ? 'bg-brand-700 text-white shadow-[0_8px_20px_-10px_rgba(18,179,134,.7)]' : 'hover:bg-white/5 hover:text-white',
              )
            }
          >
            <I className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className={cx(collapsed && 'sr-only')}>{label}</span>
          </NavLink>
        ))}
      </nav>
      {collapsed ? <PlanCard dark compact /> : <PlanCard dark />}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={collapsed}
        className={cx('mx-3 mb-3 flex h-10 items-center gap-2 rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:text-white', collapsed ? 'justify-center' : 'px-3.5')}
      >
        {collapsed ? <ChevronsRight className="size-5" aria-hidden /> : <ChevronsLeft className="size-5" aria-hidden />}
        <span className={cx(collapsed && 'sr-only')}>Recolher menu</span>
      </button>
    </div>
  )
}

function NotificationList() {
  return (
    <ul>
      {NOTIFICATIONS.map(([t, d]) => (
        <li key={t} className="border-b border-line px-4 py-3 last:border-0">
          <div className="text-xs font-semibold text-brand-800">{t}</div>
          <div className="mt-0.5 text-sm text-slate-700">{d}</div>
        </li>
      ))}
    </ul>
  )
}

/** Account content: brands, plan + notifications (phones), secondary pages, demo, sign out. */
function AccountPanel({ close }: { close: () => void }) {
  const phone = useIsPhone()
  const user = useApp((s) => s.user)
  const brand = useApp((s) => s.brand)
  const brands = useApp((s) => s.brands)
  const switchBrand = useApp((s) => s.switchBrand)
  const logout = useApp((s) => s.logout)
  const loadDemo = useApp((s) => s.loadDemo)
  const nav = useNavigate()
  const go = (to: string) => {
    close()
    nav(to)
  }
  const row = 'flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50'
  return (
    <div className="pb-2">
      <div className="border-b border-line px-4 py-3">
        <div className="text-sm font-semibold text-ink">{user?.name}</div>
        <div className="truncate text-xs text-fg-subtle">{user?.email}</div>
      </div>
      <div className="border-b border-line bg-slate-50/70 px-3 py-2.5">
        <div className="flex items-center justify-between px-1 text-xs font-bold tracking-wide text-fg-subtle uppercase">
          <span id="brands-label">Empresas ({brands?.length || 1})</span>
          <button type="button" onClick={() => go('/app/marca')} className="min-h-10 rounded-lg px-2 font-bold text-brand-800 normal-case hover:bg-white">
            Gerenciar
          </button>
        </div>
        <ul aria-labelledby="brands-label" className="mt-1 max-h-40 space-y-1 overflow-y-auto scroll-thin">
          {(brands || [brand]).map((b) => {
            const on = b.id === brand.id
            return (
              <li key={b.id || b.name}>
                <button
                  type="button"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => {
                    if (b.id) switchBrand(b.id)
                    close()
                  }}
                  className={cx('flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition', on ? 'bg-white font-bold text-brand-900 ring-1 ring-slate-200' : 'text-slate-700 hover:bg-white')}
                >
                  <span className="size-3 shrink-0 rounded-full" style={{ background: b.colors?.[0] || '#0B7A5E' }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-left">{b.name}</span>
                  {on && <Check className="size-4 text-brand-700" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {phone && (
        <>
          <div className="border-b border-line p-3">
            <PlanCard onNavigate={close} />
          </div>
          <details className="group border-b border-line">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 text-sm font-medium text-slate-800">
              <Bell className="size-5 text-slate-600" aria-hidden />
              <span className="flex-1">Notificações</span>
              <span className="rounded-full bg-red-700 px-2 py-0.5 text-xs font-bold text-white">{NOTIFICATIONS.length} novas</span>
              <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <NotificationList />
          </details>
        </>
      )}
      <nav aria-label="Conta">
        {(
          [
            ['Minha marca', '/app/marca', Store],
            ['Relatórios', '/app/relatorios', BarChart3],
            ['Planos', '/app/planos', CreditCard],
            ['Configurações', '/app/config', Settings],
          ] as const
        ).map(([l, to, Icon]) => (
          <button key={to} type="button" onClick={() => go(to)} className={row}>
            <Icon className="size-5 text-slate-600" aria-hidden /> {l}
          </button>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => {
          loadDemo()
          go('/app')
        }}
        className={cx(row, 'text-brand-800')}
      >
        <Sparkles className="size-5" aria-hidden /> Carregar demonstração
      </button>
      <button
        type="button"
        onClick={() => {
          logout()
          go('/')
        }}
        className={cx(row, 'border-t border-line')}
      >
        <LogOut className="size-5 text-slate-600" aria-hidden /> Sair
      </button>
    </div>
  )
}

function AccountButton() {
  const user = useApp((s) => s.user)
  const brand = useApp((s) => s.brand)
  const initials = (user?.name ?? 'U').split(' ').map((w) => w[0]).slice(0, 2).join('')
  return (
    <Popover
      title="Conta"
      width="w-72"
      trigger={(p) => (
        <button type="button" {...p} className="relative flex min-h-11 items-center gap-3 rounded-xl p-0.5 hover:bg-slate-100 md:pr-2">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-600 to-ink text-sm font-bold text-white ring-2 ring-brand-100" aria-hidden>
            {brand.logo ? <img src={brand.logo} alt="" className="size-full bg-white object-contain p-1" /> : initials}
          </span>
          {/* visible text doubles as the accessible name (WCAG 2.5.3) */}
          <span className="sr-only md:not-sr-only md:block md:text-left md:leading-tight">
            <span className="block text-sm font-semibold">{user?.name}</span>
            <span className="block text-xs text-fg-subtle">{brand.name}</span>
          </span>
          <span className="sr-only md:hidden">, conta e notificações</span>
          <ChevronDown className="hidden size-4 text-slate-500 md:block" aria-hidden />
          <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-red-600 ring-2 ring-white md:hidden" aria-hidden />
        </button>
      )}
    >
      {(close) => <AccountPanel close={close} />}
    </Popover>
  )
}

function Notifications() {
  return (
    <Popover
      title="Notificações"
      trigger={(p) => (
        <IconButton {...p} label={`Notificações, ${NOTIFICATIONS.length} novas`} badge={<span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-red-600 ring-2 ring-white" aria-hidden />}>
          <Bell className="size-5" strokeWidth={1.75} aria-hidden />
        </IconButton>
      )}
    >
      {() => (
        <>
          <div className="border-b border-line px-4 py-3 text-sm font-bold">Notificações</div>
          <NotificationList />
        </>
      )}
    </Popover>
  )
}

function BottomNav() {
  const items = [
    { to: '/app', label: 'Início', icon: Home, end: true },
    { to: '/app/posts', label: 'Posts', icon: FileText },
    { to: '/app/criar', label: 'Criar', icon: Plus, primary: true },
    { to: '/app/calendario', label: 'Calendário', icon: CalendarDays },
    { to: '/app/biblioteca', label: 'Salvos', icon: FolderOpen },
  ]
  return (
    <nav
      data-hide-on-keyboard
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[var(--safe-bottom)] blur-surface backdrop-blur-md lg:hidden"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex h-16 max-w-xl items-stretch justify-around px-1">
        {items.map(({ to, label, icon: I, end, primary }) => (
          <li key={to} className="flex flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition',
                  primary ? 'text-brand-800' : isActive ? 'font-bold text-brand-800' : 'text-slate-600 hover:text-ink',
                )
              }
            >
              {({ isActive }) =>
                primary ? (
                  <>
                    <span className={cx('-mt-6 grid size-13 place-items-center rounded-full text-white shadow-cta ring-4 ring-white', isActive ? 'bg-brand-800' : 'bg-brand-700')} aria-hidden>
                      <I className="size-6" strokeWidth={2.4} />
                    </span>
                    <span className="font-bold">{label}</span>
                  </>
                ) : (
                  <>
                    <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-100')} aria-hidden>
                      <I className="size-5" strokeWidth={isActive ? 2.2 : 1.75} />
                    </span>
                    {label}
                  </>
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/* Scroll position per route (and per create step, since each step is its own path). */
const scrollMemory = new Map<string, number>()

export function AppLayout() {
  const loc = useLocation()
  const nav = useNavigate()
  const meta = routeMeta(loc.pathname)
  const [collapsed, setCollapsed] = usePref('mf.sidebar.collapsed', false)
  const h1 = useRef<HTMLHeadingElement>(null)
  const [announce, setAnnounce] = useState('')
  const firstRoute = useRef(true)
  const inCreate = loc.pathname.startsWith('/app/criar')
  useKeyboardFlag()

  // The bottom nav steps aside inside the focused create flow (it has its own back arrow + action bar).
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--bottom-nav-h', inCreate ? '0px' : 'calc(64px + var(--safe-bottom))')
    return () => root.style.setProperty('--bottom-nav-h', '0px')
  }, [inCreate])

  useLayoutEffect(() => {
    const path = loc.pathname
    window.scrollTo({ top: scrollMemory.get(path) ?? 0 })
    document.title = `${meta.title} · MIDFLOW`
    if (firstRoute.current) firstRoute.current = false
    else {
      // Announce the new page and move focus to its heading (screen readers + keyboard users).
      setAnnounce(meta.title)
      h1.current?.focus({ preventScroll: true })
    }
    return () => {
      scrollMemory.set(path, window.scrollY)
    }
  }, [loc.pathname, meta.title])

  return (
    <div className="min-h-dvh bg-canvas lg:pl-[var(--sidebar-w)]" style={{ ['--sidebar-w' as string]: collapsed ? '72px' : '248px' }}>
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only z-[90] rounded-xl bg-ink px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] transition-[width] duration-200 lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </aside>
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 pt-[var(--safe-top)] blur-surface backdrop-blur-md">
        <div className="flex h-[var(--header-h)] items-center gap-1.5 px-2 sm:px-4 lg:gap-3 lg:px-6 xl:px-8">
          {meta.back ? (
            <IconButton label="Voltar" onClick={() => nav(meta.back!)} className="lg:hidden">
              <ArrowLeft className="size-5" aria-hidden />
            </IconButton>
          ) : (
            <Link to="/app" className="grid size-11 shrink-0 place-items-center text-lg lg:hidden" aria-label="MIDFLOW, início">
              <Logo mark />
            </Link>
          )}
          <div className="min-w-0 flex-1 pl-1 lg:pl-0">
            <h1 ref={h1} tabIndex={-1} className="truncate text-title-sm font-bold outline-none md:text-title">
              {meta.title}
            </h1>
            <p className="hidden truncate text-sm text-fg-subtle lg:block">{meta.sub}</p>
          </div>
          <div id="header-action" className="flex items-center" />
          <div className="hidden md:block">
            <Notifications />
          </div>
          <AccountButton />
        </div>
      </header>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      <main id="main" tabIndex={-1} className="px-4 pt-4 pb-[calc(var(--bottom-nav-h)+var(--action-bar-h)+24px)] outline-none sm:px-6 sm:pt-6 lg:pb-10 xl:px-8">
        <div key={loc.pathname.split('/').slice(0, 3).join('/')} className="animate-rise">
          <Outlet />
        </div>
      </main>
      {!inCreate && <BottomNav />}
      <ExportHost />
      <InstallHint />
    </div>
  )
}
