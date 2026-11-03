import { Eye, UserCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Dialog, Field, Input, Select, Spinner, Textarea, toast } from '../../components/ui'
import { segmentDef } from '../../lib/data'
import { OUT_CAPTION_MAX, OUT_TAG_LEN, OUT_TAGS_MAX, OUT_TITLE_MAX, REVIEW_STATUS_LABEL, type ReviewOutput, type ReviewStatus } from '../../lib/reviews'
import { cleanOutputs, parsePayload, staffApi, type AdminReview, type Credential, type Me, type ReviewAuditEvent } from '../../lib/staff'
import { AI_KIND_LABEL, ENGINE_LABEL, fmtDateTime, STATUS_OPTIONS } from './format'
import { Notice, StatusPill, TableWrap, td, th } from './shared'

type Storage = 'supabase' | 'events'
type Draft = Omit<ReviewOutput, 'hashtags'> & { hashtags: string }

const statusTone = (s: ReviewStatus) => (s === 'resolved' ? 'ok' : s === 'in_progress' ? 'warn' : 'neutral')

/** Labels for the briefing fields shown to the team (anything else in the object is listed by its key). */
const BRIEFING_LABELS: Record<string, string> = {
  about: 'Sobre o negócio',
  segment: 'Segmento',
  segmentOther: 'Outro segmento',
  location: 'Cidade',
  objectives: 'Objetivos',
  audience: 'Público',
  topics: 'Assuntos',
  tones: 'Tom de voz',
  visualStyle: 'Estilo visual',
  colors: 'Cores',
  references: 'Referências',
  posts: 'Posts',
  stories: 'Stories',
}

const show = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v ?? ''))

export function ReviewsPanel({ cred, me }: { cred: Credential; me: Me }) {
  const [status, setStatus] = useState<ReviewStatus | ''>('')
  const [mine, setMine] = useState(false)
  const [items, setItems] = useState<AdminReview[] | null>(null)
  const [storage, setStorage] = useState<Storage>('supabase')
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const [tick, setTick] = useState(0)
  const reload = () => setTick((n) => n + 1)

  useEffect(() => {
    let live = true
    void staffApi.reviews(cred, { status }).then((res) => {
      if (!live) return
      if (res.ok) {
        setItems(res.data.items)
        setStorage(res.data.storage)
        setError('')
      } else {
        setItems([])
        setError(res.error)
      }
    })
    return () => {
      live = false
    }
  }, [cred, status, tick])

  // The server has no "assigned to me" filter: it is applied here, on the (max. 100) listed requests.
  const shown = useMemo(() => (items && mine && me.userId ? items.filter((r) => r.assignedTo === me.userId) : items), [items, mine, me.userId])
  const opened = items?.find((r) => r.id === openId) ?? null
  const canFilterMine = !!me.userId

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Status" id="rv-status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus | '')}>
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {canFilterMine && <Checkbox id="rv-mine" checked={mine} onChange={setMine} label="Atribuídas a mim" className="py-2" />}
        <Button variant="secondary" onClick={reload}>
          Atualizar lista
        </Button>
      </div>

      {storage === 'events' && (
        <Notice tone="warn">
          O banco de dados não está configurado: os pedidos ficam apenas no registro de eventos do servidor. Dá para ler, mas não dá para alterar status, atribuir ou enviar revisões.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {items === null ? (
        <Spinner label="Carregando revisões" />
      ) : shown && shown.length === 0 ? (
        !error && <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-10 text-center text-sm text-fg-subtle">Nenhum pedido de revisão com esses filtros.</p>
      ) : (
        <>
        {/* Phones: one card per request instead of a table that needs sideways scrolling (the table returns from 640 px). */}
        <ul aria-label="Pedidos de revisão" className="grid gap-3 sm:hidden">
          {(shown ?? []).map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words font-semibold text-ink">{r.brandName || '—'}</p>
                <StatusPill tone={statusTone(r.status)}>{REVIEW_STATUS_LABEL[r.status] ?? r.status}</StatusPill>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-fg-subtle">Recebido em</dt>
                <dd>{fmtDateTime(r.createdAt)}</dd>
                <dt className="text-fg-subtle">Segmento</dt>
                <dd>{r.segment ? segmentDef(r.segment).label : '—'}</dd>
                <dt className="text-fg-subtle">Origem</dt>
                <dd>
                  {r.engine ? (ENGINE_LABEL[r.engine] ?? r.engine) : '—'}
                  {r.aiErrorKind ? ` (${AI_KIND_LABEL[r.aiErrorKind] ?? r.aiErrorKind})` : ''}
                </dd>
                <dt className="text-fg-subtle">Responsável</dt>
                <dd>{r.assignedTo ? (r.assignedTo === me.userId ? 'Você' : 'Outra pessoa') : '—'}</dd>
              </dl>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => setOpenId(r.id)}>
                <Eye className="size-4" aria-hidden /> Abrir<span className="sr-only"> pedido de {r.brandName || 'cliente'}</span>
              </Button>
            </li>
          ))}
        </ul>
        <div className="hidden sm:block">
        <TableWrap label="Pedidos de revisão">
          <table className="w-full min-w-[720px] border-collapse">
            <caption className="sr-only">Pedidos de revisão enviados pelos clientes</caption>
            <thead className="border-b border-line bg-slate-50">
              <tr>
                <th scope="col" className={th}>
                  Recebido em
                </th>
                <th scope="col" className={th}>
                  Marca
                </th>
                <th scope="col" className={th}>
                  Segmento
                </th>
                <th scope="col" className={th}>
                  Origem
                </th>
                <th scope="col" className={th}>
                  Status
                </th>
                <th scope="col" className={th}>
                  Responsável
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(shown ?? []).map((r) => (
                <tr key={r.id}>
                  <td className={td}>{fmtDateTime(r.createdAt)}</td>
                  <th scope="row" className={`${td} text-left font-semibold`}>
                    {r.brandName || '—'}
                  </th>
                  <td className={td}>{r.segment ? segmentDef(r.segment).label : '—'}</td>
                  <td className={td}>
                    {r.engine ? (ENGINE_LABEL[r.engine] ?? r.engine) : '—'}
                    {r.aiErrorKind ? ` (${AI_KIND_LABEL[r.aiErrorKind] ?? r.aiErrorKind})` : ''}
                  </td>
                  <td className={td}>
                    <StatusPill tone={statusTone(r.status)}>{REVIEW_STATUS_LABEL[r.status] ?? r.status}</StatusPill>
                  </td>
                  <td className={td}>{r.assignedTo ? (r.assignedTo === me.userId ? 'Você' : 'Outra pessoa') : '—'}</td>
                  <td className={td}>
                    <Button size="sm" variant="secondary" onClick={() => setOpenId(r.id)}>
                      <Eye className="size-4" aria-hidden /> Abrir<span className="sr-only"> pedido de {r.brandName || 'cliente'}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        </div>
        </>
      )}

      <Dialog open={!!opened} onClose={() => setOpenId(null)} title="Pedido de revisão" description={opened ? `${opened.brandName || 'Cliente'} · ${fmtDateTime(opened.createdAt)}` : undefined} size="lg">
        {opened && <ReviewDetail key={opened.id} summary={opened} cred={cred} me={me} storage={storage} onChanged={reload} />}
      </Dialog>
    </div>
  )
}

