import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { toast } from './components/ui'

/**
 * Clickjacking guard. The static host cannot send X-Frame-Options / frame-ancestors, so the app refuses to run inside
 * another page: it shows a short notice with a link that opens it in its own tab (this covers #/painel and the whole app).
 * Comparing the window references is allowed even for a cross-origin parent.
 */
function isFramed(): boolean {
  try {
    return window.top !== window.self
  } catch {
    return true
  }
}

function showFramedNotice(root: HTMLElement) {
  const box = document.createElement('main')
  box.style.cssText = 'font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;text-align:center;color:CanvasText;background:Canvas'
  const title = document.createElement('h1')
  title.textContent = 'Abra o MIDFLOW em uma nova aba'
  title.style.cssText = 'font-size:1.25rem;margin:0 0 .5rem'
  const text = document.createElement('p')
  text.textContent = 'Por segurança, o MIDFLOW não funciona dentro de outro site.'
  const link = document.createElement('a')
  link.href = window.location.href
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = 'Abrir em uma nova aba'
  link.style.cssText = 'display:inline-block;margin-top:1rem;padding:.75rem 1.25rem;border-radius:.75rem;background:#0f766e;color:#fff;font-weight:600;text-decoration:none'
  box.append(title, text, link)
  root.replaceChildren(box)
}

const framed = isFramed()
const rootEl = document.getElementById('root')!
if (framed) {
  showFramedNotice(rootEl)
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

/** Announces that a newer version is ready; "Atualizar" reloads onto it. Shown once per page load. */
let updateAnnounced = false
function announceUpdate(activate?: () => void) {
  if (updateAnnounced) return
  updateAnnounced = true
  toast('Nova versão disponível', 'info', {
    duration: 30_000,
    action: {
      label: 'Atualizar',
      onClick: () => {
        if (activate) activate()
        else window.location.reload()
      },
    },
  })
}

// Offline app shell (production only; the single-file demo has no sw.js).
if (!framed && import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Only a page that was already controlled can be "updated" (the first visit just installs the worker).
    const hadController = !!navigator.serviceWorker.controller

    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // Asks a newer worker to take over (a no-op if it already did), then reloads onto it.
        const activate = (worker: ServiceWorker) => () => {
          if (worker.state === 'activated') {
            window.location.reload()
            return
          }
          navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
          worker.postMessage({ type: 'SKIP_WAITING' })
        }
        const watch = (worker: ServiceWorker | null) => {
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate(activate(worker))
          })
        }
        if (reg.waiting && navigator.serviceWorker.controller) announceUpdate(activate(reg.waiting))
        reg.addEventListener('updatefound', () => watch(reg.installing))
        // Check for a new deploy when a long-lived tab becomes visible again.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => undefined)
        })
      })
      .catch(() => {
        /* unsupported context (e.g. private mode): the app works without it */
      })

    // The current worker activates itself right after install (skipWaiting): the new version is already in control.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) announceUpdate()
    })
  })
}
