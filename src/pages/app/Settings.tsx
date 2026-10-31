import { api } from '../../lib/api'
import { AlertTriangle, Bot, Radio, RotateCcw, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, cx, Input, Label, Modal, Select, toast, Toggle } from '../../components/ui'
import { useApp } from '../../lib/store'

export function Settings() {
  const nav = useNavigate()
  const user = useApp((s) => s.user)
  const login = useApp((s) => s.login)
  const loadDemo = useApp((s) => s.loadDemo)
  const resetCreate = useApp((s) => s.resetCreate)

  const [userName, setUserName] = useState(user?.name ?? '')
  const [userEmail, setUserEmail] = useState(user?.email ?? '')

  const [n, setN] = useState({
    semanal: true,
    novidades: true,
    datas: true,
    socialTips: true,
  })

  const [confirm, setConfirm] = useState(false)

  const handleSaveAccount = () => {
    if (!userName.trim()) {
      toast('Digite o seu nome', 'error')
      return
    }
    login({ name: userName.trim(), email: userEmail.trim() })
    toast('Dados da conta atualizados!')
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      {/* Conta */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <UserCheck className="size-5 text-brand-700" />
          <h2 className="text-lg font-bold text-ink">Conta & Perfil</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">Seus dados de identificação na plataforma.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="st-name">Nome completo</Label>
            <Input id="st-name" value={userName} onChange={(e) => setUserName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="st-email">E-mail de acesso</Label>
            <Input id="st-email" type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button size="sm" onClick={handleSaveAccount}>
            Salvar dados da conta
          </Button>
        </div>
      </Card>

      <AIStatusCard />

      {/* Redes Sociais & Assistente de Publicação */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <Radio className="size-5 text-brand-700" />
          <h2 className="text-lg font-bold text-ink">Publicação em Redes Sociais</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Personalize as regras padrão para o assistente de publicação e calendário.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pref-format">Formato padrão para o Feed</Label>
            <Select id="pref-format" defaultValue="4:5">
              <option value="4:5">4:5 Retrato (Ocupa mais tela no Feed - Recomendado)</option>
              <option value="1:1">1:1 Quadrado Tradicional</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="pref-network">Rede social prioritária</Label>
            <Select id="pref-network" defaultValue="instagram">
              <option value="instagram">Instagram (Feed + Stories)</option>
              <option value="whatsapp">WhatsApp Business (Status + Mensagens)</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Notificações */}
      <Card className="p-6">
        <h2 className="text-lg font-bold">Notificações & Lembretes</h2>
        <div className="mt-5 grid gap-4">
          {[
            ['semanal', 'Lembrete semanal para criar e agendar conteúdos'],
            ['socialTips', 'Dicas de melhores horários de publicação do meu segmento'],
            ['datas', 'Avisos de datas comemorativas e feriados comerciais'],
            ['novidades', 'Atualizações e novos recursos da MIDFLOW'],
          ].map(([k, l]) => (
            <Toggle
              key={k}
              on={n[k as keyof typeof n]}
              onChange={(v) => setN({ ...n, [k]: v })}
              label={<span className="font-medium">{l}</span>}
            />
          ))}
        </div>
      </Card>

      {/* Armazenamento & Demonstração */}
      <Card className="p-6">
        <h2 className="text-lg font-bold">Armazenamento & Demonstração</h2>
        <p className="mt-1 text-sm text-slate-500">
          Seus dados e criações ficam salvos localmente neste navegador com sincronização contínua.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              resetCreate()
              toast('Fluxo de criação reiniciado')
              nav('/app/criar/1')
            }}
          >
            <RotateCcw className="size-4" /> Reiniciar fluxo de criação
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <Sparkles className="size-4" /> Restaurar dados de demonstração
          </Button>
        </div>
      </Card>

      {/* Modal Confirmar Demonstração */}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Restaurar demonstração completa?">
        <div className="p-6">
          <p className="text-sm text-slate-600">
            A empresa ativa, o briefing, as gerações e o calendário voltarão para o exemplo do Studio Aurora. Deseja
            continuar?
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                loadDemo()
                setConfirm(false)
                toast('Demonstração restaurada com sucesso')
                nav('/app')
              }}
            >
              Restaurar
            </Button>
          </div>
        </div>
      </Modal>
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
  minQuality: number
  lastOkAt: number | null
  lastErrorAt: number | null
  lastError: string | null
}

/** Read-only, honest status of the AI engine. Keys are configured on the server (.env), never in the browser. */
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
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Bot className="size-5 text-brand-700" />
          <h2 className="text-lg font-bold text-ink">Motor de Inteligência Artificial</h2>
        </div>
        {status === null ? (
          <span className="text-xs text-slate-500">verificando…</span>
        ) : ok && !recentError ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            <ShieldCheck className="size-3" /> IA ativa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle className="size-3" /> {ok ? 'Com falhas recentes' : 'IA desligada'}
          </span>
        )}
      </div>

      {status === 'offline' && (
        <p className="mt-3 text-sm text-slate-600">
          Esta versão está rodando sem o servidor da MIDFLOW, então os conteúdos vêm de modelos prontos (sem IA).
        </p>
      )}

      {status && status !== 'offline' && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Provedor / modelo de texto</dt>
            <dd className="font-semibold text-ink">{status.aiEnabled ? `${status.provider} · ${status.model}` : 'Não configurado'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Imagens com IA (botão "Gerar nova imagem IA")</dt>
            <dd className="font-semibold text-ink">
              {status.imageProvider === 'none'
                ? 'Desligado — usando fotos curadas'
                : `${status.imageProvider === 'cloudflare' ? 'Cloudflare Workers AI' : 'Google Gemini'} · ${status.imageModel}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Nota mínima de qualidade</dt>
            <dd className="font-semibold text-ink">{status.minQuality}/100 (abaixo disso a IA revisa o próprio texto)</dd>
          </div>
          {recentError && status.lastError && (
            <div className="sm:col-span-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
              Último erro: {status.lastError}
            </div>
          )}
          {status.imageLastError && (
            <div className="sm:col-span-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
              Último erro de imagem: {status.imageLastError} (as peças seguem com fotos curadas)
            </div>
          )}
          {!status.aiEnabled && (
            <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-line">
              Para ativar, o administrador define <code>GEMINI_API_KEY</code> no arquivo <code>.env</code> do servidor e reinicia.
              Enquanto isso, os conteúdos usam modelos prontos e aparecem marcados como "Modelo de reserva".
            </div>
          )}
        </dl>
      )}

      {result && (
        <div
          className={cx(
            'mt-4 rounded-xl p-3.5 text-xs font-medium ring-1',
            result.ok ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-red-50 text-red-900 ring-red-200',
          )}
        >
          {result.message}
        </div>
      )}

      <div className="mt-5 flex justify-end border-t border-line pt-4">
        <Button variant="secondary" size="sm" onClick={test} disabled={testing || status === 'offline'}>
          {testing ? 'Testando…' : 'Testar conexão'}
        </Button>
      </div>
    </Card>
  )
}
