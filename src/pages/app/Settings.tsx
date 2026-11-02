import { AlertTriangle, Bell, Bot, Radio, RotateCcw, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, ChoiceGroup, ConfirmDialog, cx, Field, Input, toast, Toggle, usePref } from '../../components/ui'
import { api } from '../../lib/api'
import { useApp } from '../../lib/store'

/** iOS-Settings-style group: a small heading above a rounded list of rows. */
function Group({ id, icon, title, hint, children, tone }: { id: string; icon: ReactNode; title: string; hint?: ReactNode; children: ReactNode; tone?: 'danger' }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={cx('mb-2 flex items-center gap-2 px-1 text-sm font-bold', tone === 'danger' ? 'text-danger' : 'text-fg-muted')}>
        {icon} {title}
      </h2>
      <div className={cx('rounded-2xl border bg-white shadow-card', tone === 'danger' ? 'border-red-200' : 'border-line')}>{children}</div>
      {hint && <p className="mt-2 px-1 text-caption text-fg-subtle">{hint}</p>}
    </section>
  )
}

const NOTIFS = [
  ['semanal', 'Lembrete semanal', 'Para criar e agendar os conteúdos da semana'],
  ['socialTips', 'Melhores horários', 'Dicas de horários de publicação do seu segmento'],
  ['datas', 'Datas comemorativas', 'Avisos de feriados e datas comerciais'],
  ['novidades', 'Novidades da MIDFLOW', 'Atualizações e novos recursos'],
] as const
type NotifKey = (typeof NOTIFS)[number][0]

