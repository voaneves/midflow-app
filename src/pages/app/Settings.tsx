import { AlertTriangle, Bell, Bot, CreditCard, MessageSquareWarning, Radio, RotateCcw, ShieldCheck, Sparkles, Trash2, UserCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, ChoiceGroup, ConfirmDialog, cx, Dialog, Field, FieldError, Input, toast, Toggle, usePref } from '../../components/ui'
import { ManageSubscriptionButton } from '../../components/ManageSubscription'
import { useCanManageSubscription } from '../../lib/subscription'
import { MyReviews } from '../../components/MyReviews'
import { api } from '../../lib/api'
import { deleteAccount, getBackend } from '../../lib/backend'
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

/** Every localStorage key owned by the app: the persisted store plus the small `mf.*` preferences. */
function clearAllLocalData() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k === 'midflow-storage-v3' || k.startsWith('mf.') || k.startsWith('midflow'))) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* storage blocked: nothing persisted to remove */
  }
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
  const logout = useApp((s) => s.logout)
  // A real (cloud) account has a backend id. Demo and browser-only logins do not, and keep the browser-only wording.
  const cloud = !!user?.id
  const canManageSubscription = useCanManageSubscription()

  const [userName, setUserName] = useState(user?.name ?? '')
  const [userEmail, setUserEmail] = useState(user?.email ?? '')
  const [nameError, setNameError] = useState('')
  const [notifs, setNotifs] = usePref<Record<NotifKey, boolean>>('mf.settings.notifs', { semanal: true, novidades: true, datas: true, socialTips: true })
  const [feedFormat, setFeedFormat] = usePref<'4:5' | '1:1'>('mf.settings.feedFormat', '4:5')
  const [network, setNetwork] = usePref<'instagram' | 'whatsapp'>('mf.settings.network', 'instagram')
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const closeDelete = () => {
    if (deleting) return
    setConfirmDelete(false)
    setDeleteText('')
    setDeleteError('')
  }

  const removeAccount = async () => {
    setDeleting(true)
    setDeleteError('')
    const res = await deleteAccount()
    if (!res.ok) {
      setDeleteError(res.error)
      setDeleting(false)
      return
    }
    // The server already removed the account: drop the local session and every copy kept on this device.
    try {
      await (await getBackend()).auth.signOut()
    } catch {
      /* the session died with the account */
    }
    nav('/', { replace: true })
    logout()
    clearAllLocalData()
    toast('Sua conta foi excluída e seus dados foram apagados.')
  }

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

      {canManageSubscription && (
        <Group id="st-billing" icon={<CreditCard className="size-4" aria-hidden />} title="Assinatura" hint="Você será levado ao ambiente seguro da Stripe, onde pode trocar o cartão, mudar de plano ou cancelar.">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-sm text-fg-muted">Atualize a forma de pagamento, veja suas faturas ou cancele quando quiser.</p>
            <ManageSubscriptionButton variant="secondary" className="w-full sm:w-auto" />
          </div>
        </Group>
      )}

      {/* Engine diagnostics are for the team, not customers: dev builds only (production: /api/status with ADMIN_TOKEN). */}
      {import.meta.env.DEV && <AIStatusCard />}

      {/* Only real accounts (with a backend id) have requests stored on the server. */}
      {user?.id && (
        <Group id="st-reviews" icon={<MessageSquareWarning className="size-4" aria-hidden />} title="Minhas revisões" hint="Pedidos enviados com o botão “Solicitar revisão” na tela de criativos.">
          <MyReviews />
        </Group>
      )}

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

      <Group id="st-data" icon={<RotateCcw className="size-4" aria-hidden />} title="Dados e demonstração" hint={cloud ? 'Suas marcas e criações ficam guardadas na sua conta.' : 'Seus dados e criações ficam salvos neste navegador.'}>
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
        {!cloud && (
          <div className="flex flex-col gap-3 border-b border-red-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="font-semibold">Restaurar dados de demonstração</p>
              <p className="text-sm text-fg-subtle">Substitui empresa, briefing, gerações e calendário pelo exemplo do Studio Aurora.</p>
            </div>
            <Button variant="danger" className="shrink-0" onClick={() => setConfirmDemo(true)}>
              <Sparkles className="size-4" aria-hidden /> Restaurar
            </Button>
          </div>
        )}
        {cloud ? (
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="font-semibold">Excluir minha conta</p>
              <p className="text-sm text-fg-subtle">Apaga para sempre sua conta, marcas, criações, biblioteca e histórico, e cancela a assinatura, se houver. Você pode baixar suas peças antes.</p>
            </div>
            <Button variant="danger" className="shrink-0" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" aria-hidden /> Excluir minha conta
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="font-semibold">Excluir todos os meus dados</p>
              <p className="text-sm text-fg-subtle">Apaga conta, marcas, briefing, criações, biblioteca, calendário e preferências guardados neste navegador.</p>
            </div>
            <Button variant="danger" className="shrink-0" onClick={() => setConfirmWipe(true)}>
              <Trash2 className="size-4" aria-hidden /> Excluir tudo
            </Button>
          </div>
        )}
      </Group>

      <p className="-mt-3 px-1 text-caption text-fg-subtle">
        Veja como tratamos seus dados na{' '}
        <Link to="/privacidade" className="font-semibold text-brand-700 underline">
          Política de Privacidade
        </Link>{' '}
        e nos{' '}
        <Link to="/termos" className="font-semibold text-brand-700 underline">
          Termos de Uso
        </Link>
        .
      </p>

      <Dialog
        open={confirmDelete}
        onClose={closeDelete}
        title="Excluir sua conta?"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeDelete} disabled={deleting} className="h-11 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
              Cancelar
            </button>
            <Button variant="danger" onClick={removeAccount} loading={deleting} disabled={deleteText.trim() !== 'EXCLUIR'} className="h-11">
              Excluir minha conta
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 px-5 py-4 text-sm text-slate-700 md:px-6">
          <p>
            Sua conta, marcas, briefings, criações, biblioteca e pedidos de revisão serão apagados dos nossos servidores e a assinatura será cancelada. Essa ação não pode ser desfeita. Baixe antes as peças de que ainda precisa.
          </p>
          <Field label={<>Para confirmar, digite <b>EXCLUIR</b></>} id="st-delete-confirm">
            <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          </Field>
          <div role="alert">{deleteError && <FieldError>{deleteError}</FieldError>}</div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title="Excluir todos os seus dados?"
        confirmLabel="Excluir tudo"
        danger
        onConfirm={() => {
          clearAllLocalData()
          // Reload so the in-memory store cannot write the old state back to storage.
          window.location.replace(window.location.pathname + window.location.search + '#/')
          window.location.reload()
        }}
      >
        <p className="text-sm text-fg-muted">
          Conta, marcas, briefing, criações, biblioteca, calendário e preferências serão apagados deste navegador e você será desconectado. Essa ação não pode ser desfeita. Baixe antes as peças de que ainda precisa.
        </p>
      </ConfirmDialog>

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
                como "Versão padrão".
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
