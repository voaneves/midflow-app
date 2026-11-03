import { Home, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router-dom'
import { Button } from './ui'

const RELOAD_KEY = 'mf.chunk-reload-at'
/** A second automatic reload inside this window means the reload did not help: show the manual UI instead. */
const RELOAD_WINDOW_MS = 60_000

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError|Unable to preload CSS/i

/** True when the error comes from a code-split chunk that could not be loaded (typically a stale tab after a deploy). */
function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : typeof err === 'string' ? err : ''
  return CHUNK_ERROR.test(msg)
}

/**
 * Reloads the page once to pick up the latest deploy. Guarded with sessionStorage so a persistent
 * failure (offline, blocked asset) cannot cause a reload loop. Returns true when a reload was started.
 */
function reloadOnceForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (last && Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Storage unavailable: without a guard we must not auto-reload.
    return false
  }
  window.location.reload()
  return true
}

/** Root route error UI (render errors and failed lazy imports). */
export function RouteError() {
  const error = useRouteError()
  const chunk = isChunkLoadError(error)

  useEffect(() => {
    if (chunk) reloadOnceForChunkError()
    else console.error(error)
  }, [chunk, error])

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div role="alert" className="w-full max-w-md rounded-3xl border border-line bg-white p-6 text-center shadow-card sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{chunk ? 'Há uma nova versão da MIDFLOW' : 'Algo deu errado'}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {chunk
            ? 'Esta tela precisa ser atualizada para carregar. Recarregue a página para continuar de onde parou. Seus dados salvos neste navegador não são afetados.'
            : 'Não foi possível exibir esta tela. Recarregue a página para tentar novamente. Seus dados salvos neste navegador não são afetados.'}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => window.location.reload()} className="w-full sm:w-auto">
            <RefreshCw className="size-4" aria-hidden /> Recarregar
          </Button>
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-slate-300 hover:bg-slate-50"
          >
            <Home className="size-4" aria-hidden /> Ir para o início
          </Link>
        </div>
      </div>
    </main>
  )
}
