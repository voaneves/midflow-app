import { useState } from 'react'
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  Share2,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { copyText, type ExportJob } from '../../lib/export'
import { generateDirectLinks, getSocialTips, shareContentNative } from '../../lib/social'
import { useApp } from '../../lib/store'
import type { Creative, Palette, PostFormat, StyleId } from '../../lib/types'
import { Button, Card, cx, InstagramIcon, Modal, toast } from '../ui'
import { type BrandMark } from './Creative'
import { exportCreatives, jobFor } from './parts'

interface Props {
  open: boolean
  onClose: () => void
  creative: Creative | null
  look: { palette: Palette; style: StyleId; format: PostFormat; brand: BrandMark }
  themeLabel?: string
  onOpenSchedule?: () => void
  onSchedule?: () => void
}

export function SocialPublishModal({ open, onClose, creative, look, themeLabel, onOpenSchedule, onSchedule }: Props) {
  const brand = useApp((s) => s.brand)
  const scheduleAction = onSchedule || onOpenSchedule
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({
    arte: false,
    legenda: false,
    local: false,
    stories: false,
  })

  if (!creative) return null

  const tips = getSocialTips(brand.segment)
  const links = generateDirectLinks({
    caption: creative.caption,
    hashtags: creative.hashtags,
    brandName: brand.name,
    city: brand.city,
  })

  const handleCopy = async () => {
    const ok = await copyText(links.fullText)
    if (ok) {
      setCopied(true)
      setCheckedSteps((s) => ({ ...s, legenda: true }))
      toast('Legenda e hashtags copiadas com sucesso!')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    const job: ExportJob = jobFor(
      creative,
      look,
      creative.order - 1,
      `${themeLabel || 'criativo'}-${creative.kind}-${creative.order}`,
    )
    exportCreatives([job])
    setCheckedSteps((s) => ({ ...s, arte: true }))
    setDownloading(false)
  }

  const handleNativeShare = async () => {
    const res = await shareContentNative({
      title: `${brand.name} — ${creative.headline}`,
      text: links.fullText,
    })
    if (res === 'shared') {
      toast('Compartilhamento acionado!')
    } else if (res === 'copied') {
      toast('Texto copiado para a área de transferência')
    }
  }

  const toggleCheck = (k: string) => {
    setCheckedSteps((s) => ({ ...s, [k]: !s[k] }))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-brand-600" />
          <span>Assistente de Publicação Social Media</span>
        </div>
      }
    >
      <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Coluna Esquerda: Texto + Ações Diretas */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                {creative.kind === 'story' ? `Story ${creative.order}` : `Post para Feed ${creative.order}`}
              </span>
              <span className="text-xs font-semibold text-brand-700">{brand.name}</span>
            </div>
            <h4 className="mt-1 font-bold text-ink">{creative.headline}</h4>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink">Legenda e hashtags prontas</span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
              >
                {copied ? <Check className="size-3.5 text-brand-600" /> : <Copy className="size-3.5" />}
                {copied ? 'Copiado!' : 'Copiar texto'}
              </button>
            </div>
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-line bg-white p-4 text-sm leading-relaxed whitespace-pre-line text-slate-700 scroll-thin">
              {creative.caption}
              <div className="mt-3 font-semibold text-brand-700">{creative.hashtags.join(' ')}</div>
            </div>
          </div>

          {/* Botões de Ação de Publicação */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Button variant="primary" onClick={handleCopy} className="w-full">
              <Copy className="size-4" /> Copiar legenda completa
            </Button>
            <Button variant="secondary" onClick={handleDownload} loading={downloading} className="w-full">
              <Download className="size-4" /> Baixar arte PNG (1080px)
            </Button>
            <a
              href={links.instagramCreate}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-slate-300 hover:bg-slate-50"
            >
              <InstagramIcon className="size-4" /> Publicar no Instagram Web <ExternalLink className="size-3.5 text-slate-400" />
            </a>
            <a
              href={links.whatsAppShare}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              <MessageCircle className="size-4 text-emerald-600" /> Enviar no WhatsApp <ExternalLink className="size-3.5 text-emerald-400" />
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-ink"
            >
              <Share2 className="size-3.5" /> Compartilhar do dispositivo
            </button>
            {scheduleAction && (
              <Button size="sm" variant="soft" onClick={scheduleAction}>
                <CalendarClock className="size-4" /> Agendar no Calendário
              </Button>
            )}
          </div>
        </div>

        {/* Coluna Direita: Melhores Horários + Checklist do Social Media */}
        <div className="space-y-5">
          {/* Horários Recomendados */}
          <Card className="border-brand-200 bg-brand-50/50 p-4">
            <div className="flex items-center gap-2 font-bold text-brand-900">
              <Clock className="size-4 text-brand-700" />
              <span>Melhores horários para {brand.segment}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tips.bestHours.map((h) => (
                <span
                  key={h}
                  className="rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-bold text-brand-800 shadow-sm"
                >
                  {h}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-xs text-brand-800">
              <b>Melhores dias:</b> {tips.bestDays.join(', ')}.
            </p>
            <p className="mt-1 text-xs text-brand-700">
              <b>Ritmo sugerido:</b> {tips.frequency}.
            </p>
          </Card>

          {/* Checklist de Publicação */}
          <Card className="p-4">
            <h4 className="text-sm font-bold text-ink">Checklist de Publicação</h4>
            <p className="mt-0.5 text-xs text-slate-500">Passo a passo para garantir o máximo de alcance e engajamento:</p>
            <div className="mt-3 space-y-2">
              {[
                { k: 'arte', label: 'Arte baixada na resolução ideal (1080px)' },
                { k: 'legenda', label: 'Legenda copiada com CTA e hashtags' },
                { k: 'local', label: `Marcar a localização (${brand.city || 'sua cidade'}) no Instagram` },
                { k: 'stories', label: 'Repostar o post nos Stories com sticker ou enquete' },
              ].map(({ k, label }) => {
                const on = checkedSteps[k]
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleCheck(k)}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs font-medium transition',
                      on ? 'border-brand-300 bg-brand-50 text-brand-900' : 'border-line text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cx(
                        'grid size-4 shrink-0 place-items-center rounded border',
                        on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white',
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1">{label}</span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Ideias de Stories Complementares */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center gap-2 font-bold text-ink">
              <Wand2 className="size-4 text-brand-600" />
              <span className="text-sm">Ganchos para Stories de hoje</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              {tips.storyHooks.slice(0, 3).map((hook, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand-600" />
                  <span>{hook}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  )
}

