import { Check, ChevronDown, CreditCard, Crown, Minus, QrCode } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, ChoiceGroup, cx, Dialog, Field, Input, toast, UsageMeter, useIsPhone } from '../../components/ui'
import { ManageSubscriptionButton } from '../../components/ManageSubscription'
import { manageSubscription, useCanManageSubscription } from '../../lib/subscription'
import { isBillingEnabled, startCheckout } from '../../lib/backend'
import { PLANS, planDef, type PlanDef } from '../../lib/data'
import { useApp } from '../../lib/store'
import type { PlanId } from '../../lib/types'

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

type Cell = string | boolean
const FEATURES: { label: string; values: (p: PlanDef) => Cell }[] = [
  { label: 'Conteúdos por mês', values: (p) => String(p.contents) },
  { label: 'Posts de feed', values: () => true },
  { label: 'Sequências de Stories', values: () => true },
  { label: 'Legendas e hashtags', values: () => true },
  { label: 'Histórico e download', values: () => true },
  { label: 'Variações por peça', values: (p) => (p.variations > 1 ? String(p.variations) : false) },
  { label: 'Perfis de negócio', values: (p) => String(p.profiles) },
  { label: 'Download em lote (.zip)', values: (p) => p.id === 'pro' || p.id === 'business' },
]

function CellValue({ v }: { v: Cell }) {
  if (v === true)
    return (
      <>
        <Check className="mx-auto size-4 text-brand-700" strokeWidth={3} aria-hidden />
        <span className="sr-only">Incluído</span>
      </>
    )
  if (v === false)
    return (
      <>
        <Minus className="mx-auto size-4 text-slate-400" aria-hidden />
        <span className="sr-only">Não incluído</span>
      </>
    )
  return <>{v}</>
}

