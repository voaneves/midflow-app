import { ArrowRight, Download, FileText, FolderPlus, MoreVertical, PenSquare, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../components/creative/Creative'
import { exportCreatives, jobFor, useLook } from '../../components/creative/helpers'
import { Button, Card, ChoiceGroup, cx, EmptyState, IconButton, Input, Menu, toast } from '../../components/ui'
import { OBJECTIVES, STYLES } from '../../lib/data'
import { useApp } from '../../lib/store'
import { engineLabel } from '../../lib/telemetry'
import type { Generation } from '../../lib/types'

function dayLabel(ts: number) {
  const d = new Date(ts)
  const today = new Date()
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export function Posts() {
  const nav = useNavigate()
  const generations = useApp((s) => s.generations)
  const setActive = useApp((s) => s.setActiveGen)
  const markDone = useApp((s) => s.markDone)
  const save = useApp((s) => s.saveToLibrary)
  const library = useApp((s) => s.library)
  const { brand } = useLook()
  const [q, setQ] = useState('')
  const [engine, setEngine] = useState<'all' | 'ai' | 'offline'>('all')

  const groups = useMemo(() => {
    const list = [...generations]
      .reverse()
      .filter((g) => (engine === 'all' || engineLabel(g.engine).isAI === (engine === 'ai')) && (!q || g.themeLabel.toLowerCase().includes(q.toLowerCase())))
    const out: { label: string; items: Generation[] }[] = []
    for (const g of list) {
      const label = dayLabel(g.createdAt)
      const last = out[out.length - 1]
      if (last?.label === label) last.items.push(g)
      else out.push({ label, items: [g] })
    }
    return out
  }, [generations, q, engine])

  if (!generations.length)
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<FileText className="size-6" />}
          title="Nenhum conteúdo gerado ainda"
          text={`Crie seu primeiro conteúdo e as versões aparecem aqui. ${library.length === 0 ? 'Sua Biblioteca ainda está vazia.' : library.length === 1 ? 'Você tem 1 criativo na Biblioteca.' : `Você tem ${library.length} criativos na Biblioteca.`}`}
          action={
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={() => nav('/app/criar/1')}>
                <PenSquare className="size-4" aria-hidden /> Criar conteúdo
              </Button>
              <Button variant="secondary" onClick={() => nav('/app/biblioteca')}>
                Abrir biblioteca
              </Button>
            </div>
          }
        />
      </div>
    )

  const openGen = (g: Generation) => {
    setActive(g.id)
    markDone(1)
    markDone(2)
    markDone(3)
    nav('/app/criar/4')
  }

  return (
    <div className="mx-auto grid max-w-[1400px] gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-72">
          <Input type="search" icon={<Search className="size-4" />} placeholder="Buscar por tema" aria-label="Buscar gerações por tema" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ChoiceGroup
          legend="Filtrar por motor"
          legendHidden
          variant="chip"
          value={engine}
          onChange={setEngine}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'ai', label: 'Criadas com IA' },
            { value: 'offline', label: 'Versão padrão (sem IA)' },
          ]}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {(() => { const n = groups.reduce((a, g) => a + g.items.length, 0); return `${n} ${n === 1 ? 'geração' : 'gerações'}` })()}
      </p>

      {groups.map((grp) => (
        <section key={grp.label} aria-labelledby={`grp-${grp.label}`}>
          <h2 id={`grp-${grp.label}`} className="mb-2 text-sm font-bold tracking-wide text-fg-subtle uppercase">
            {grp.label}
          </h2>
          <ul className="grid gap-3">
            {grp.items.map((g) => {
              const look = { palette: g.params.palette, style: g.params.style, format: g.params.postFormat, brand }
              const all = [...g.posts, ...g.stories]
              const { isAI } = engineLabel(g.engine)
              return (
                <li key={g.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="flex flex-wrap items-center gap-2 text-base font-bold">
                          <span className="truncate">{g.themeLabel}</span>
                          <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-white">V{g.version}</span>
                          <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', isAI ? 'bg-emerald-50 text-emerald-900' : 'bg-warning-soft text-amber-950')}>
                            <Sparkles className="size-3" aria-hidden /> {isAI ? 'IA' : 'Reserva'}
                          </span>
                        </h3>
                        <p className="mt-0.5 text-sm text-fg-subtle">
                          {new Date(g.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {OBJECTIVES.find((o) => o.id === g.params.objective)?.label} · {STYLES.find((s) => s.id === g.params.style)?.label} · {g.posts.length} {g.posts.length === 1 ? 'post' : 'posts'} e {g.stories.length} {g.stories.length === 1 ? 'story' : 'stories'}
                        </p>
                      </div>
                      <Menu
                        label={`Ações: ${g.themeLabel}, versão ${g.version}`}
                        items={[
                          { label: 'Abrir', icon: <ArrowRight className="size-4" />, onClick: () => openGen(g) },
                          { label: 'Baixar tudo (.zip)', icon: <Download className="size-4" />, onClick: () => exportCreatives(all.map((c, i) => jobFor(c, look, i, `${g.themeLabel}-${c.kind}-${c.order}`))) },
                          {
                            label: 'Salvar na biblioteca',
                            icon: <FolderPlus className="size-4" />,
                            onClick: () => {
                              const n = save(all.map((creative) => ({ creative, gen: g })))
                              toast(n ? `${n} ${n === 1 ? 'conteúdo salvo' : 'conteúdos salvos'} na biblioteca` : 'Já está tudo na biblioteca')
                            },
                          },
                        ]}
                        trigger={(p) => (
                          <IconButton {...p} label={`Ações: ${g.themeLabel}, versão ${g.version}`}>
                            <MoreVertical className="size-5" aria-hidden />
                          </IconButton>
                        )}
                      />
                    </div>
                    <button type="button" onClick={() => openGen(g)} className="mt-3 block w-full text-left" aria-label={`Abrir ${g.themeLabel}, versão ${g.version}`}>
                      <span className="no-scrollbar flex items-start gap-2.5 overflow-x-auto pb-1">
                        {all.map((c) => (
                          <span key={c.id} className={cx('shrink-0 overflow-hidden rounded-lg', c.kind === 'story' ? 'w-[88px] sm:w-[110px]' : 'w-[120px] sm:w-[150px]')}>
                            <Creative c={c} style={look.style} palette={look.palette} format={look.format} brand={brand} label="" />
                          </span>
                        ))}
                      </span>
                    </button>
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {!groups.length && <p className="py-10 text-center text-sm text-fg-subtle">Nada encontrado para esse filtro.</p>}
    </div>
  )
}
