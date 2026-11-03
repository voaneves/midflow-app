import { KeyRound, LogIn, ShieldX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SEOHead, SITE_URL } from '../../components/SEOHead'
import { Button, Field, FieldError, Input, Logo, Spinner, TabPanel, Tabs } from '../../components/ui'
import { getBackend, isSupabaseConfigured } from '../../lib/backend'
import { readStoredToken, staffApi, storeToken, type Credential, type Me, type StaffRole } from '../../lib/staff'
import { AiHealthPanel } from './AiHealthPanel'
import { MetricsPanel } from './MetricsPanel'
import { ReviewsPanel } from './ReviewsPanel'
import { Notice } from './shared'
import { TeamPanel } from './TeamPanel'

type TabId = 'reviews' | 'ai' | 'metrics' | 'team'
type Phase = { kind: 'checking' } | { kind: 'login'; error?: string } | { kind: 'forbidden' } | { kind: 'error'; message: string } | { kind: 'ready'; cred: Credential; me: Me }

const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Administrador', editor: 'Editor' }

/** Tabs by role. Only a UX filter: the server enforces every permission. */
function tabsFor(role: StaffRole): { id: TabId; label: string }[] {
  const all: { id: TabId; label: string }[] = [{ id: 'reviews', label: 'Revisões' }]
  if (role === 'admin')
    all.push({ id: 'ai', label: 'Saúde da IA' }, { id: 'metrics', label: 'Métricas' }, { id: 'team', label: 'Equipe' })
  return all
}

/** Private staff panel (#/painel). Not linked from the public site and marked noindex. */
export function Admin() {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' })
  const [tab, setTab] = useState<TabId>('reviews')

  const check = useCallback(async (cred: Credential, fromToken: boolean) => {
    setPhase({ kind: 'checking' })
    const res = await staffApi.me(cred)
    if (res.ok) return setPhase({ kind: 'ready', cred, me: res.data })
    if (fromToken) storeToken('')
    if (res.status === 401) return setPhase({ kind: 'login', error: fromToken ? 'Token de acesso inválido.' : undefined })
    if (res.status === 403) return setPhase({ kind: 'forbidden' })
    setPhase({ kind: 'error', message: res.error })
  }, [])

  useEffect(() => {
    let live = true
    void (async () => {
      const token = readStoredToken()
      if (token) return live && check({ kind: 'token', token }, true)
      if (isSupabaseConfigured()) {
        const session = await (await getBackend()).auth.getSession().catch(() => null)
        if (session?.accessToken) return live && check({ kind: 'session' }, false)
      }
      if (live) setPhase({ kind: 'login' })
    })()
    return () => {
      live = false
    }
  }, [check])

  const signOutPanel = () => {
    storeToken('')
    setTab('reviews')
    setPhase({ kind: 'login' })
  }

  const tabs = useMemo(() => (phase.kind === 'ready' ? tabsFor(phase.me.role) : []), [phase])

  return (
    <div className="min-h-screen bg-canvas">
      <SEOHead title="Painel da equipe — MIDFLOW" description="Área restrita da equipe MIDFLOW." canonical={`${SITE_URL}#/painel`} noindex />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <Logo className="text-lg" />
            <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 sm:inline">Painel da equipe</span>
          </div>
          {phase.kind === 'ready' && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-fg-muted sm:inline">
                {ROLE_LABEL[phase.me.role]} · {phase.me.via === 'token' ? 'token de acesso' : 'conta'}
              </span>
              {phase.cred.kind === 'token' && (
                <Button size="sm" variant="secondary" onClick={signOutPanel}>
                  Sair do token
                </Button>
              )}
              <Link to="/app" className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap text-brand-700 underline">
                Voltar ao app
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6" id="main">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel da equipe</h1>

        {phase.kind === 'checking' && (
          <div className="mt-6">
            <Spinner label="Verificando acesso" />
          </div>
        )}

        {phase.kind === 'login' && <LoginCard error={phase.error} onToken={(token) => { storeToken(token); void check({ kind: 'token', token }, true) }} />}

        {phase.kind === 'forbidden' && (
          <section className="mt-6 max-w-lg rounded-2xl border border-line bg-white p-6 shadow-card" aria-labelledby="forbidden-title">
            <ShieldX className="size-8 text-danger" aria-hidden />
            <h2 id="forbidden-title" className="mt-3 text-title-sm font-bold">
              Acesso restrito à equipe
            </h2>
            <p className="mt-2 text-sm text-fg-muted">A sua conta não tem permissão para abrir este painel. Se você deveria ter acesso, peça a um administrador para incluir o seu e-mail na equipe.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/app" className="inline-flex h-11 items-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
                Voltar ao app
              </Link>
              <Button variant="secondary" onClick={signOutPanel}>
                Usar um token de acesso
              </Button>
            </div>
          </section>
        )}

        {phase.kind === 'error' && (
          <div className="mt-6 grid max-w-lg gap-3">
            <Notice tone="error">{phase.message}</Notice>
            <div>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'ready' && (
          <div className="mt-4">
            <Tabs idBase="admin" label="Seções do painel" variant="underline" value={tab} onChange={setTab} items={tabs} scrollable />
            <TabPanel idBase="admin" id="reviews" active={tab === 'reviews'} className="mt-5">
              <ReviewsPanel cred={phase.cred} me={phase.me} />
            </TabPanel>
            {phase.me.role === 'admin' && (
              <>
                <TabPanel idBase="admin" id="ai" active={tab === 'ai'} className="mt-5">
                  <AiHealthPanel cred={phase.cred} />
                </TabPanel>
                <TabPanel idBase="admin" id="metrics" active={tab === 'metrics'} className="mt-5">
                  <MetricsPanel cred={phase.cred} />
                </TabPanel>
                <TabPanel idBase="admin" id="team" active={tab === 'team'} className="mt-5">
                  <TeamPanel cred={phase.cred} me={phase.me} />
                </TabPanel>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function LoginCard({ error, onToken }: { error?: string; onToken: (token: string) => void }) {
  const [token, setToken] = useState('')
  const remote = isSupabaseConfigured()
  return (
    <section className="mt-6 grid max-w-lg gap-5 rounded-2xl border border-line bg-white p-6 shadow-card" aria-labelledby="login-title">
      <div>
        <h2 id="login-title" className="text-title-sm font-bold">
          Entre para continuar
        </h2>
        <p className="mt-1 text-sm text-fg-muted">Este painel é restrito à equipe da MIDFLOW.</p>
      </div>
      {remote && (
        <Link to="/entrar" state={{ from: '/painel' }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
          <LogIn className="size-4" aria-hidden /> Entrar com sua conta
        </Link>
      )}
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (token.trim()) onToken(token.trim())
        }}
      >
        <Field label={remote ? 'Ou use um token de acesso' : 'Token de acesso'} id="adm-token" hint="Guardado só nesta aba, até você fechá-la.">
          <Input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} icon={<KeyRound className="size-4" />} />
        </Field>
        <div role="alert">{error && <FieldError>{error}</FieldError>}</div>
        <div>
          <Button type="submit" variant={remote ? 'secondary' : 'primary'} disabled={!token.trim()}>
            Usar token de acesso
          </Button>
        </div>
      </form>
    </section>
  )
}
