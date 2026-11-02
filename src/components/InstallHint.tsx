import { useEffect, useRef } from 'react'
import { useApp } from '../lib/store'
import { toast } from './ui'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
  })
}

const KEY = 'mf.installHint.shown'
const seen = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}
const markSeen = () => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
}

/** "Adicionar à tela inicial" hint, shown once after the first successful generation. */
export function InstallHint() {
  const count = useApp((s) => s.generations.length)
  const prev = useRef(count)
  useEffect(() => {
    const was = prev.current
    prev.current = count
    if (!(was === 0 && count > 0) || seen()) return
    const standalone = matchMedia('(display-mode: standalone)').matches
    if (standalone) return
    markSeen()
    if (deferred) {
      const ev = deferred
      toast('Use a MIDFLOW como app: adicione à tela inicial.', 'info', {
        action: {
          label: 'Instalar',
          onClick: async () => {
            await ev.prompt()
            deferred = null
          },
        },
      })
    } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      toast('Dica: toque em Compartilhar → “Adicionar à Tela de Início” para usar a MIDFLOW como app.', 'info', { duration: 9000 })
    }
  }, [count])
  return null
}