const ACTION_LABEL: Record<string, string> = { status: 'Mudou o status', assign: 'Atribuiu o pedido', note: 'Atualizou a nota interna', revision: 'Enviou a revisão' }

/** Loads the full request (the queue list leaves out the briefing and the texts) and then shows the editor. */
function ReviewDetail({ summary, cred, me, storage, onChanged }: { summary: AdminReview; cred: Credential; me: Me; storage: Storage; onChanged: () => void }) {
  const [full, setFull] = useState<AdminReview | null>(null)
  const [events, setEvents] = useState<ReviewAuditEvent[]>([])
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    void staffApi.review(cred, summary.id).then((res) => {
      if (!live) return
      if (res.ok) {
        setFull(res.data.item)
        setEvents(res.data.events ?? [])
        setError('')
      } else setError(res.error)
    })
    return () => {
      live = false
    }
  }, [cred, summary.id, tick])

  if (error)
    return (
      <div className="grid gap-3 px-5 py-4 md:px-6">
        <Notice tone="error">{error}</Notice>
        <div>
          <Button variant="secondary" onClick={() => setTick((n) => n + 1)}>
            Tentar de novo
          </Button>
        </div>
      </div>
    )
  if (!full) return <Spinner label="Carregando o pedido" className="p-6" />
  return (
    <ReviewEditor
      key={`${full.id}-${full.updatedAt ?? ''}`}
      review={full}
      events={events}
      cred={cred}
      me={me}
      storage={storage}
      onChanged={() => {
        onChanged()
        setTick((n) => n + 1)
      }}
    />
  )
}

