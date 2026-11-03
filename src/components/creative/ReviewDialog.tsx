import { Send } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, Field, FieldError, Input, Textarea, toast } from '../ui'
import { useApp } from '../../lib/store'
import { COMMENT_MAX, REVIEW_SENT_TOAST, sendReviewRequest } from '../../lib/reviews'
import type { Generation } from '../../lib/types'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Solicitar revisão": sends the current texts and briefing to the MIDFLOW team. Images are never sent. */
export function ReviewDialog({ open, onClose, gen }: { open: boolean; onClose: () => void; gen: Generation }) {
  // Remount the form each time the dialog opens, so it starts clean and prefilled.
  return (
    <Dialog open={open} onClose={onClose} title="Solicitar revisão" description="Nossa equipe analisa este conteúdo e responde por aqui." size="md">
      {open && <ReviewForm gen={gen} onClose={onClose} />}
    </Dialog>
  )
}

function ReviewForm({ gen, onClose }: { gen: Generation; onClose: () => void }) {
  const user = useApp((s) => s.user)
  const brand = useApp((s) => s.brand)
  const briefing = useApp((s) => s.briefing)
  const demo = user?.email === 'demo@midflow.com.br'
  const [comment, setComment] = useState('')
  const [email, setEmail] = useState(demo ? '' : (user?.email ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim() && !EMAIL.test(email.trim())) {
      setEmailError('Digite um e-mail válido ou deixe o campo vazio.')
      document.getElementById('rv-email')?.focus()
      return
    }
    setEmailError('')
    setError('')
    setBusy(true)
    const res = await sendReviewRequest({
      gen,
      brandName: brand.name,
      segment: String(briefing.segment || brand.segment || 'outro'),
      briefing,
      comment,
      contactEmail: email,
    })
    setBusy(false)
    if (res.ok) {
      toast(REVIEW_SENT_TOAST)
      onClose()
    } else setError(res.message)
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-4 px-5 py-4 md:px-6">
        <p className="text-sm text-fg-muted">
          Enviamos os textos desta versão (títulos, legendas e hashtags) e o seu briefing. As imagens não são enviadas.
          {gen.engine === 'template' || gen.engine === 'local' ? ' Este conteúdo foi montado com a versão padrão, sem IA, então a revisão é a melhor forma de deixá-lo no ponto.' : ''}
        </p>
        <Field label="O que você gostaria de melhorar?" id="rv-comment" hint="Opcional. Quanto mais detalhes, melhor.">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} max={COMMENT_MAX} rows={4} />
        </Field>
        <Field label="E-mail para contato" id="rv-email" hint="Opcional. Usado só para falar sobre este pedido." error={emailError}>
          <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div role="alert">{error && <FieldError>{error}</FieldError>}</div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end md:px-6">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={busy}>
          <Send className="size-4" aria-hidden /> Enviar pedido
        </Button>
      </div>
    </form>
  )
}
