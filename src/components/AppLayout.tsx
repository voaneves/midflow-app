import { BarChart3, Bell, CalendarDays, ChevronDown, CreditCard, Crown, FileText, FolderOpen, Home, LogOut, Menu, PenSquare, Settings, Sparkles, Store, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { planDef } from '../lib/data'
import { useApp } from '../lib/store'
import { ExportHost } from './creative/parts'
import { cx, Logo } from './ui'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: Home, end: true },
  { to: '/app/criar', label: 'Criar conteúdo', icon: PenSquare },
  { to: '/app/posts', label: 'Meus posts', icon: FileText },
  { to: '/app/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/app/biblioteca', label: 'Biblioteca', icon: FolderOpen },
  { to: '/app/marca', label: 'Minha marca', icon: Store },
  { to: '/app/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/app/planos', label: 'Planos', icon: CreditCard },
  { to: '/app/config', label: 'Configurações', icon: Settings },
]

const TITLES: [RegExp, string, string][] = [
  [/^\/app\/criar/, 'Criar conteúdo', 'Preencha o briefing e gere posts e stories personalizados para a sua marca.'],
  [/^\/app\/posts/, 'Meus posts', 'Todas as gerações, com as versões que a IA criou para você.'],
  [/^\/app\/biblioteca/, 'Biblioteca', 'Criativos salvos, prontos para baixar e publicar.'],
  [/^\/app\/marca/, 'Minha marca', 'A identidade que a MIDFLOW usa em cada conteúdo.'],
  [/^\/app\/planos/, 'Planos', 'Escolha o ritmo de conteúdo ideal para o seu negócio.'],
  [/^\/app\/config/, 'Configurações', 'Conta, notificações e dados do protótipo.'],
  [/^\/app\/calendario/, 'Calendário', 'Organize seus conteúdos por data.'],
  [/^\/app\/relatorios/, 'Relatórios', 'Acompanhe o desempenho do que você publica.'],
  [/^\/app/, 'Dashboard', 'Seu conteúdo da semana começa aqui.'],
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const plan = useApp((s) => s.plan)
  const used = useApp((s) => s.used)
  const p = planDef(plan)
  const pct = Math.min(100, (used / p.contents) * 100)
  return (
    <div className="flex h-full flex-col bg-ink text-slate-300">
      <Link to="/app" onClick={onNavigate} className="flex h-[76px] items-center px-6 text-[19px]">
        <Logo dark />
      </Link>
      <div className="mx-4 border-t border-white/8" />
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scroll-thin" aria-label="Menu principal">
        {NAV.map(({ to, label, icon: I, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                'flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[14.5px] font-medium transition',
                isActive ? 'bg-brand-700 text-white shadow-[0_8px_20px_-10px_rgba(18,179,134,.7)]' : 'hover:bg-white/5 hover:text-white',
              )
            }
          >
            <I className="size-[19px]" strokeWidth={1.7} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-2xl border border-white/8 bg-white/[.03] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Crown className="size-5 text-mint" /> Plano {p.name}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-mint transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs tabular-nums">
          {used} de {p.contents} conteúdos usados
        </p>
        <Link to="/app/planos" onClick={onNavigate} className="mt-3 flex h-10 items-center justify-center rounded-xl bg-white text-[13px] font-semibold text-ink transition hover:bg-brand-50">
          Fazer upgrade
        </Link>
      </div>
    </div>
  )
}

function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const user = useApp((s) => s.user)
  const brand = useApp((s) => s.brand)
  const logout = useApp((s) => s.logout)
  const loadDemo = useApp((s) => s.loadDemo)
  const nav = useNavigate()
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])
  const initials = (user?.name ?? 'U').split(' ').map((w) => w[0]).slice(0, 2).join('')
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 rounded-xl py-1 pr-1 pl-1 hover:bg-slate-100 sm:pr-2">
        <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-600 to-ink text-sm font-bold text-white">
          {brand.logo ? <img src={brand.logo} alt="" className="size-full bg-white object-contain p-1" /> : initials}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold">{user?.name}</span>
          <span className="block text-xs text-slate-500">{brand.name}</span>
        </span>
        <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-white py-1.5 shadow-pop animate-fade-in">
          <div className="border-b border-line px-4 py-3">
            <div className="text-sm font-semibold">{user?.name}</div>
            <div className="truncate text-xs text-slate-500">{user?.email}</div>
          </div>
          {[
            ['Minha marca', '/app/marca'],
            ['Planos', '/app/planos'],
            ['Configurações', '/app/config'],
          ].map(([l, to]) => (
            <button key={to} onClick={() => (setOpen(false), nav(to))} className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50">
              {l}
            </button>
          ))}
          <button
            onClick={() => {
              loadDemo()
              setOpen(false)
              nav('/app')
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-brand-800 hover:bg-slate-50"
          >
            <Sparkles className="size-4" /> Carregar demonstração
          </button>
          <button
            onClick={() => {
              logout()
              nav('/')
            }}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])
  const items = [
    ['Dica da semana', 'Sequências de Stories com enquete no 1º story têm mais respostas.'],
    ['Novidade', 'Agora você pode baixar vários criativos de uma vez em .zip.'],
    ['Lembrete', 'Que tal preparar os conteúdos do Dia das Crianças?'],
  ]
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100" aria-label="Notificações">
        <Bell className="size-[21px]" strokeWidth={1.7} />
        <span className="absolute top-2 right-2.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-white shadow-pop animate-fade-in">
          <div className="border-b border-line px-4 py-3 text-sm font-bold">Notificações</div>
          {items.map(([t, d]) => (
            <div key={t} className="border-b border-line px-4 py-3 last:border-0">
              <div className="text-xs font-semibold text-brand-700">{t}</div>
              <div className="mt-0.5 text-sm text-slate-600">{d}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AppLayout() {
  const loc = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [, title, sub] = TITLES.find(([re]) => re.test(loc.pathname)) ?? TITLES[TITLES.length - 1]
  useEffect(() => {
    setDrawer(false)
    document.getElementById('main')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [loc.pathname])
  return (
    <div className="min-h-screen bg-canvas lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block">
        <Sidebar />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50 animate-fade-in" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[268px] animate-rise">
            <Sidebar onNavigate={() => setDrawer(false)} />
            <button onClick={() => setDrawer(false)} className="absolute top-5 -right-12 grid size-10 place-items-center rounded-full bg-white" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex h-[76px] items-center gap-3 px-4 sm:px-6 xl:px-8">
          <button onClick={() => setDrawer(true)} className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 lg:hidden" aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold sm:text-[22px]">{title}</h1>
            <p className="hidden truncate text-sm text-slate-500 md:block">{sub}</p>
          </div>
          <Notifications />
          <ProfileMenu />
        </div>
      </header>
      <main id="main" className="px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
        <div key={loc.pathname.split('/').slice(0, 3).join('/')} className="animate-rise">
          <Outlet />
        </div>
      </main>
      <ExportHost />
    </div>
  )
}