export function Plans() {
  const plan = useApp((s) => s.plan)
  const used = useApp((s) => s.used)
  const setPlan = useApp((s) => s.setPlan)
  const refreshPlan = useApp((s) => s.refreshPlan)
  const accountId = useApp((s) => s.user?.id)
  // Real billing needs the public flag AND a signed-in backend account; otherwise the prototype simulation stays.
  const live = isBillingEnabled() && !!accountId
  const canManage = useCanManageSubscription()
  const [params, setParams] = useSearchParams()
  const phone = useIsPhone()
  const [period, setPeriod] = useState<'mensal' | 'anual'>('mensal')
  const annual = period === 'anual'
  const [checkout, setCheckout] = useState<PlanDef | null>(null)
  const [method, setMethod] = useState<'pix' | 'card'>('pix')
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(PLANS.findIndex((p) => p.highlight))
  const track = useRef<HTMLUListElement>(null)
  const cur = planDef(plan)
  const isFree = plan === 'free'
  // Sent here by the quota dialog (?motivo=limite): say why the person landed on this page.
  const hitLimit = params.get('motivo') === 'limite'
  const rank = (id: PlanId) => PLANS.findIndex((x) => x.id === id)
  const price = (p: PlanDef) => (annual ? Math.round(((p.price * 10) / 12) * 100) / 100 : p.price)

  // Phone carousel: center a card without moving the page vertically (scrollIntoView would).
  const scrollTo = (i: number, smooth = true) => {
    const el = track.current?.children[i] as HTMLElement | undefined
    if (!el || !track.current) return
    track.current.scrollTo({ left: el.offsetLeft - (track.current.clientWidth - el.clientWidth) / 2, behavior: smooth ? 'smooth' : 'auto' })
  }
  // Open on the recommended plan (Pro), like most pricing carousels.
  useEffect(() => {
    if (phone) scrollTo(PLANS.findIndex((p) => p.highlight), false)
  }, [phone])
  const onScroll = () => {
    const t = track.current
    if (!t) return
    const mid = t.scrollLeft + t.clientWidth / 2
    const kids = Array.from(t.children) as HTMLElement[]
    const dist = (el: HTMLElement) => Math.abs(el.offsetLeft + el.clientWidth / 2 - mid)
    setVisible(kids.reduce((best, el, i) => (dist(el) < dist(kids[best]) ? i : best), 0))
  }

  // Back from Stripe Checkout: the webhook may take a few seconds, so re-read the plan a few times.
  const returned = params.get('checkout')
  useEffect(() => {
    if (!returned) return
    setParams({}, { replace: true })
    if (returned === 'cancel') return void toast('Pagamento cancelado. Seu plano não foi alterado.')
    if (returned !== 'success') return
    toast('Pagamento recebido. Estamos liberando o seu plano.')
    const timers = [0, 3000, 8000, 15000].map((ms) => setTimeout(() => void refreshPlan(), ms))
    return () => timers.forEach(clearTimeout)
  }, [returned, setParams, refreshPlan])

  const confirm = async () => {
    if (!checkout) return
    if (live) {
      setBusy(true)
      const res = await startCheckout(checkout.id, annual ? 'year' : 'month')
      if (res.ok) return void window.location.assign(res.url) // leaves the app; keep the spinner until the page unloads
      setBusy(false)
      // 409: the account already has a subscription, so changes go through the Stripe portal instead of a new checkout.
      if (res.status === 409) {
        setCheckout(null)
        return void toast(res.error, 'info', { action: { label: 'Gerenciar assinatura', onClick: () => void manageSubscription() } })
      }
      return void toast(res.error)
    }
    setBusy(true)
    setTimeout(() => {
      setPlan(checkout.id)
      setBusy(false)
      setCheckout(null)
      toast(`Plano ${checkout.name} ativado (simulação)`)
    }, 900)
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 md:gap-8">
      <Card as="section" aria-labelledby="pl-current" className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700" aria-hidden>
            <Crown className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 id="pl-current" className="text-sm text-fg-subtle">
              Seu plano atual
            </h2>
            <p className="text-title-sm font-bold">{isFree ? `${cur.name} · sem custo` : `${cur.name} · R$ ${cur.price}/mês`}</p>
            {isFree && <p className="text-caption text-fg-subtle">Assine um plano para criar mais conteúdos por mês.</p>}
          </div>
        </div>
        <div className="w-full sm:w-72">
          <UsageMeter used={used} total={cur.contents} label="Conteúdos este mês" />
          <p className="mt-1.5 text-caption text-fg-subtle">Renova no dia 1º. Cada post ou sequência de Stories conta como 1 conteúdo.</p>
        </div>
        {canManage && <ManageSubscriptionButton variant="secondary" className="w-full sm:w-auto" />}
      </Card>

      <div className="flex justify-center">
        <ChoiceGroup
          legend="Período de cobrança"
          legendHidden
          variant="segmented"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'mensal', label: 'Mensal' },
            { value: 'anual', label: 'Anual · 2 meses grátis' },
          ]}
        />
      </div>

      {hitLimit && (
        <p role="status" className="rounded-2xl border border-amber-300 bg-warning-soft p-4 text-sm font-medium text-amber-950">
          {isFree
            ? 'Você usou os 5 conteúdos grátis deste mês. Assine um plano para continuar criando agora, ou espere a renovação no dia 1º.'
            : `Você chegou ao limite do plano ${cur.name} neste mês.`}
        </p>
      )}

      <section aria-labelledby="pl-options">
        <h2 id="pl-options" className="sr-only">
          Planos disponíveis
        </h2>
        <ul
          ref={track}
          onScroll={phone ? onScroll : undefined}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pt-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0"
        >
          {PLANS.map((p) => {
            const isCur = p.id === plan
            return (
              <li
                key={p.id}
                aria-label={p.highlight ? `${p.name}, mais escolhido` : p.name}
                className={cx(
                  'relative flex w-[84%] max-w-sm shrink-0 snap-center flex-col rounded-3xl border bg-white p-5 sm:p-7 md:w-auto md:max-w-none',
                  p.highlight ? 'border-brand-500 shadow-pop' : 'border-line shadow-card',
                )}
              >
                {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-brand-700 px-3 py-1 text-caption font-bold text-white">Mais escolhido</span>}
                <h3 className="text-title font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-fg-subtle">{p.tagline}</p>
                <p className="mt-5 flex items-end gap-1">
                  <span className="text-lg font-semibold">R$</span>
                  <span className="text-5xl font-extrabold tracking-tight tabular-nums">{brl(price(p))}</span>
                  <span className="mb-1.5 text-sm text-fg-subtle">/mês</span>
                </p>
                {annual && <p className="mt-1 text-caption text-fg-subtle">R$ {brl(p.price * 10)} cobrados por ano</p>}
                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={3} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={isCur ? 'secondary' : p.highlight ? 'primary' : 'dark'} disabled={isCur} className="mt-7 w-full" onClick={() => setCheckout(p)}>
                  {isCur ? 'Plano atual' : isFree ? `Assinar ${p.name}` : rank(p.id) > rank(plan) ? `Fazer upgrade para ${p.name}` : `Mudar para ${p.name}`}
                </Button>
              </li>
            )
          })}
        </ul>
        {/* Button alternative to swiping (WCAG 2.5.7). */}
        <div className="mt-2 flex justify-center gap-1 md:hidden">
          {PLANS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Ver plano ${p.name}`}
              aria-current={visible === i ? 'true' : undefined}
              className="grid size-11 place-items-center rounded-full"
            >
              <span className={cx('h-2 rounded-full transition-all', visible === i ? 'w-6 bg-brand-700' : 'w-2 bg-slate-400')} />
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="pl-compare">
        <h2 id="pl-compare" className="mb-3 text-title-sm font-bold">
          Compare os planos
        </h2>
        {/* Phones: one accordion per plan instead of a 4-column table. */}
        <div className="grid gap-2 md:hidden">
          {PLANS.map((p) => (
            <details key={p.id} open={p.highlight} className="group rounded-2xl border border-line bg-white">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                <span>
                  {p.name} <span className="font-normal text-fg-subtle">· R$ {brl(price(p))}/mês</span>
                </span>
                <ChevronDown className="size-5 text-fg-subtle transition group-open:rotate-180" aria-hidden />
              </summary>
              <dl className="border-t border-line px-4 py-2 text-sm">
                {FEATURES.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                    <dt className="text-fg-muted">{f.label}</dt>
                    <dd className="min-w-6 text-center font-semibold tabular-nums">
                      <CellValue v={f.values(p)} />
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
        <Card className="hidden overflow-hidden md:block">
          <table className="w-full text-sm">
            <caption className="sr-only">Recursos incluídos em cada plano</caption>
            <thead>
              <tr className="border-b border-line bg-slate-50 text-left">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Recurso
                </th>
                {PLANS.map((p) => (
                  <th key={p.id} scope="col" className="px-5 py-3 text-center font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {FEATURES.map((f) => (
                <tr key={f.label} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-3 text-left font-normal text-fg-muted">
                    {f.label}
                  </th>
                  {PLANS.map((p) => (
                    <td key={p.id} className="px-5 py-3 text-center font-medium">
                      <CellValue v={f.values(p)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-4 text-center text-caption text-fg-subtle">Cobrança transparente e flexível. Mude de plano ou cancele quando quiser sem multas ou taxas de fidelidade.</p>
      </section>

      <Dialog
        open={!!checkout}
        onClose={() => setCheckout(null)}
        title={checkout ? `Assinar o plano ${checkout.name}` : ''}
        footer={
          <Button size="lg" className="w-full" loading={busy} onClick={confirm}>
            {live ? 'Ir para o pagamento seguro' : 'Confirmar assinatura (simulação)'}
          </Button>
        }
      >
        {checkout && (
          <div className="grid gap-5 px-5 py-4 md:px-6">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <div>
                <p className="font-semibold">Plano {checkout.name}</p>
                <p className="text-caption text-fg-subtle">{annual ? 'Cobrança anual' : 'Cobrança mensal'}</p>
              </div>
              <p className="text-right text-lg font-bold tabular-nums">R$ {brl(annual ? checkout.price * 10 : checkout.price)}</p>
            </div>
            {live ? (
              <p className="rounded-xl border border-line p-4 text-sm text-fg-muted">
                Você será levado ao ambiente seguro da Stripe para informar os dados do cartão. A assinatura é renovada automaticamente e pode ser cancelada quando quiser.
              </p>
            ) : (
              <>
            <ChoiceGroup
              legend="Forma de pagamento"
              variant="segmented"
              value={method}
              onChange={setMethod}
              options={[
                { value: 'pix', label: 'Pix', icon: <QrCode className="size-4" aria-hidden /> },
                { value: 'card', label: 'Cartão', icon: <CreditCard className="size-4" aria-hidden /> },
              ]}
            />
            {method === 'pix' ? (
              <div className="flex items-center gap-4 rounded-xl border border-line p-4">
                <div className="grid size-24 shrink-0 grid-cols-6 gap-0.5 rounded-lg bg-white p-1.5 ring-1 ring-line" aria-hidden>
                  {Array.from({ length: 36 }).map((_, i) => (
                    <span key={i} className={cx('rounded-[1px]', [0, 1, 2, 5, 6, 8, 11, 13, 14, 17, 19, 22, 23, 24, 27, 30, 31, 33, 35].includes(i) ? 'bg-ink' : 'bg-transparent')} />
                  ))}
                </div>
                <p className="text-sm text-fg-muted">No produto final, o QR Code Pix aparece aqui e o plano é liberado assim que o pagamento é confirmado.</p>
              </div>
            ) : (
              <Field label="Número do cartão" hint="Campos desativados no protótipo.">
                <Input inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" disabled />
              </Field>
            )}
              </>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
