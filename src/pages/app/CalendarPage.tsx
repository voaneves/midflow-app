import { CalendarHeart, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, Download, FolderOpen, MoveRight, Plus, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../components/creative/Creative'
import { exportCreatives, jobFor, useLook } from '../../components/creative/helpers'
import { SocialPublishModal } from '../../components/creative/SocialPublishModal'
import { Badge, Button, Card, ChoiceGroup, cx, Dialog, Field, IconButton, Input, toast, useIsPhone } from '../../components/ui'
import { copyText } from '../../lib/export'
import { getSocialTips } from '../../lib/social'
import { useApp } from '../../lib/store'
import type { ScheduledPost, ScheduledStatus } from '../../lib/types'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function specialDates(month: number) {
  const list: { day: number; label: string }[] = []
  if (month === 2) list.push({ day: 8, label: 'Dia da Mulher' })
  if (month === 4) list.push({ day: 11, label: 'Dia das Mães' })
  if (month === 5) list.push({ day: 12, label: 'Dia dos Namorados' })
  if (month === 7) list.push({ day: 10, label: 'Dia dos Pais' })
  if (month === 8) list.push({ day: 15, label: 'Dia do Cliente' })
  if (month === 9) list.push({ day: 5, label: 'Dia do Empreendedor' }, { day: 12, label: 'Dia das Crianças' })
  if (month === 10) list.push({ day: 27, label: 'Black Friday' })
  if (month === 11) list.push({ day: 25, label: 'Natal' })
  return list
}

export function CalendarPage() {
  const nav = useNavigate()
  const brand = useApp((s) => s.brand)
  const library = useApp((s) => s.library)
  const scheduledPosts = useApp((s) => s.scheduledPosts)
  const scheduleCreative = useApp((s) => s.scheduleCreative)
  const markPostPublished = useApp((s) => s.markPostPublished)
  const removeScheduledPost = useApp((s) => s.removeScheduledPost)
  const updateScheduledPost = useApp((s) => s.updateScheduledPost)
  const baseLook = useLook()
  const phone = useIsPhone()

  const [today] = useState(() => new Date())
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [view, setView] = useState<'agenda' | 'mes'>(phone ? 'agenda' : 'mes')
  const [filterFormat, setFilterFormat] = useState<'all' | 'post' | 'story'>('all')
  const [filterStatus, setFilterStatus] = useState<ScheduledStatus | 'all'>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [publishingPost, setPublishingPost] = useState<ScheduledPost | null>(null)
  const [addDay, setAddDay] = useState<number | null>(null)
  const [selectedLibId, setSelectedLibId] = useState('')
  const [scheduleTime, setScheduleTime] = useState('11:30')
  const [moveTo, setMoveTo] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const tips = getSocialTips(brand.segment)
  const monthLabel = cap(cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
  const specials = useMemo(() => specialDates(month), [month])
  const activePost = scheduledPosts.find((p) => p.id === activeId) ?? null

  const postsByDay = useMemo(() => {
    const map: Record<number, ScheduledPost[]> = {}
    scheduledPosts.forEach((p) => {
      const [y, m, d] = p.date.split('-').map(Number)
      if (y !== year || m !== month + 1) return
      if (filterFormat !== 'all' && p.creative.kind !== filterFormat) return
      if (filterStatus !== 'all' && p.status !== filterStatus) return
      ;(map[d] ??= []).push(p)
    })
    Object.values(map).forEach((l) => l.sort((a, b) => a.time.localeCompare(b.time)))
    return map
  }, [scheduledPosts, year, month, filterFormat, filterStatus])

  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const dayName = (d: number) => cap(new Date(year, month, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))

  const scheduleFromLibrary = () => {
    if (!addDay) return
    const item = library.find((l) => l.id === selectedLibId) || library[0]
    if (!item) return
    scheduleCreative({ creative: item.creative, date: iso(year, month, addDay), time: scheduleTime, status: 'agendado', themeLabel: item.themeLabel, style: item.style, palette: item.palette, format: item.postFormat })
    toast(`Agendado para ${dayName(addDay)}, às ${scheduleTime}`)
    setAddDay(null)
  }
  const move = (id: string, date: string) => {
    updateScheduledPost(id, { date })
    const [y, m, d] = date.split('-').map(Number)
    toast(`Movido para ${new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`)
  }

  // Plain render function (not a nested component) so re-renders during drag keep the same DOM node.
  const postChip = (sp: ScheduledPost, compact?: boolean) => (
    <button
      type="button"
      draggable={!phone}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', sp.id)
        setDragging(sp.id)
      }}
      onDragEnd={() => setDragging(null)}
      onClick={() => {
        setActiveId(sp.id)
        setMoveTo(sp.date)
      }}
      className={cx(
        'flex w-full items-center gap-2 rounded-lg border text-left shadow-sm transition hover:border-brand-400',
        compact ? 'min-h-9 p-1' : 'min-h-14 p-2',
        sp.status === 'publicado' ? 'border-emerald-300 bg-emerald-50' : 'border-brand-200 bg-white',
        dragging === sp.id && 'opacity-50',
      )}
    >
      <span className={cx('shrink-0 overflow-hidden rounded', compact ? 'size-7' : 'size-10')} aria-hidden>
        <Creative c={sp.creative} style={sp.style} palette={sp.palette} format={sp.postFormat} brand={{ name: brand.name, handle: brand.handle }} chrome={false} label="" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-xs font-bold">{sp.creative.headline}</span>
        <span className="block text-xs text-fg-subtle">
          {sp.time} · {sp.creative.kind === 'story' ? 'Story' : 'Feed'}
          {sp.status === 'publicado' && ' · publicado'}
        </span>
      </span>
    </button>
  )

  const agendaDays = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((d) => postsByDay[d]?.length || specials.some((s) => s.day === d) || isToday(d))

  return (
    <div className="mx-auto grid max-w-[1440px] gap-4 lg:gap-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton variant="secondary" label="Mês anterior" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="size-5" aria-hidden />
          </IconButton>
          <h2 className="min-w-40 px-2 text-center text-title-sm font-bold" aria-live="polite">
            {monthLabel}
          </h2>
          <IconButton variant="secondary" label="Próximo mês" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight className="size-5" aria-hidden />
          </IconButton>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Hoje
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <ChoiceGroup
            legend="Visualização"
            legendHidden
            variant="segmented"
            value={view}
            onChange={setView}
            options={[
              { value: 'agenda', label: 'Agenda' },
              { value: 'mes', label: 'Mês' },
            ]}
          />
          <div className="hidden md:block">
            <Button onClick={() => nav('/app/criar/1')}>
              <Plus className="size-4" aria-hidden /> Criar conteúdo
            </Button>
          </div>
        </div>
      </div>

      {/* filters */}
      <Card className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <ChoiceGroup
            legend="Formato"
            legendHidden
            variant="segmented"
            value={filterFormat}
            onChange={setFilterFormat}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'post', label: 'Feed' },
              { value: 'story', label: 'Stories' },
            ]}
          />
          <ChoiceGroup
            legend="Status"
            legendHidden
            variant="segmented"
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'agendado', label: 'Agendados' },
              { value: 'publicado', label: 'Publicados' },
            ]}
          />
        </div>
        <p className="flex items-center gap-2 text-sm text-slate-700">
          <Clock className="size-4 text-brand-700" aria-hidden /> Melhores horários: <b>{tips.bestHours.join(' · ')}</b>
        </p>
      </Card>

      {view === 'agenda' ? (
        <section aria-label={`Agenda de ${monthLabel}`}>
          {agendaDays.length === 0 && <p className="text-sm text-fg-subtle">Nada agendado neste mês.</p>}
          <ol className="grid gap-3">
            {agendaDays.map((d) => {
              const posts = postsByDay[d] ?? []
              const sd = specials.find((s) => s.day === d)
              return (
                <li key={d}>
                  <Card className={cx('flex gap-3 p-3 sm:p-4', isToday(d) && 'ring-2 ring-brand-500')}>
                    <div className={cx('grid w-14 shrink-0 place-items-center content-center rounded-xl py-2 text-center', isToday(d) ? 'bg-brand-700 text-white' : 'bg-slate-100')} aria-hidden>
                      <span className="text-xs font-semibold uppercase">{WEEKDAYS[new Date(year, month, d).getDay()].slice(0, 3)}</span>
                      <span className="text-title font-extrabold">{d}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold">
                        {dayName(d)}
                        {isToday(d) && ' · hoje'}
                      </h3>
                      {sd && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-warning-soft px-2 py-0.5 text-xs font-bold text-amber-950">
                          <CalendarHeart className="size-3.5" aria-hidden /> {sd.label}
                        </p>
                      )}
                      {posts.length > 0 && (
                        <ul className="mt-2 grid gap-2">
                          {posts.map((sp) => (
                            <li key={sp.id}>
                              {postChip(sp)}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => setAddDay(d)}>
                        <Plus className="size-4" aria-hidden /> Agendar neste dia
                      </Button>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ol>
        </section>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse" aria-label={`Calendário de ${monthLabel}`}>
            <thead>
              <tr className="border-b border-line bg-slate-50 text-xs font-bold text-slate-700">
                {WEEKDAYS.map((d) => (
                  <th key={d} scope="col" className="py-2.5">
                    <abbr title={d} className="no-underline xl:hidden">
                      {d.slice(0, 3)}
                    </abbr>
                    <span className="hidden xl:inline">{d}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil((firstDayIndex + daysInMonth) / 7) }).map((_, w) => (
                <tr key={w}>
                  {Array.from({ length: 7 }).map((__, k) => {
                    const d = w * 7 + k - firstDayIndex + 1
                    if (d < 1 || d > daysInMonth) return <td key={k} className="h-32 border-r border-b border-line bg-slate-50/50" />
                    const posts = postsByDay[d] ?? []
                    const sd = specials.find((s) => s.day === d)
                    return (
                      <td
                        key={k}
                        className={cx('h-32 border-r border-b border-line p-1.5 align-top', isToday(d) && 'bg-brand-50/50', dragging && 'hover:bg-brand-50')}
                        onDragOver={(e) => dragging && e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const id = e.dataTransfer.getData('text/plain')
                          if (id) move(id, iso(year, month, d))
                          setDragging(null)
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cx('grid size-7 place-items-center rounded-full text-xs font-bold', isToday(d) ? 'bg-brand-700 text-white' : 'text-slate-800')}>
                            {d}
                            {isToday(d) && <span className="sr-only"> (hoje)</span>}
                          </span>
                          <IconButton size="sm" label={`Agendar em ${dayName(d)}`} onClick={() => setAddDay(d)} className="size-9 text-slate-600">
                            <Plus className="size-4" aria-hidden />
                          </IconButton>
                        </div>
                        {sd && (
                          <p className="mt-0.5 flex items-center gap-1 truncate rounded border border-amber-300 bg-warning-soft px-1.5 py-0.5 text-xs font-bold text-amber-950">
                            <CalendarHeart className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{sd.label}</span>
                          </p>
                        )}
                        <ul className="mt-1 space-y-1">
                          {posts.map((sp) => (
                            <li key={sp.id}>
                              {postChip(sp, true)}
                            </li>
                          ))}
                        </ul>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-fg-subtle">Dica: arraste um post para outro dia, ou abra o post e use “Mover para…”.</p>
        </Card>
      )}

      {specials.length > 0 && (
        <Card as="section" aria-labelledby="cal-special" className="p-4 sm:p-5">
          <h2 id="cal-special" className="flex items-center gap-2 font-bold">
            <CalendarHeart className="size-5 text-amber-600" aria-hidden /> Datas especiais deste mês
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {specials.map((sd) => (
              <li key={sd.day} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-slate-50 p-3">
                <div>
                  <div className="text-sm font-bold">{sd.label}</div>
                  <div className="text-xs text-fg-subtle">Dia {sd.day}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => nav('/app/criar/1')}>
                  Criar post<span className="sr-only"> para {sd.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* post detail */}
      <Dialog
        open={!!activePost}
        onClose={() => setActiveId(null)}
        size="xl"
        title={activePost ? `${activePost.creative.kind === 'story' ? 'Story' : 'Post de feed'} agendado` : ''}
        headerAside={activePost && <Badge className={activePost.status === 'publicado' ? 'bg-emerald-100 text-emerald-900' : ''}>{activePost.status === 'publicado' ? 'Publicado' : 'Agendado'}</Badge>}
      >
        {activePost && (
          <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,340px)_1fr] md:p-6">
            <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl shadow-card">
              <Creative c={activePost.creative} style={activePost.style} palette={activePost.palette} format={activePost.postFormat} brand={baseLook.brand} chrome={false} />
            </div>
            <div className="grid content-start gap-4">
              <dl className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line pb-3 text-sm">
                <div>
                  <dt className="inline font-semibold">Quando: </dt>
                  <dd className="inline">
                    {activePost.date.split('-').reverse().join('/')} às {activePost.time}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Tema: </dt>
                  <dd className="inline">{activePost.themeLabel}</dd>
                </div>
              </dl>
              <div>
                <h3 className="text-sm font-bold">Legenda</h3>
                <p className="mt-1.5 max-h-44 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-line text-slate-800 scroll-thin">{activePost.creative.caption}</p>
                <p className="mt-2 text-sm font-semibold text-brand-800">{activePost.creative.hashtags.join(' ')}</p>
              </div>
              {activePost.notes && <p className="rounded-xl border border-line bg-slate-50 p-3 text-sm text-slate-700"><b>Nota:</b> {activePost.notes}</p>}
              <div className="flex items-end gap-2">
                <Field label="Mover para…" className="flex-1">
                  <Input type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />
                </Field>
                <Button variant="secondary" disabled={!moveTo || moveTo === activePost.date} onClick={() => move(activePost.id, moveTo)}>
                  <MoveRight className="size-4" aria-hidden /> Mover
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button className="col-span-2" onClick={() => (setPublishingPost(activePost), setActiveId(null))}>
                  <Send className="size-4" aria-hidden /> Auxiliar postagem
                </Button>
                <Button variant="secondary" onClick={async () => (await copyText(`${activePost.creative.caption}\n\n${activePost.creative.hashtags.join(' ')}`)) && toast('Legenda copiada')}>
                  <Copy className="size-4" aria-hidden /> Copiar legenda
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => exportCreatives([jobFor(activePost.creative, { palette: activePost.palette, style: activePost.style, format: activePost.postFormat, brand: baseLook.brand }, 0, `${activePost.themeLabel}-${activePost.creative.kind}`)])}
                >
                  <Download className="size-4" aria-hidden /> Baixar PNG
                </Button>
                {activePost.status !== 'publicado' && (
                  <Button variant="soft" onClick={() => (markPostPublished(activePost.id), toast('Marcado como publicado'))}>
                    <CheckCircle2 className="size-4" aria-hidden /> Marcar como publicado
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    const before = useApp.getState().scheduledPosts
                    removeScheduledPost(activePost.id)
                    setActiveId(null)
                    toast('Removido do calendário', 'ok', { action: { label: 'Desfazer', onClick: () => useApp.setState({ scheduledPosts: before }) } })
                  }}
                >
                  <Trash2 className="size-4" aria-hidden /> Excluir
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* schedule on a day */}
      <Dialog
        open={addDay !== null}
        onClose={() => setAddDay(null)}
        title="Agendar conteúdo"
        description={addDay ? dayName(addDay) : undefined}
        footer={
          library.length ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setAddDay(null)}>
                Cancelar
              </Button>
              <Button onClick={scheduleFromLibrary}>Agendar</Button>
            </div>
          ) : undefined
        }
      >
        <div className="grid gap-4 px-5 py-4 md:px-6">
          {library.length ? (
            <>
              <ChoiceGroup
                legend="Escolha um criativo da Biblioteca"
                variant="media"
                className="grid max-h-[40dvh] grid-cols-3 gap-2 overflow-y-auto p-1 scroll-thin"
                value={selectedLibId || library[0].id}
                onChange={setSelectedLibId}
                options={library.map((l) => ({
                  value: l.id,
                  label: <span className="line-clamp-1 text-xs">{l.themeLabel}</span>,
                  media: <Creative c={l.creative} style={l.style} palette={l.palette} format={l.postFormat} brand={baseLook.brand} chrome={false} label="" />,
                }))}
              />
              <div className="grid grid-cols-2 items-end gap-3">
                <Field label="Horário">
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </Field>
                <Button variant="soft" onClick={() => setScheduleTime(tips.bestHours[0] || '11:30')}>
                  Usar {tips.bestHours[0] || '11:30'} (sugerido)
                </Button>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-sm text-fg-subtle">
              <FolderOpen className="mx-auto size-8 text-slate-500" aria-hidden />
              <p className="mt-2">Sua biblioteca está vazia. Salve criativos para agendá-los.</p>
              <Button size="sm" className="mt-3" onClick={() => nav('/app/criar/1')}>
                Criar conteúdo agora
              </Button>
            </div>
          )}
        </div>
      </Dialog>

      {publishingPost && (
        <SocialPublishModal
          open
          onClose={() => setPublishingPost(null)}
          creative={publishingPost.creative}
          look={{ palette: publishingPost.palette, style: publishingPost.style, format: publishingPost.postFormat, brand: baseLook.brand }}
          themeLabel={publishingPost.themeLabel}
        />
      )}
    </div>
  )
}
