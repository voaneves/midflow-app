import { useNavigate } from 'react-router-dom'
import { SEOHead } from '../components/SEOHead'
import { Button, Logo } from '../components/ui'
import { useApp } from '../lib/store'

export function NotFound() {
  const nav = useNavigate()
  const user = useApp((s) => s.user)
  return (
    <div className="min-h-screen bg-white">
      <SEOHead title="Página não encontrada · MIDFLOW" description="O endereço que você tentou abrir não existe na MIDFLOW." />
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center">
          <Logo className="text-lg" />
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <p className="text-sm font-bold tracking-wide text-brand-700 uppercase">Erro 404</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Página não encontrada</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-slate-700">O endereço que você abriu não existe ou foi movido. Confira o link ou volte para um lugar conhecido.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={() => nav('/')}>
            Ir para a página inicial
          </Button>
          {user && (
            <Button size="lg" variant="secondary" onClick={() => nav('/app')}>
              Ir para o app
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
