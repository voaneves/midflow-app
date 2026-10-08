import { ArrowRight, Download, FileText, FolderPlus, PenSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Creative } from '../../components/creative/Creative'
import { exportCreatives, jobFor, useLook } from '../../components/creative/parts'
import { Button, Card, Empty, toast } from '../../components/ui'
import { OBJECTIVES, STYLES } from '../../lib/data'
import { useApp } from '../../lib/store'

export function Posts() {
  const nav = useNavigate()
  const generations = useApp((s) => s.generations)
  const setActive = useApp((s) => s.setActiveGen)
  const markDone = useApp((s) => s.markDone)
  const save = useApp((s) => s.saveToLibrary)
  const library = useApp((s) => s.library)
  const { brand } = useLook()

  if (!generations.length)
    return (
      <div className="mx-auto max-w-3xl">
        <Empty
          icon={<FileText className="size-6" />}
          title="Nenhuma geração ainda"
          text={`Crie seu primeiro conteúdo e as versões aparecem aqui. Você já tem ${library.length} criativo(s) salvos na Biblioteca.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => nav('/app/criar/1')}>
                <PenSquare className="size-4" /> Criar conteúdo
              </Button>
              <Button variant="secondary" onClick={() => nav('/app/biblioteca')}>
                Abrir biblioteca
              </Button>
            </div>
          }
        />
      </div>
    )

  return (
    <div className="mx-auto grid max-w-[1400px] gap-5">
      {[...generations].reverse().map((g) => {
        const look = { palette: g.params.palette, style: g.params.style, format: g.params.postFormat, brand }
        const all = [...g.posts, ...g.stories]
        return (
          <Card key={g.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold">{g.themeLabel}</h3>
                  <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-white">V{g.version}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {new Date(g.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {OBJECTIVES.find((o) => o.id === g.params.objective)?.label} · Estilo {STYLES.find((s) => s.id === g.params.style)?.label} · {g.posts.length} posts e {g.stories.length} stories
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => exportCreatives(all.map((c, i) => jobFor(c, look, i, `${g.themeLabel}-${c.kind}-${c.order}`)))}>
                  <Download className="size-4" /> Baixar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const n = save(all.map((creative) => ({ creative, gen: g })))
                    toast(n ? `${n} conteúdos salvos na biblioteca` : 'Já está tudo na biblioteca')
                  }}
                >
                  <FolderPlus className="size-4" /> Salvar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setActive(g.id)
                    markDone(1)
                    markDone(2)
                    markDone(3)
                    nav('/app/criar/4')
                  }}
                >
                  Abrir <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="no-scrollbar mt-4 flex items-start gap-3 overflow-x-auto pb-1">
              {all.map((c) => (
                <div key={c.id} className={c.kind === 'story' ? 'w-[110px] shrink-0' : 'w-[150px] shrink-0'}>
                  <div className="overflow-hidden rounded-lg">
                    <Creative c={c} style={look.style} palette={look.palette} format={look.format} brand={brand} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
