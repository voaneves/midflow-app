import { Copy, Download, FolderOpen, PenSquare, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../components/creative/Creative'
import { Editor } from '../../components/creative/Editor'
import { CreativeTile, exportCreatives, jobFor, useLook } from '../../components/creative/parts'
import { Button, Empty, Input, Modal, Tabs, toast } from '../../components/ui'
import { copyText } from '../../lib/export'
import { useApp } from '../../lib/store'
import type { LibraryItem } from '../../lib/types'

export function Library() {
  const nav = useNavigate()
  const library = useApp((s) => s.library)
  const remove = useApp((s) => s.removeFromLibrary)
  const updateCreative = useApp((s) => s.updateCreative)
  const { brand } = useLook()
  const [kind, setKind] = useState<'all' | 'post' | 'story'>('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [view, setView] = useState<LibraryItem | null>(null)
  const [edit, setEdit] = useState<LibraryItem | null>(null)
  const [confirm, setConfirm] = useState<string[] | null>(null)

  const items = useMemo(
    () =>
      library.filter(
        (l) =>
          (kind === 'all' || l.creative.kind === kind) &&
          (!q || `${l.creative.headline} ${l.themeLabel} ${l.creative.caption}`.toLowerCase().includes(q.toLowerCase())),
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
      return n
    })
  const selected = library.filter((l) => sel.has(l.id))

  if (!library.length)
    return (
      <div className="mx-auto max-w-3xl">
        <Empty
          icon={<FolderOpen className="size-6" />}
          title="Sua biblioteca está vazia"
          text="Salve posts e Stories na etapa Gerar para encontrá-los aqui, prontos para baixar."
          action={
            <Button onClick={() => nav('/app/criar/1')}>
              <PenSquare className="size-4" /> Criar conteúdo
            </Button>
          }
        />
      </div>
    )

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={kind}
          onChange={setKind}
          className="w-full bg-white ring-1 ring-line sm:w-auto"
          items={[
            { id: 'all', label: `Todos (${library.length})` },
            { id: 'post', label: 'Posts' },
            { id: 'story', label: 'Stories' },
          ]}
        />
        <div className="w-full sm:ml-auto sm:w-72">
          <Input id="lib-search" icon={<Search className="size-4" />} placeholder="Buscar por tema ou texto" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {selected.length > 0 && (
        <div className="sticky top-[84px] z-10 mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-pop animate-rise">
          <span className="mr-auto font-semibold">{selected.length} selecionado(s)</span>
          <Button size="sm" variant="secondary" onClick={() => download(selected)}>
            <Download className="size-4" /> Baixar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirm(selected.map((s) => s.id))}>
            <Trash2 className="size-4" /> Remover
          </Button>
          <button onClick={() => setSel(new Set())} className="grid size-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Limpar seleção">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 items-start gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {items.map((l, i) => (
          <div key={l.id} className="min-w-0">
            <CreativeTile
              c={l.creative}
              index={i}
              look={lookOf(l)}
              selected={sel.has(l.id)}
              onSelect={() => toggle(l.id)}
              onOpen={() => setView(l)}
              onEdit={() => setEdit(l)}
              onDownload={() => download([l])}
              compact
              menu={[
                { label: 'Copiar legenda', icon: <Copy className="size-4" />, onClick: async () => (await copyText(`${l.creative.caption}\n\n${l.creative.hashtags.join(' ')}`)) && toast('Legenda copiada') },
                { label: 'Remover', icon: <Trash2 className="size-4" />, onClick: () => setConfirm([l.id]), danger: true },
              ]}
            />
            <div className="mt-1.5 truncate text-xs text-slate-500">
              {l.themeLabel} · {new Date(l.savedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </div>
          </div>
        ))}
      </div>
      {!items.length && <p className="mt-10 text-center text-sm text-slate-500">Nada encontrado para esse filtro.</p>}

      <Modal open={!!view} onClose={() => setView(null)} wide title={view?.themeLabel}>
        {view && (
          <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,360px)_1fr]">
            <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl shadow-card">
              <Creative c={view.creative} style={view.style} palette={view.palette} format={view.postFormat} brand={brand} chrome={false} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold">Legenda</h4>
              <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">{view.creative.caption}</p>
              <p className="mt-3 text-sm font-medium text-brand-700">{view.creative.hashtags.join(' ')}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={() => download([view])}>
                  <Download className="size-4" /> Baixar PNG
                </Button>
                <Button variant="secondary" onClick={async () => (await copyText(`${view.creative.caption}\n\n${view.creative.hashtags.join(' ')}`)) && toast('Legenda copiada')}>
                  <Copy className="size-4" /> Copiar legenda
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Editor
        open={!!edit}
        creative={edit?.creative ?? null}
        look={edit ? lookOf(edit) : { palette: library[0].palette, style: library[0].style, format: '4:5', brand }}
        onClose={() => setEdit(null)}
        onSave={(c) => {
          updateCreative('__library__', c)
        }}
      />

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Remover da biblioteca?">
        <div className="p-6">
          <p className="text-sm text-slate-600">{confirm?.length === 1 ? 'Este criativo será removido' : `${confirm?.length} criativos serão removidos`} da biblioteca. As gerações em “Meus posts” continuam disponíveis.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                remove(confirm ?? [])
                setSel(new Set())
                setConfirm(null)
                toast('Removido da biblioteca')
              }}
            >
              <Trash2 className="size-4" /> Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
