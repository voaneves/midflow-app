import { CalendarDays, Copy, Download, FolderOpen, PenSquare, Search, Share2, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreativeViewer } from '../../components/creative/CreativeViewer'
import { LazyEditor as Editor } from '../../components/creative/LazyEditor'
import { CreativeTile, exportCreatives, jobFor, useLook } from '../../components/creative/parts'
import { SocialPublishModal } from '../../components/creative/SocialPublishModal'
import { ActionBar, Button, ChoiceGroup, EmptyState, IconButton, Input, toast } from '../../components/ui'
import { copyText } from '../../lib/export'
import { useApp } from '../../lib/store'
import type { LibraryItem } from '../../lib/types'

export function Library() {
  const nav = useNavigate()
  const library = useApp((s) => s.library)
  const remove = useApp((s) => s.removeFromLibrary)
  const updateCreative = useApp((s) => s.updateCreative)
  const scheduleCreative = useApp((s) => s.scheduleCreative)
  const { brand } = useLook()
  const [kind, setKind] = useState<'all' | 'post' | 'story'>('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [selecting, setSelecting] = useState(false)
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [edit, setEdit] = useState<LibraryItem | null>(null)
  const [publishItem, setPublishItem] = useState<LibraryItem | null>(null)

  const items = useMemo(
    () =>
      library.filter(
        (l) => (kind === 'all' || l.creative.kind === kind) && (!q || `${l.creative.headline} ${l.themeLabel} ${l.creative.caption}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [library, kind, q],
  )
  const lookOf = (l: LibraryItem) => ({ palette: l.palette, style: l.style, format: l.postFormat, brand })
  const download = (list: LibraryItem[]) => exportCreatives(list.map((l, i) => jobFor(l.creative, lookOf(l), i, `${l.themeLabel}-${l.creative.kind}`)))
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      if (n.size) setSelecting(true)
      return n
    })
  const exitSelection = () => {
    setSelecting(false)
    setSel(new Set())
  }
  const selected = library.filter((l) => sel.has(l.id))
  const schedule = (l: LibraryItem) => {
    scheduleCreative({ date: new Date().toISOString().slice(0, 10), time: '18:30', creative: l.creative, style: l.style, palette: l.palette, format: l.postFormat, themeLabel: l.themeLabel })
    toast('Adicionado ao Calendário de hoje, às 18:30', 'ok', { action: { label: 'Abrir', onClick: () => nav('/app/calendario') } })
  }
  /** Remove with an undo toast instead of a blocking confirmation. */
  const removeWithUndo = (ids: string[]) => {
    const before = useApp.getState().library
    remove(ids)
    exitSelection()
    setViewIndex(null)
    toast(ids.length === 1 ? 'Criativo removido da biblioteca' : `${ids.length} criativos removidos`, 'ok', {
      action: { label: 'Desfazer', onClick: () => useApp.setState({ library: before }) },
    })
  }

  if (!library.length)
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<FolderOpen className="size-6" />}
          title="Sua biblioteca está vazia"
          text="Salve posts e Stories na etapa Gerar para encontrá-los aqui, prontos para baixar."
          action={
            <Button onClick={() => nav('/app/criar/1')}>
              <PenSquare className="size-4" aria-hidden /> Criar conteúdo
            </Button>
          }
        />
      </div>
    )

  const viewing = viewIndex !== null ? items[viewIndex] : null

  return (
    <div className="mx-auto max-w-[1400px]">
      <h2 className="sr-only">Criativos salvos</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <ChoiceGroup
          legend="Filtrar por formato"
          legendHidden
          variant="segmented"
          className="sm:w-80"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: `Todos (${library.length})` },
            { value: 'post', label: 'Posts' },
            { value: 'story', label: 'Stories' },
          ]}
        />
        <div className="sm:ml-auto sm:w-72">
          <Input type="search" icon={<Search className="size-4" />} placeholder="Buscar por tema ou texto" aria-label="Buscar na biblioteca" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant={selecting ? 'dark' : 'secondary'} onClick={() => (selecting ? exitSelection() : setSelecting(true))} aria-pressed={selecting}>
          {selecting ? 'Concluir' : 'Selecionar'}
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {items.length} {items.length === 1 ? 'criativo' : 'criativos'}
      </p>

      {selecting && (
        <div className="sticky top-[calc(var(--header-offset)+8px)] z-10 mt-4 hidden items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-pop lg:flex" role="region" aria-label="Seleção">
          <span className="mr-auto font-semibold" aria-live="polite">
            {selected.length} {selected.length === 1 ? 'selecionado' : 'selecionados'}
          </span>
          <Button size="sm" variant="glass" onClick={() => download(selected)} disabled={!selected.length}>
            <Download className="size-4" aria-hidden /> Baixar
          </Button>
          <Button size="sm" variant="glass" onClick={() => removeWithUndo(selected.map((s) => s.id))} disabled={!selected.length}>
            <Trash2 className="size-4" aria-hidden /> Remover
          </Button>
          <IconButton size="sm" variant="glass" label="Sair da seleção" onClick={exitSelection}>
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
      )}

      <ul className="mt-5 grid grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-6">
        {items.map((l, i) => (
          <li key={l.id} className="min-w-0">
            <CreativeTile
              c={l.creative}
              index={i}
              look={lookOf(l)}
              selecting={selecting}
              selected={sel.has(l.id)}
              onSelect={() => toggle(l.id)}
              onOpen={() => setViewIndex(i)}
              onEdit={() => setEdit(l)}
              onDownload={() => download([l])}
              compact
              menu={[
                { label: 'Publicar', icon: <Share2 className="size-4 text-brand-700" />, onClick: () => setPublishItem(l) },
                { label: 'Agendar no Calendário', icon: <CalendarDays className="size-4 text-brand-700" />, onClick: () => schedule(l) },
                { label: 'Copiar legenda', icon: <Copy className="size-4" />, onClick: async () => void ((await copyText(`${l.creative.caption}\n\n${l.creative.hashtags.join(' ')}`)) && toast('Legenda copiada')) },
                { label: 'Remover', icon: <Trash2 className="size-4" />, onClick: () => removeWithUndo([l.id]), danger: true },
              ]}
            />
            <p className="mt-1.5 truncate text-xs text-fg-subtle">
              {l.themeLabel} · {new Date(l.savedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </p>
          </li>
        ))}
      </ul>
      {!items.length && <p className="mt-10 text-center text-sm text-fg-subtle">Nada encontrado para esse filtro.</p>}

      {selecting && (
        <ActionBar className="lg:hidden">
          <span className="mr-auto text-sm font-semibold" aria-live="polite">
            {selected.length} {selected.length === 1 ? 'selecionado' : 'selecionados'}
          </span>
          <IconButton variant="secondary" label="Remover selecionados" onClick={() => removeWithUndo(selected.map((s) => s.id))} disabled={!selected.length}>
            <Trash2 className="size-5" aria-hidden />
          </IconButton>
          <Button onClick={() => download(selected)} disabled={!selected.length}>
            <Download className="size-4" aria-hidden /> Baixar
          </Button>
        </ActionBar>
      )}

      {viewing && (
        <CreativeViewer
          items={items.map((l) => l.creative)}
          index={viewIndex}
          onIndex={setViewIndex}
          onClose={() => setViewIndex(null)}
          look={lookOf(viewing)}
          title={viewing.themeLabel}
          onEdit={() => {
            setEdit(viewing)
            setViewIndex(null)
          }}
          onPublish={() => {
            setPublishItem(viewing)
            setViewIndex(null)
          }}
          extraActions={() => (
            <>
              <Button variant="secondary" onClick={() => schedule(viewing)}>
                <CalendarDays className="size-4" aria-hidden /> Agendar
              </Button>
              <Button variant="danger" onClick={() => removeWithUndo([viewing.id])}>
                <Trash2 className="size-4" aria-hidden /> Remover
              </Button>
            </>
          )}
        />
      )}

      {publishItem && (
        <SocialPublishModal
          open
          creative={publishItem.creative}
          look={lookOf(publishItem)}
          onClose={() => setPublishItem(null)}
          onSchedule={() => {
            schedule(publishItem)
            setPublishItem(null)
          }}
        />
      )}

      <Editor
        open={!!edit}
        creative={edit?.creative ?? null}
        look={edit ? lookOf(edit) : { palette: library[0].palette, style: library[0].style, format: '4:5', brand }}
        onClose={() => setEdit(null)}
        onSave={(c) => updateCreative('__library__', c)}
      />
    </div>
  )
}
