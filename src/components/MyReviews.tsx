import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { copyText } from '../lib/export'
import { fetchMyReviews, REVIEW_STATUS_LABEL, type MyReview, type ReviewOutput, type ReviewStatus } from '../lib/reviews'
import { cleanOutputs } from '../lib/staff'
import { Button, cx, Spinner, toast } from './ui'

const TONE: Record<ReviewStatus, string> = {
  pending: 'bg-slate-100 text-slate-800 ring-slate-300',
  in_progress: 'bg-warning-soft text-amber-950 ring-amber-300',
  resolved: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
}

const fmt = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const textOf = (o: ReviewOutput) => `${o.title}\n\n${o.caption}\n\n${o.hashtags.join(' ')}`.trim()

/** The customer's own review requests: status, and the revised texts once the team has answered. */
export function MyReviews() {
  const [items, setItems] = useState<MyReview[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    void fetchMyReviews().then((res) => {
      if (!live) return
      if (res.ok) setItems(res.items)
      else {
        setItems([])
        setError(res.message)
      }
    })
    return () => {
      live = false
    }
  }, [])

  if (items === null) return <Spinner label="Carregando seus pedidos" className="p-4" />
  if (error) return <p className="p-4 text-sm text-fg-subtle sm:p-5">{error}</p>
  if (items.length === 0)
    return <p className="p-4 text-sm text-fg-subtle sm:p-5">Você ainda não pediu nenhuma revisão. Na tela de criativos, use &ldquo;Solicitar revisão&rdquo; quando quiser que nossa equipe ajuste um conteúdo.</p>

  return (
    <ul className="divide-y divide-line">
      {items.map((r) => {
        const revised = cleanOutputs(r.revisedOutputs)
        return (
          <li key={r.id} className="grid gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {r.brandName || 'Pedido de revisão'} <span className="font-normal text-fg-muted">· {fmt(r.createdAt)}</span>
              </p>
              <span className={cx('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1', TONE[r.status] ?? TONE.pending)}>{REVIEW_STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
            {r.comment && <p className="text-sm whitespace-pre-line text-fg-muted">{r.comment}</p>}
            {r.status === 'resolved' && revised.length > 0 && (
              <details className="rounded-xl bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand-800">Ver textos revisados ({revised.length})</summary>
                <ol className="mt-3 grid gap-3">
                  {revised.map((o, i) => (
                    <li key={i} className="rounded-xl bg-white p-3 text-sm ring-1 ring-line">
                      <p className="text-xs font-semibold text-fg-muted">
                        {o.kind === 'story' ? 'Story' : 'Post'} {i + 1}
                      </p>
                      <p className="mt-0.5 font-semibold">{o.title}</p>
                      <p className="mt-1 whitespace-pre-line">{o.caption}</p>
                      <p className="mt-1 font-medium text-brand-800">{o.hashtags.join(' ')}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        onClick={async () => (await copyText(textOf(o))) && toast('Texto copiado')}
                      >
                        <Copy className="size-4" aria-hidden /> Copiar texto<span className="sr-only"> {i + 1}</span>
                      </Button>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