export function Settings() {
  const nav = useNavigate()
  const user = useApp((s) => s.user)
  const login = useApp((s) => s.login)
  const loadDemo = useApp((s) => s.loadDemo)
  const resetCreate = useApp((s) => s.resetCreate)

  const [userName, setUserName] = useState(user?.name ?? '')
  const [userEmail, setUserEmail] = useState(user?.email ?? '')
  const [nameError, setNameError] = useState('')
  const [notifs, setNotifs] = usePref<Record<NotifKey, boolean>>('mf.settings.notifs', { semanal: true, novidades: true, datas: true, socialTips: true })
  const [feedFormat, setFeedFormat] = usePref<'4:5' | '1:1'>('mf.settings.feedFormat', '4:5')
  const [network, setNetwork] = usePref<'instagram' | 'whatsapp'>('mf.settings.network', 'instagram')
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const saveAccount = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userName.trim()) {
      setNameError('Digite o seu nome.')
      document.getElementById('st-name')?.focus()
      return
    }
    setNameError('')
    login({ name: userName.trim(), email: userEmail.trim() })
    toast('Dados da conta atualizados')
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-8">
      <Group id="st-account" icon={<UserCheck className="size-4" aria-hidden />} title="Conta e perfil">
        <form onSubmit={saveAccount} noValidate className="grid gap-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" id="st-name" required error={nameError}>
              <Input autoComplete="name" value={userName} onChange={(e) => setUserName(e.target.value)} />
            </Field>
            <Field label="E-mail de acesso" id="st-email">
              <Input type="email" autoComplete="email" inputMode="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" className="w-full sm:w-auto">
              Salvar dados da conta
            </Button>
          </div>
        </form>
      </Group>

      {/* Engine diagnostics are for the team, not customers: dev builds only (production: /api/status with ADMIN_TOKEN). */}
      {import.meta.env.DEV && <AIStatusCard />}

      <Group id="st-publish" icon={<Radio className="size-4" aria-hidden />} title="Publicação" hint="Usado como padrão no assistente de publicação e no calendário.">
        <div className="grid gap-5 p-4 sm:p-5">
          <ChoiceGroup
            legend="Formato padrão para o Feed"
            variant="card"
            value={feedFormat}
            onChange={setFeedFormat}
            options={[
              { value: '4:5', label: '4:5 Retrato', description: 'Ocupa mais tela no Feed (recomendado)' },
              { value: '1:1', label: '1:1 Quadrado', description: 'Formato tradicional' },
            ]}
          />
          <ChoiceGroup
            legend="Rede social prioritária"
            variant="card"
            value={network}
            onChange={setNetwork}
            options={[
              { value: 'instagram', label: 'Instagram', description: 'Feed + Stories' },
              { value: 'whatsapp', label: 'WhatsApp Business', description: 'Status + mensagens' },
            ]}
          />
        </div>
      </Group>

      <Group id="st-notifs" icon={<Bell className="size-4" aria-hidden />} title="Notificações e lembretes">
        <ul className="divide-y divide-line">
          {NOTIFS.map(([k, label, desc]) => (
            <li key={k} className="px-4 py-3 sm:px-5">
              <Toggle on={notifs[k]} onChange={(v) => setNotifs({ ...notifs, [k]: v })} label={<span className="font-semibold">{label}</span>} description={desc} />
            </li>
          ))}
        </ul>
      </Group>

      <Group id="st-data" icon={<RotateCcw className="size-4" aria-hidden />} title="Dados e demonstração" hint="Seus dados e criações ficam salvos neste navegador.">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="font-semibold">Reiniciar fluxo de criação</p>
            <p className="text-sm text-fg-subtle">Limpa o rascunho atual. Biblioteca e calendário são mantidos.</p>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="size-4" aria-hidden /> Reiniciar
          </Button>
        </div>
      </Group>

      <Group id="st-danger" tone="danger" icon={<AlertTriangle className="size-4" aria-hidden />} title="Zona de risco">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="font-semibold">Restaurar dados de demonstração</p>
            <p className="text-sm text-fg-subtle">Substitui empresa, briefing, gerações e calendário pelo exemplo do Studio Aurora.</p>
          </div>
          <Button variant="danger" className="shrink-0" onClick={() => setConfirmDemo(true)}>
            <Sparkles className="size-4" aria-hidden /> Restaurar
          </Button>
        </div>
      </Group>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reiniciar fluxo de criação?"
        confirmLabel="Reiniciar"
        onConfirm={() => {
          resetCreate()
          setConfirmReset(false)
          toast('Fluxo de criação reiniciado')
          nav('/app/criar/1')
        }}
      >
        <p className="text-sm text-fg-muted">O briefing e as escolhas das etapas 1 a 3 voltam ao início. Sua biblioteca e o calendário não são alterados.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDemo}
        onClose={() => setConfirmDemo(false)}
        title="Restaurar demonstração completa?"
        confirmLabel="Restaurar"
        danger
        onConfirm={() => {
          loadDemo()
          setConfirmDemo(false)
          toast('Demonstração restaurada')
          nav('/app')
        }}
      >
        <p className="text-sm text-fg-muted">A empresa ativa, o briefing, as gerações e o calendário voltarão para o exemplo do Studio Aurora. Essa ação não pode ser desfeita.</p>
      </ConfirmDialog>
    </div>
  )
}

interface AIStatus {
  aiEnabled: boolean
  provider: string
  model: string
  imageProvider: 'cloudflare' | 'gemini' | 'none'
  imageModel: string | null
  imageLastError: string | null
  imageAuto?: boolean
  stockFallback?: 'pixabay' | 'catalog'
  minQuality: number
  lastOkAt: number | null
  lastErrorAt: number | null
  lastError: string | null
}

