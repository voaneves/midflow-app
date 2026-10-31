import { useState, useMemo } from 'react'
import {
  CalendarDays,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Filter,
  FolderOpen,
  Plus,
  Send,
  Trash2,
  CheckCircle2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../components/creative/Creative'
import { exportCreatives, jobFor, useLook } from '../../components/creative/parts'
import { SocialPublishModal } from '../../components/creative/SocialPublishModal'
import { Badge, Button, Card, cx, Modal, toast } from '../../components/ui'
import { copyText } from '../../lib/export'
import { getSocialTips } from '../../lib/social'
import { useApp } from '../../lib/store'
import type { ScheduledPost, ScheduledStatus } from '../../lib/types'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export function CalendarPage() {
  const nav = useNavigate()
  const brand = useApp((s) => s.brand)
  const library = useApp((s) => s.library)
  const scheduledPosts = useApp((s) => s.scheduledPosts)
  const scheduleCreative = useApp((s) => s.scheduleCreative)
  const markPostPublished = useApp((s) => s.markPostPublished)
  const removeScheduledPost = useApp((s) => s.removeScheduledPost)
  const baseLook = useLook()

  const today = useMemo(() => new Date(), [])
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [filterFormat, setFilterFormat] = useState<'all' | 'post' | 'story'>('all')
  const [filterStatus, setFilterStatus] = useState<ScheduledStatus | 'all'>('all')

  const [activePost, setActivePost] = useState<ScheduledPost | null>(null)
  const [publishingPost, setPublishingPost] = useState<ScheduledPost | null>(null)
  const [addDay, setAddDay] = useState<number | null>(null)
  const [selectedLibId, setSelectedLibId] = useState<string>('')
  const [scheduleTime, setScheduleTime] = useState('11:30')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayIndex = new Date(year, month, 1).getDay()

  const tips = getSocialTips(brand.segment)

  const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Datas comemorativas do mês
  const specialDatesInMonth = useMemo(() => {
    const list: { day: number; label: string }[] = []
    if (month === 2) list.push({ day: 8, label: 'Dia da Mulher' })
    if (month === 4) list.push({ day: 11, label: 'Dia das Mães' })
    if (month === 5) list.push({ day: 12, label: 'Dia dos Namorados' })
    if (month === 7) list.push({ day: 10, label: 'Dia dos Pais' })
    if (month === 8) list.push({ day: 15, label: 'Dia do Cliente' })
    if (month === 9) {
      list.push({ day: 5, label: 'Dia do Empreendedor' })
      list.push({ day: 12, label: 'Dia das Crianças' })
    }
    if (month === 10) list.push({ day: 27, label: 'Black Friday' })
    if (month === 11) list.push({ day: 25, label: 'Natal' })
    return list
  }, [month])

  const postsByDay = useMemo(() => {
    const map: Record<number, ScheduledPost[]> = {}
    scheduledPosts.forEach((p) => {
      const [y, m, d] = p.date.split('-').map(Number)
      if (y === year && m === month + 1) {
        if (!map[d]) map[d] = []
        if (filterFormat !== 'all' && p.creative.kind !== filterFormat) return
        if (filterStatus !== 'all' && p.status !== filterStatus) return
        map[d].push(p)
      }
    })
    return map
  }, [scheduledPosts, year, month, filterFormat, filterStatus])

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))

  const handleScheduleFromLibrary = () => {
    if (!addDay) return
    const item = library.find((l) => l.id === selectedLibId) || library[0]
    if (!item) {
      toast('Salve conteúdos na Biblioteca para agendar no calendário', 'info')
      setAddDay(null)
      return
    }
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(addDay).padStart(2, '0')}`
    scheduleCreative({
      creative: item.creative,
      date: dStr,
      time: scheduleTime,
      status: 'agendado',
      themeLabel: item.themeLabel,
      style: item.style,
      palette: item.palette,
      format: item.postFormat,
    })
    toast(`Post agendado para o dia ${addDay} com sucesso!`)
    setAddDay(null)
  }

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      {/* Topo do Calendário */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <CalendarDays className="size-6" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-ink sm:text-2xl capitalize">{monthLabel}</h2>
            <p className="text-xs text-slate-500">
              Calendário editorial de postagens para <b>{brand.name}</b>
            </p>
          </div>
        </div>

        {/* Controles de Navegação */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-line bg-white shadow-sm">
            <button
              type="button"
              onClick={prevMonth}
              className="grid size-9 place-items-center rounded-l-xl text-slate-600 hover:bg-slate-50"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-3 text-xs font-semibold text-slate-700 hover:text-brand-800"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="grid size-9 place-items-center rounded-r-xl text-slate-600 hover:bg-slate-50"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <Button onClick={() => nav('/app/criar/1')}>
            <Plus className="size-4" /> Criar novo conteúdo
          </Button>
        </div>
      </div>

      {/* Barra de Filtros & Recomendações */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Filter className="size-3.5" /> Filtros:
          </span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
            {(['all', 'post', 'story'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterFormat(f)}
                className={cx(
                  'rounded-md px-2.5 py-1 transition',
                  filterFormat === f ? 'bg-white font-bold text-ink shadow-sm' : 'text-slate-600',
                )}
              >
                {f === 'all' ? 'Todos' : f === 'post' ? 'Feed' : 'Stories'}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
            {(['all', 'agendado', 'publicado'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={cx(
                  'rounded-md px-2.5 py-1 transition',
                  filterStatus === s ? 'bg-white font-bold text-ink shadow-sm' : 'text-slate-600',
                )}
              >
                {s === 'all' ? 'Todos os Status' : s === 'agendado' ? 'Agendados' : 'Publicados'}
              </button>
            ))}
          </div>
        </div>

        {/* Dica de horários */}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Clock className="size-3.5 text-brand-600" />
          <span>Melhores horários do seu segmento:</span>
          <b>{tips.bestHours.join(' · ')}</b>
        </div>
      </Card>

      {/* Grade do Calendário */}
      <Card className="overflow-hidden shadow-card">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b border-line bg-slate-50 text-center text-xs font-bold text-slate-600">
          {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => (
            <div key={d} className="py-2.5">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i]}</span>
            </div>
          ))}
        </div>

        {/* Células de Dias */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-24 border-r border-b border-line bg-slate-50/40 sm:min-h-32" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const isToday =
              day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const dayPosts = postsByDay[day] || []
            const specialDate = specialDatesInMonth.find((sd) => sd.day === day)

            return (
              <div
                key={day}
                className={cx(
                  'group relative min-h-24 border-r border-b border-line p-1.5 transition sm:min-h-32 sm:p-2',
                  isToday && 'bg-brand-50/40 ring-1 ring-inset ring-brand-300',
                )}
              >
                {/* Linha Superior do Dia */}
                <div className="flex items-center justify-between">
                  <span
                    className={cx(
                      'grid size-6 place-items-center rounded-full text-xs font-bold',
                      isToday ? 'bg-brand-700 text-white' : 'text-slate-700',
                    )}
                  >
                    {day}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddDay(day)}
                    className="grid size-5 place-items-center rounded text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200 hover:text-ink"
                    title={`Agendar post para o dia ${day}`}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                {/* Data Especial */}
                {specialDate && (
                  <div className="mt-1 flex items-center gap-1 truncate rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
                    <CalendarHeart className="size-2.5 shrink-0" />
                    <span className="truncate">{specialDate.label}</span>
                  </div>
                )}

                {/* Cards de Posts Agendados no Dia */}
                <div className="mt-1.5 space-y-1.5">
                  {dayPosts.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setActivePost(sp)}
                      className={cx(
                        'flex w-full items-center gap-1.5 rounded-lg border p-1 text-left shadow-sm transition hover:scale-[1.02]',
                        sp.status === 'publicado'
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                          : 'border-brand-200 bg-white text-ink',
                      )}
                    >
                      <div className="size-6 shrink-0 overflow-hidden rounded bg-slate-100">
                        <Creative
                          c={sp.creative}
                          style={sp.style}
                          palette={sp.palette}
                          format={sp.postFormat}
                          brand={{ name: brand.name, handle: brand.handle }}
                          chrome={false}
                        />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-[11px] font-bold">{sp.creative.headline}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <span>{sp.time}</span>
                          <span>·</span>
                          <span className="capitalize">{sp.creative.kind === 'story' ? 'Story' : 'Feed'}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Datas Comemorativas do Mês */}
      {specialDatesInMonth.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 font-bold text-ink">
            <CalendarHeart className="size-5 text-amber-500" />
            <span>Oportunidades e Datas Especiais deste Mês</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {specialDatesInMonth.map((sd) => (
              <div
                key={sd.day}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-slate-50 p-3"
              >
                <div>
                  <div className="text-sm font-bold text-ink">{sd.label}</div>
                  <div className="text-xs text-slate-500">Dia {sd.day} deste mês</div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    nav('/app/criar/1')
                    toast(`Criando conteúdo focado em: ${sd.label}`)
                  }}
                >
                  Criar post
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal: Detalhes do Post Agendado */}
      {activePost && (
        <Modal
          open={!!activePost}
          onClose={() => setActivePost(null)}
          wide
          title={
            <div className="flex items-center gap-2">
              <span className="capitalize">
                {activePost.creative.kind === 'story' ? 'Story' : 'Post de Feed'} Agendado
              </span>
              <Badge className={activePost.status === 'publicado' ? 'bg-emerald-100 text-emerald-800' : 'bg-brand-50'}>
                {activePost.status === 'publicado' ? 'Publicado' : 'Agendado'}
              </Badge>
            </div>
          }
        >
          <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,340px)_1fr]">
            <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl shadow-card">
              <Creative
                c={activePost.creative}
                style={activePost.style}
                palette={activePost.palette}
                format={activePost.postFormat}
                brand={baseLook.brand}
                chrome={false}
              />
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 border-b border-line pb-3">
                <span>
                  <b>Data:</b> {activePost.date} às {activePost.time}
                </span>
                <span>
                  <b>Rede:</b> Instagram
                </span>
                <span>
                  <b>Tema:</b> {activePost.themeLabel}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-ink">Legenda</h4>
                <p className="mt-1.5 max-h-44 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs leading-relaxed whitespace-pre-line text-slate-700 scroll-thin">
                  {activePost.creative.caption}
                </p>
                <p className="mt-2 text-xs font-semibold text-brand-700">{activePost.creative.hashtags.join(' ')}</p>
              </div>

              {activePost.notes && (
                <div className="rounded-xl border border-line bg-slate-50 p-3 text-xs text-slate-600">
                  <b>Nota do agendamento:</b> {activePost.notes}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    setPublishingPost(activePost)
                    setActivePost(null)
                  }}
                >
                  <Send className="size-4" /> Auxiliar postagem
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await copyText(
                      `${activePost.creative.caption}\n\n${activePost.creative.hashtags.join(' ')}`,
                    )
                    toast('Legenda copiada!')
                  }}
                >
                  <Copy className="size-4" /> Copiar legenda
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    exportCreatives([
                      jobFor(
                        activePost.creative,
                        {
                          palette: activePost.palette,
                          style: activePost.style,
                          format: activePost.postFormat,
                          brand: baseLook.brand,
                        },
                        0,
                        `${activePost.themeLabel}-${activePost.creative.kind}`,
                      ),
                    ])
                  }
                >
                  <Download className="size-4" /> Baixar PNG
                </Button>
                {activePost.status !== 'publicado' && (
                  <Button
                    variant="soft"
                    onClick={() => {
                      markPostPublished(activePost.id)
                      toast('Marcado como publicado!')
                      setActivePost(null)
                    }}
                  >
                    <CheckCircle2 className="size-4" /> Marcar como publicado
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    removeScheduledPost(activePost.id)
                    toast('Removido do calendário')
                    setActivePost(null)
                  }}
                >
                  <Trash2 className="size-4" /> Excluir
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Agendar para o Dia Clicado */}
      {addDay && (
        <Modal
          open={!!addDay}
          onClose={() => setAddDay(null)}
          title={`Agendar Conteúdo para o Dia ${addDay} de ${monthLabel}`}
        >
          <div className="p-6">
            <p className="text-sm text-slate-600">
              Escolha um criativo da sua <b>Biblioteca</b> para agendar nesta data:
            </p>

            {library.length ? (
              <div className="mt-4 grid max-h-60 grid-cols-3 gap-3 overflow-y-auto p-1 scroll-thin">
                {library.map((l) => {
                  const on = (selectedLibId || library[0].id) === l.id
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedLibId(l.id)}
                      className={cx(
                        'overflow-hidden rounded-xl border p-1 text-left transition',
                        on ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-slate-300',
                      )}
                    >
                      <div className="aspect-[4/5] overflow-hidden rounded-lg">
                        <Creative
                          c={l.creative}
                          style={l.style}
                          palette={l.palette}
                          format={l.postFormat}
                          brand={baseLook.brand}
                          chrome={false}
                        />
                      </div>
                      <div className="truncate pt-1 text-[11px] font-semibold">{l.themeLabel}</div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="my-6 text-center text-sm text-slate-500">
                <FolderOpen className="mx-auto size-8 text-slate-400" />
                <p className="mt-2">Sua biblioteca está vazia.</p>
                <Button size="sm" className="mt-3" onClick={() => nav('/app/criar/1')}>
                  Criar conteúdo agora
                </Button>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-ink">Horário</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-line px-3 text-sm"
                />
              </div>
              <div className="flex flex-col justify-end">
                <span className="text-[11px] text-slate-500">Sugerido para {brand.segment}:</span>
                <span className="text-xs font-bold text-brand-700">{tips.bestHours[0] || '11:30'}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setAddDay(null)}>
                Cancelar
              </Button>
              <Button onClick={handleScheduleFromLibrary} disabled={!library.length}>
                Agendar post
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assistente de Publicação */}
      {publishingPost && (
        <SocialPublishModal
          open={!!publishingPost}
          onClose={() => setPublishingPost(null)}
          creative={publishingPost.creative}
          look={{
            palette: publishingPost.palette,
            style: publishingPost.style,
            format: publishingPost.postFormat,
            brand: baseLook.brand,
          }}
          themeLabel={publishingPost.themeLabel}
        />
      )}
    </div>
  )
}

