import { Check, CreditCard, Crown, Minus, QrCode } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, cx, Input, Label, Modal, toast } from '../../components/ui'
import { PLANS, planDef, type PlanDef } from '../../lib/data'
import { useApp } from '../../lib/store'

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

export function Plans() {
  const plan = useApp((s) => s.plan)
  const used = useApp((s) => s.used)
  const setPlan = useApp((s) => s.setPlan)
  const [annual, setAnnual] = useState(false)
  const [checkout, setCheckout] = useState<PlanDef | null>(null)
  const [method, setMethod] = useState<'pix' | 'card'>('pix')
  const [busy, setBusy] = useState(false)
  const cur = planDef(plan)
  const price = (p: PlanDef) => (annual ? Math.round(((p.price * 10) / 12) * 100) / 100 : p.price)

  return (
    <div className="mx-auto max-w-6xl">
      <Card className="flex flex-wrap items-center gap-5 p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Crown className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-500">Seu plano atual</div>
          <div className="text-xl font-bold">
            {cur.name} · R$ {cur.price}/mês
          </div>
        </div>
        <div className="w-full sm:w-72">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Conteúdos este mês</span>
            <b className="tabular-nums">
              {used} / {cur.contents}
            </b>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-mint" style={{ width: `${Math.min(100, (used / cur.contents) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Renova no dia 1º. Cada post ou sequência de Stories conta como 1 conteúdo.</p>
        </div>
      </Card>

      <div className="mt-8 flex justify-center">
        <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-line">
          {[false, true].map((a) => (
            <button key={String(a)} onClick={() => setAnnual(a)} className={cx('h-9 rounded-full px-5 text-sm font-semibold transition', annual === a ? 'bg-ink text-white' : 'text-slate-600')}>
              {a ? 'Anual · 2 meses grátis' : 'Mensal'}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger mt-8 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCur = p.id === plan
          return (
            <div key={p.id} className={cx('lift relative flex flex-col rounded-3xl border bg-white p-6 sm:p-7', p.highlight ? 'border-brand-500 shadow-pop' : 'border-line shadow-card')}>
              {p.highlight && <span className="absolute -top-3 left-7 rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white">Mais escolhido</span>}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <div className="mt-5 flex items-end gap-1">
                <span className="text-lg font-semibold">R$</span>
                <span className="text-5xl font-extrabold tracking-tight tabular-nums">{brl(price(p))}</span>
                <span className="mb-1.5 text-sm text-slate-500">/mês</span>
              </div>
              {annual && <p className="mt-1 text-xs text-slate-500">R$ {brl(p.price * 10)} cobrados por ano</p>}
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-600" strokeWidth={3} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={isCur ? 'secondary' : p.highlight ? 'primary' : 'dark'} disabled={isCur} className="mt-7 w-full" onClick={() => setCheckout(p)}>
                {isCur ? 'Plano atual' : PLANS.findIndex((x) => x.id === p.id) > PLANS.findIndex((x) => x.id === plan) ? `Fazer upgrade para ${p.name}` : `Mudar para ${p.name}`}
              </Button>
            </div>
          )
        })}
      </div>

      <Card className="mt-8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-left">
                <th className="px-3 py-3 sm:px-5 font-semibold">Recurso</th>
                {PLANS.map((p) => (
                  <th key={p.id} className="px-3 py-3 sm:px-5 text-center font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[
                ['Conteúdos por mês', ...PLANS.map((p) => String(p.contents))],
                ['Posts de feed', '✓', '✓', '✓'],
                ['Sequências de Stories', '✓', '✓', '✓'],
                ['Legendas e hashtags', '✓', '✓', '✓'],
                ['Histórico e download', '✓', '✓', '✓'],
                ['Variações por peça', ...PLANS.map((p) => (p.variations > 1 ? String(p.variations) : '—'))],
                ['Perfis de negócio', ...PLANS.map((p) => String(p.profiles))],
                ['Download em lote (.zip)', '—', '✓', '✓'],
              ].map(([label, ...vals]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 sm:px-5 text-slate-600">{label}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="px-3 py-3 sm:px-5 text-center font-medium">
                      {v === '✓' ? <Check className="mx-auto size-4 text-brand-600" strokeWidth={3} /> : v === '—' ? <Minus className="mx-auto size-4 text-slate-300" /> : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-4 text-center text-xs text-slate-400">Valores e limites em validação. Protótipo: nenhuma cobrança é feita.</p>

      <Modal open={!!checkout} onClose={() => setCheckout(null)} title={checkout ? `Assinar o plano ${checkout.name}` : ''}>
        {checkout && (
          <div className="p-6">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <div>
                <div className="font-semibold">Plano {checkout.name}</div>
                <div className="text-xs text-slate-500">{annual ? 'Cobrança anual' : 'Cobrança mensal'}</div>
              </div>
              <div className="text-right text-lg font-bold tabular-nums">R$ {brl(annual ? checkout.price * 10 : checkout.price)}</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                ['pix', 'Pix', QrCode],
                ['card', 'Cartão', CreditCard],
              ].map(([id, label, I]) => {
                const Icon = I as typeof QrCode
                return (
                  <button key={id as string} onClick={() => setMethod(id as 'pix' | 'card')} className={cx('flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold', method === id ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line')}>
                    <Icon className="size-4" /> {label as string}
                  </button>
                )
              })}
            </div>
            {method === 'pix' ? (
              <div className="mt-5 flex items-center gap-4 rounded-xl border border-line p-4">
                <div className="grid size-24 shrink-0 grid-cols-6 gap-0.5 rounded-lg bg-white p-1.5 ring-1 ring-line" aria-hidden>
                  {Array.from({ length: 36 }).map((_, i) => (
                    <span key={i} className={cx('rounded-[1px]', [0, 1, 2, 5, 6, 8, 11, 13, 14, 17, 19, 22, 23, 24, 27, 30, 31, 33, 35].includes(i) ? 'bg-ink' : 'bg-transparent')} />
                  ))}
                </div>
                <p className="text-sm text-slate-600">No produto final, o QR Code Pix aparece aqui e o plano é liberado assim que o pagamento é confirmado.</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <div>
                  <Label htmlFor="cc-num">Número do cartão</Label>
                  <Input id="cc-num" placeholder="0000 0000 0000 0000" disabled />
                </div>
                <p className="text-xs text-slate-500">Campos desativados no protótipo.</p>
              </div>
            )}
            <Button
              size="lg"
              className="mt-6 w-full"
              loading={busy}
              onClick={() => {
                setBusy(true)
                setTimeout(() => {
                  setPlan(checkout.id)
                  setBusy(false)
                  setCheckout(null)
                  toast(`Plano ${checkout.name} ativado (simulação)`)
                }, 900)
              }}
            >
              Confirmar assinatura (simulação)
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