/** Dev-only diagnostics of the AI engine. Keys are configured on the server (.env), never in the browser. */
function AIStatusCard() {
  const [status, setStatus] = useState<AIStatus | null | 'offline'>(null)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch(api('/api/status'))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStatus)
      .catch(() => setStatus('offline'))
  }, [])

  const test = async () => {
    setTesting(true)
    setResult(null)
    try {
      const res = await fetch(api('/api/test-ai'), { method: 'POST' })
      const data = await res.json()
      setResult({ ok: !!data.ok, message: data.message || data.error || 'Sem resposta.' })
    } catch {
      setResult({ ok: false, message: 'Servidor da MIDFLOW indisponível.' })
    } finally {
      setTesting(false)
    }
  }

  const ok = status && status !== 'offline' && status.aiEnabled
  const recentError = status && status !== 'offline' && status.lastErrorAt && (!status.lastOkAt || status.lastErrorAt > status.lastOkAt)

  return (
    <Group id="st-ai" icon={<Bot className="size-4" aria-hidden />} title="Motor de inteligência artificial">
      <div className="p-4 sm:p-5" aria-busy={status === null}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">Status</p>
          {status === null ? (
            <span className="text-caption text-fg-subtle">verificando…</span>
          ) : ok && !recentError ? (
            <Badge className="bg-emerald-100 text-emerald-900">
              <ShieldCheck className="size-3.5" aria-hidden /> IA ativa
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-950">
              <AlertTriangle className="size-3.5" aria-hidden /> {ok ? 'Com falhas recentes' : 'IA desligada'}
            </Badge>
          )}
        </div>

        {status === 'offline' && <p className="mt-3 text-sm text-fg-muted">Esta versão está rodando sem o servidor da MIDFLOW, então os conteúdos vêm de modelos prontos (sem IA).</p>}

        {status && status !== 'offline' && (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-caption text-fg-subtle">Provedor / modelo de texto</dt>
              <dd className="font-semibold text-ink">{status.aiEnabled ? `${status.provider} · ${status.model}` : 'Não configurado'}</dd>
            </div>
            <div>
              <dt className="text-caption text-fg-subtle">Imagens com IA</dt>
              <dd className="font-semibold text-ink">
                {status.imageProvider === 'none' ? 'Desligado — usando fotos de banco' : `${status.imageProvider === 'cloudflare' ? 'Cloudflare Workers AI' : 'Google Gemini'} · ${status.imageModel}`}
              </dd>
              {status.imageProvider !== 'none' && (
                <dd className="text-caption text-fg-subtle">{status.imageAuto ? 'Gera a imagem de todos os posts e stories.' : 'Só no botão "Gerar nova imagem IA" do editor.'}</dd>
              )}
            </div>
            <div>
              <dt className="text-caption text-fg-subtle">Fotos de reserva</dt>
              <dd className="font-semibold text-ink">{status.stockFallback === 'pixabay' ? 'Pixabay (banco de fotos)' : 'Catálogo interno'}</dd>
            </div>
            <div>
              <dt className="text-caption text-fg-subtle">Nota mínima de qualidade</dt>
              <dd className="font-semibold text-ink">{status.minQuality}/100 (abaixo disso a IA revisa o próprio texto)</dd>
            </div>
          </dl>
        )}
        {status && status !== 'offline' && (
          <div className="mt-3 grid gap-3">
            {recentError && status.lastError && <div className="rounded-xl bg-warning-soft p-3 text-caption text-amber-950 ring-1 ring-amber-200">Último erro: {status.lastError}</div>}
            {status.imageLastError && (
              <div className="rounded-xl bg-warning-soft p-3 text-caption text-amber-950 ring-1 ring-amber-200">Último erro de imagem: {status.imageLastError} (as peças seguem com fotos de reserva)</div>
            )}
            {!status.aiEnabled && (
              <div className="rounded-xl bg-slate-50 p-3 text-caption text-fg-muted ring-1 ring-line">
                Para ativar, o administrador define <code>GEMINI_API_KEY</code> no arquivo <code>.env</code> do servidor e reinicia. Enquanto isso, os conteúdos usam modelos prontos e aparecem marcados
                como "Modelo de reserva".
              </div>
            )}
          </div>
        )}

        <div role="status" aria-live="polite">
          {result && <p className={cx('mt-4 rounded-xl p-3.5 text-sm font-medium ring-1', result.ok ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-danger-soft text-red-900 ring-red-200')}>{result.message}</p>}
        </div>

        <div className="mt-4 flex justify-end border-t border-line pt-4">
          <Button variant="secondary" onClick={test} loading={testing} disabled={status === 'offline'} className="w-full sm:w-auto">
            {testing ? 'Testando…' : 'Testar conexão'}
          </Button>
        </div>
      </div>
    </Group>
  )
}