/** Checks a revision against the same bounds the server enforces, so the team sees a clear message instead of a generic 400. */
function revisionProblem(draft: Draft[]): string {
  for (let i = 0; i < draft.length; i++) {
    const o = draft[i]
    const n = i + 1
    if (!o.title.trim()) return `Texto ${n}: preencha o título.`
    if (o.title.length > OUT_TITLE_MAX) return `Texto ${n}: o título pode ter no máximo ${OUT_TITLE_MAX} caracteres.`
    if (o.caption.length > OUT_CAPTION_MAX) return `Texto ${n}: a legenda pode ter no máximo ${OUT_CAPTION_MAX} caracteres.`
    const tags = o.hashtags.split(/\s+/).filter(Boolean)
    if (tags.length > OUT_TAGS_MAX) return `Texto ${n}: use no máximo ${OUT_TAGS_MAX} hashtags.`
    if (tags.some((t) => t.length > OUT_TAG_LEN)) return `Texto ${n}: cada hashtag pode ter no máximo ${OUT_TAG_LEN} caracteres.`
  }
  return ''
}

function ReviewEditor({ review, events, cred, me, storage, onChanged }: { review: AdminReview; events: ReviewAuditEvent[]; cred: Credential; me: Me; storage: Storage; onChanged: () => void }) {
  const { briefing, outputs: original } = parsePayload(review)
  const readOnly = storage === 'events'
  const [status, setStatus] = useState<ReviewStatus>(review.status)
  const [note, setNote] = useState(review.adminNote ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const previous = cleanOutputs(review.revisedOutputs)
  // Hashtags are edited as plain text (separated by spaces) and split only when sent.
  const [draft, setDraft] = useState<Draft[]>((previous.length ? previous : original).map((o) => ({ ...o, hashtags: o.hashtags.join(' ') })))
  const assignedToMe = !!me.userId && review.assignedTo === me.userId

  const run = async (fn: () => ReturnType<typeof staffApi.patchReview>, okMsg: string) => {
    setBusy(true)
    setError('')
    const res = await fn()
    setBusy(false)
    if (res.ok) {
      toast(okMsg)
      onChanged()
    } else setError(res.error)
  }

  const setOut = (i: number, patch: Partial<Draft>) => setDraft((d) => d.map((o, k) => (k === i ? { ...o, ...patch } : o)))

  const sendRevision = async () => {
    const problem = revisionProblem(draft)
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    const res = await staffApi.sendRevision(
      cred,
      review.id,
      draft.map((o) => ({ ...o, title: o.title.trim(), hashtags: o.hashtags.split(/\s+/).filter(Boolean) })),
    )
    setBusy(false)
    if (res.ok) {
      toast('Revisão enviada ao cliente')
      onChanged()
    } else setError(res.error)
  }

  return (
    <div className="grid gap-5 px-5 py-4 md:px-6">
      {readOnly && <Notice tone="warn">Somente leitura: alterações exigem o banco de dados, que não está configurado neste ambiente.</Notice>}

      <section aria-labelledby="rd-ctx">
        <h3 id="rd-ctx" className="mb-2 text-sm font-bold">
          Pedido do cliente
        </h3>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-fg-muted">Origem do conteúdo</dt>
            <dd>
              {review.engine ? (ENGINE_LABEL[review.engine] ?? review.engine) : '—'}
              {review.aiErrorKind ? ` · ${AI_KIND_LABEL[review.aiErrorKind] ?? review.aiErrorKind}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-fg-muted">Contato</dt>
            <dd className="break-all">{review.contactEmail || 'Não informado'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold text-fg-muted">Comentário</dt>
            <dd className="whitespace-pre-line">{review.comment || 'Sem comentário.'}</dd>
          </div>
        </dl>
      </section>

      {briefing && (
        <section aria-labelledby="rd-brief">
          <h3 id="rd-brief" className="mb-2 text-sm font-bold">
            Briefing
          </h3>
          <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
            {Object.entries(briefing)
              .filter(([, v]) => show(v).trim() !== '')
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-semibold text-fg-muted">{BRIEFING_LABELS[k] ?? k}</dt>
                  <dd className="break-words whitespace-pre-line">{k === 'segment' ? segmentDef(String(v)).label : show(v)}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      <section aria-labelledby="rd-out">
        <h3 id="rd-out" className="mb-2 text-sm font-bold">
          Textos enviados pelo cliente
        </h3>
        {original.length === 0 ? (
          <p className="text-sm text-fg-subtle">Nenhum texto anexado.</p>
        ) : (
          <ol className="grid gap-2">
            {original.map((o, i) => (
              <li key={i} className="rounded-xl border border-line p-3 text-sm">
                <p className="text-xs font-semibold text-fg-muted">
                  {o.kind === 'story' ? 'Story' : 'Post'} {i + 1}
                </p>
                <p className="mt-0.5 font-semibold">{o.title}</p>
                <p className="mt-1 whitespace-pre-line">{o.caption}</p>
                <p className="mt-1 font-medium text-brand-800">{o.hashtags.join(' ')}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="rd-ctl" className="grid gap-3 border-t border-line pt-4">
        <h3 id="rd-ctl" className="text-sm font-bold">
          Acompanhamento
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status" id="rd-status">
            <Select value={status} disabled={readOnly || busy} onChange={(e) => setStatus(e.target.value as ReviewStatus)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            {me.userId ? (
              <Button
                variant="secondary"
                className="w-full"
                disabled={readOnly || busy || assignedToMe}
                onClick={() =>
                  run(
                    () => staffApi.patchReview(cred, review.id, { assignedTo: me.userId!, ...(review.status === 'pending' ? { status: 'in_progress' as const } : {}) }),
                    'Pedido atribuído a você',
                  )
                }
              >
                <UserCheck className="size-4" aria-hidden /> {assignedToMe ? 'Atribuído a você' : 'Assumir'}
              </Button>
            ) : (
              <p className="text-xs text-fg-subtle">Entre com a sua conta de equipe para assumir pedidos (o token de acesso não tem usuário).</p>
            )}
          </div>
        </div>
        <Field label="Nota interna" id="rd-note" hint="Visível só para a equipe.">
          <Textarea value={note} max={2000} rows={3} disabled={readOnly || busy} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div>
          <Button disabled={readOnly || busy} onClick={() => run(() => staffApi.patchReview(cred, review.id, { status, adminNote: note }), 'Pedido atualizado')}>
            Salvar status e nota
          </Button>
        </div>
      </section>

      <section aria-labelledby="rd-rev" className="grid gap-3 border-t border-line pt-4">
        <h3 id="rd-rev" className="text-sm font-bold">
          Versão revisada
        </h3>
        <p className="text-sm text-fg-subtle">Edite os textos abaixo. Ao enviar, o cliente vê a versão revisada e o pedido fica como concluído.</p>
        {draft.length === 0 ? (
          <p className="text-sm text-fg-subtle">Não há textos para revisar neste pedido.</p>
        ) : (
          <ol className="grid gap-3">
            {draft.map((o, i) => (
              <li key={i} className="grid gap-2 rounded-xl border border-line p-3">
                <p className="text-xs font-semibold text-fg-muted">
                  {o.kind === 'story' ? 'Story' : 'Post'} {i + 1}
                </p>
                <Field label="Título" id={`rd-t-${i}`} hint={`${o.title.length}/${OUT_TITLE_MAX}`}>
                  <Input value={o.title} maxLength={OUT_TITLE_MAX} disabled={readOnly || busy} onChange={(e) => setOut(i, { title: e.target.value })} />
                </Field>
                <Field label="Legenda" id={`rd-c-${i}`}>
                  <Textarea value={o.caption} max={OUT_CAPTION_MAX} rows={4} disabled={readOnly || busy} onChange={(e) => setOut(i, { caption: e.target.value })} />
                </Field>
                <Field label="Hashtags" id={`rd-h-${i}`} hint={`Separe por espaço. Até ${OUT_TAGS_MAX} hashtags.`}>
                  <Input value={o.hashtags} disabled={readOnly || busy} onChange={(e) => setOut(i, { hashtags: e.target.value })} />
                </Field>
              </li>
            ))}
          </ol>
        )}
        <div>
          <Button disabled={readOnly || draft.length === 0} loading={busy} onClick={() => void sendRevision()}>
            Enviar revisão
          </Button>
        </div>
      </section>

      {events.length > 0 && (
        <section aria-labelledby="rd-hist" className="grid gap-2 border-t border-line pt-4">
          <h3 id="rd-hist" className="text-sm font-bold">
            Histórico
          </h3>
          <ol className="grid gap-1.5 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2 text-fg-muted">
                <time dateTime={e.created_at} className="tabular-nums">
                  {fmtDateTime(e.created_at)}
                </time>
                <span>
                  {ACTION_LABEL[e.action] ?? e.action}
                  {e.to_status ? ` (${REVIEW_STATUS_LABEL[e.to_status as ReviewStatus] ?? e.to_status})` : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div role="alert">{error && <Notice tone="error">{error}</Notice>}</div>
    </div>
  )
}
