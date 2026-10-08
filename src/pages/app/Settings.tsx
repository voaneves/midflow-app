import { RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, Label, Modal, toast, Toggle } from '../../components/ui'
import { useApp } from '../../lib/store'

export function Settings() {
  const nav = useNavigate()
  const user = useApp((s) => s.user)
  const login = useApp((s) => s.login)
  const loadDemo = useApp((s) => s.loadDemo)
  const resetCreate = useApp((s) => s.resetCreate)
  const [n, setN] = useState({ semanal: true, novidades: true, datas: false })
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Card className="p-6">
        <h2 className="text-lg font-bold">Conta</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="st-name">Nome</Label>
            <Input id="st-name" value={user?.name ?? ''} onChange={(e) => login({ name: e.target.value, email: user?.email ?? '' })} />
          </div>
          <div>
            <Label htmlFor="st-email">E-mail</Label>
            <Input id="st-email" type="email" value={user?.email ?? ''} onChange={(e) => login({ name: user?.name ?? '', email: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold">Notificações</h2>
        <div className="mt-5 grid gap-4">
          {[
            ['semanal', 'Lembrete semanal para criar conteúdo'],
            ['novidades', 'Novidades da MIDFLOW'],
            ['datas', 'Avisos de datas comemorativas do meu segmento'],
          ].map(([k, l]) => (
            <Toggle key={k} on={n[k as keyof typeof n]} onChange={(v) => setN({ ...n, [k]: v })} label={<span className="font-medium">{l}</span>} />
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold">Dados do protótipo</h2>
        <p className="mt-1 text-sm text-slate-500">Tudo fica salvo apenas neste navegador. Use estas opções para recomeçar um teste com outro negócio.</p>
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
            <Sparkles className="size-4" /> Restaurar demonstração
          </Button>
        </div>
      </Card>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Restaurar demonstração?">
        <div className="p-6">
          <p className="text-sm text-slate-600">A marca, o briefing, as gerações e a biblioteca voltam para o exemplo do Studio Aurora. O que você criou será apagado deste navegador.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                loadDemo()
                setConfirm(false)
                toast('Demonstração restaurada')
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
