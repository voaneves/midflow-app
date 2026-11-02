import { CalendarClock, Check, Clock, Copy, Download, ExternalLink, MessageCircle, Share2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { copyText, dataUrlToBlob, renderPng } from '../../lib/export'
import { generateDirectLinks, getSocialTips } from '../../lib/social'
import { useApp } from '../../lib/store'
import type { Creative } from '../../lib/types'
import { Button, cx, Dialog, InstagramIcon, toast } from '../ui'
import { exportCreatives, jobFor, type Look } from './parts'

interface Props {
  open: boolean
  onClose: () => void
  creative: Creative | null
  look: Look
  themeLabel?: string
  onOpenSchedule?: () => void
  onSchedule?: () => void
}

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <span aria-hidden className={cx('z-10 grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold', done ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 ring-1 ring-line')}>
        {done ? <Check className="size-4" strokeWidth={3} /> : n}
      </span>
      <span aria-hidden className="absolute top-8 bottom-0 left-4 w-px bg-line last:hidden" />
      <div className="min-w-0 flex-1 pt-1">
        <h3 className="text-sm font-bold">
          {title}
          {done && <span className="sr-only"> (feito)</span>}
        </h3>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  )
}

/** Publishing assistant: 1. copy caption → 2. save the image → 3. open Instagram. Native share with files when supported. */
export function SocialPublishModal({ open, onClose, creative, look, themeLabel, onOpenSchedule, onSchedule }: Props) {
  const brand = useApp((s) => s.brand)
  const scheduleAction = onSchedule || onOpenSchedule
  const [done, setDone] = useState({ copy: false, image: false, insta: false })
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    setDone({ copy: false, image: false, insta: false })
    setFile(null)
    if (!open || !creative) return
    let alive = true
    // pre-render the PNG so the share sheet can open synchronously on tap (iOS requires a user gesture)
    renderPng(jobFor(creative, look, creative.order - 1, `${themeLabel || 'criativo'}-${creative.kind}-${creative.order}`))
      .then((url) => alive && setFile(new File([dataUrlToBlob(url)], `midflow-${creative.kind}-${creative.order}.png`, { type: 'image/png' })))
      .catch(() => undefined)
    return () => {
      alive = false
    }
    // look objects are recreated by callers on every render; the creative identity is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, creative, themeLabel])

  if (!creative) return null
  const tips = getSocialTips(brand.segment)
  const links = generateDirectLinks({ caption: creative.caption, hashtags: creative.hashtags, brandName: brand.name, city: brand.city })
  const canShareFile = !!file && typeof navigator !== 'undefined' && 'canShare' in navigator && navigator.canShare({ files: [file] })

  const copy = async () => {
    if (await copyText(links.fullText)) {
      setDone((d) => ({ ...d, copy: true }))
      toast('Legenda e hashtags copiadas')
    }
  }
  const download = () => {
    exportCreatives([jobFor(creative, look, creative.order - 1, `${themeLabel || 'criativo'}-${creative.kind}-${creative.order}`)])
    setDone((d) => ({ ...d, image: true }))
  }
  const share = async () => {
    if (!file) return
    await copyText(links.fullText)
    try {
      await navigator.share({ files: [file], text: links.fullText, title: `${brand.name} — ${creative.headline}` })
      setDone({ copy: true, image: true, insta: true })
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast('Não foi possível abrir o compartilhamento. Use os passos abaixo.', 'error')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Publicar no Instagram"
      description={`${creative.kind === 'story' ? `Story ${creative.order}` : `Post ${creative.order}`} · ${brand.name}`}
      size="lg"
      footer={
        scheduleAction ? (
          <Button variant="soft" className="w-full sm:w-auto" onClick={scheduleAction}>
            <CalendarClock className="size-4" aria-hidden /> Prefiro agendar no Calendário
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-6 px-5 py-4 md:grid-cols-[1.15fr_0.85fr] md:px-6">
        <div>
          {canShareFile && (
            <div className="mb-5 rounded-2xl bg-brand-50 p-4">
              <p className="text-sm text-brand-950">Mais rápido no celular: a legenda é copiada e a imagem vai direto para o app que você escolher.</p>
              <Button className="mt-3 w-full" onClick={share}>
                <Share2 className="size-4" aria-hidden /> Compartilhar imagem + legenda
              </Button>
            </div>
          )}
          <ol aria-label="Passo a passo">
            <Step n={1} done={done.copy} title="Copie a legenda">
              <div className="max-h-40 overflow-y-auto rounded-xl border border-line bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-line text-slate-800 scroll-thin">
                {creative.caption}
                <div className="mt-2 font-semibold text-brand-800">{creative.hashtags.join(' ')}</div>
              </div>
              <Button variant={done.copy ? 'secondary' : 'primary'} className="mt-2 w-full sm:w-auto" onClick={copy}>
                {done.copy ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {done.copy ? 'Copiada' : 'Copiar legenda e hashtags'}
              </Button>
            </Step>
            <Step n={2} done={done.image} title="Salve a imagem">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={download}>
                <Download className="size-4" aria-hidden /> Baixar PNG (1080 px)
              </Button>
            </Step>
            <Step n={3} done={done.insta} title="Abra o Instagram e cole a legenda">
              <div className="grid gap-2 sm:grid-cols-2">
                <a
                  href={links.instagramCreate}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDone((d) => ({ ...d, insta: true }))}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50"
                >
                  <InstagramIcon className="size-4" /> Abrir Instagram <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
                <a
                  href={links.whatsAppShare}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-950 hover:bg-emerald-100"
                >
                  <MessageCircle className="size-4" aria-hidden /> Enviar no WhatsApp <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              </div>
            </Step>
          </ol>
        </div>

        <div className="grid content-start gap-4">
          <section aria-labelledby="pub-hours" className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
            <h3 id="pub-hours" className="flex items-center gap-2 text-sm font-bold text-brand-950">
              <Clock className="size-4 text-brand-700" aria-hidden /> Melhores horários
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {tips.bestHours.map((h) => (
                <li key={h} className="rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-bold text-brand-900">
                  {h}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-brand-950">
              <b>Melhores dias:</b> {tips.bestDays.join(', ')}. <b>Ritmo:</b> {tips.frequency}.
            </p>
          </section>
          <details className="rounded-2xl border border-line p-4">
            <summary className="cursor-pointer text-sm font-bold">Dicas para mais alcance</summary>
            <ul className="mt-2 grid gap-1.5 text-sm text-slate-700">
              <li>• Marque a localização ({brand.city || 'sua cidade'}).</li>
              <li>• Reposte nos Stories com enquete ou caixa de pergunta.</li>
              {tips.storyHooks.slice(0, 2).map((h) => (
                <li key={h}>• {h}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </Dialog>
  )
}
