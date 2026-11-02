import { Check, CloudCheck, Loader2 } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { cx, useSavedIndicator } from '../../../components/ui'
import { useApp } from '../../../lib/store'
import { Step1Briefing } from './Step1Briefing'
import { Step2Content } from './Step2Content'
import { Step3Style } from './Step3Style'
import { Step4Generate } from './Step4Generate'

export const STEPS = [
  { n: 1, title: 'Briefing', sub: 'Informações da sua marca' },
  { n: 2, title: 'Conteúdo', sub: 'Tipo, tema e objetivo' },
  { n: 3, title: 'Estilo', sub: 'Visual, tom e formato' },
  { n: 4, title: 'Gerar', sub: 'A IA cria seu conteúdo' },
]

/** Phones: "Etapa 2 de 4 · Conteúdo" + segmented bar. Desktop: labelled steps, reachable ones are links. */
export function Stepper({ step }: { step: number }) {
  const done = useApp((s) => s.done)
  const reachable = (n: number) => n === 1 || (n === 2 && done[1]) || (n === 3 && done[1] && done[2]) || (n === 4 && done[1] && done[2] && done[3])
  const isDone = (n: number) => n < 4 && done[n as 1 | 2 | 3] && n !== step
  const cur = STEPS[step - 1]
  return (
    <nav aria-label="Etapas da criação">
      {/* compact (phones/tablets) */}
      <div className="lg:hidden">
        <p className="text-sm text-fg-subtle">
          Etapa {step} de 4 · <b className="text-ink">{cur.title}</b>
        </p>
        <ol className="mt-2 grid grid-cols-4 gap-1.5">
          {STEPS.map((s) => (
            <li key={s.n}>
              {reachable(s.n) && s.n !== step ? (
                <Link to={`/app/criar/${s.n}`} className="block py-2" aria-label={`Etapa ${s.n}: ${s.title}${isDone(s.n) ? ' (concluída)' : ''}`}>
                  <span className={cx('block h-1.5 rounded-full', s.n <= step || isDone(s.n) ? 'bg-brand-600' : 'bg-slate-200')} />
                </Link>
              ) : (
                <span className="block py-2" aria-current={s.n === step ? 'step' : undefined}>
                  <span className="sr-only">
                    Etapa {s.n}: {s.title}
                    {s.n === step ? ' (atual)' : ' (bloqueada)'}
                  </span>
                  <span aria-hidden className={cx('block h-1.5 rounded-full', s.n < step ? 'bg-brand-600' : s.n === step ? 'bg-brand-400' : 'bg-slate-200')} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* labelled (desktop) */}
      <ol className="hidden items-center gap-2 lg:flex">
        {STEPS.map((s, i) => {
          const active = s.n === step
          const can = reachable(s.n)
          const content = (
            <>
              <span
                aria-hidden
                className={cx(
                  'grid size-10 shrink-0 place-items-center rounded-full text-base font-bold transition-colors',
                  active && 'ring-4 ring-brand-100',
                  active || isDone(s.n) ? 'bg-brand-700 text-white' : 'bg-slate-200 text-slate-600',
                )}
              >
                {isDone(s.n) ? <Check className="size-5" strokeWidth={3} /> : s.n}
              </span>
              <span className="leading-tight">
                <span className={cx('block text-base font-semibold whitespace-nowrap', active || isDone(s.n) ? 'text-ink' : 'text-slate-600')}>{s.title}</span>
                <span className="hidden text-xs whitespace-nowrap text-fg-subtle 2xl:block">{s.sub}</span>
                <span className="sr-only">{active ? ' (atual)' : isDone(s.n) ? ' (concluída)' : can ? '' : ' (bloqueada)'}</span>
              </span>
            </>
          )
          return (
            <li key={s.n} className="flex min-w-0 flex-1 items-center gap-3">
              {can && !active ? (
                <Link to={`/app/criar/${s.n}`} className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl py-1 pr-2 transition hover:bg-white">
                  {content}
                </Link>
              ) : (
                <span aria-current={active ? 'step' : undefined} className={cx('flex min-h-11 shrink-0 items-center gap-3 py-1 pr-2', !can && 'opacity-70')}>
                  {content}
                </span>
              )}
              {i < STEPS.length - 1 && (
                <span aria-hidden className="relative h-[2px] min-w-6 flex-1 overflow-hidden rounded-full bg-slate-200">
                  {isDone(s.n) && <span className="absolute inset-0 origin-left rounded-full bg-brand-500 [animation:grow-x_.6s_var(--ease-out-soft)_both]" />}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** "Rascunho salvo" — the draft lives in the persisted store, so every change is already saved. */
function DraftStatus() {
  const key = useApp((s) => JSON.stringify([s.briefing, s.content, s.style]))
  const state = useSavedIndicator(key)
  return (
    <p role="status" className="flex h-6 items-center gap-1.5 text-xs font-medium text-fg-subtle">
      {state === 'saving' ? (
        <>
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> Salvando…
        </>
      ) : state === 'saved' ? (
        <>
          <CloudCheck className="size-4 text-brand-700" aria-hidden /> Rascunho salvo
        </>
      ) : null}
    </p>
  )
}

export function Create() {
  const { step } = useParams()
  const n = Number(step)
  const done = useApp((s) => s.done)
  if (![1, 2, 3, 4].includes(n)) return <Navigate to="/app/criar/1" replace />
  if (n === 2 && !done[1]) return <Navigate to="/app/criar/1" replace />
  if (n === 3 && !(done[1] && done[2])) return <Navigate to={done[1] ? '/app/criar/2' : '/app/criar/1'} replace />
  if (n === 4 && !(done[1] && done[2] && done[3])) return <Navigate to="/app/criar/1" replace />
  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-4 flex items-start gap-4 lg:mb-6">
        <div className="min-w-0 flex-1">
          <Stepper step={n} />
        </div>
        {n < 4 && (
          <div className="shrink-0 pt-0 lg:pt-2.5">
            <DraftStatus />
          </div>
        )}
      </div>
      <div key={n} className="animate-rise">
        {n === 1 && <Step1Briefing />}
        {n === 2 && <Step2Content />}
        {n === 3 && <Step3Style />}
        {n === 4 && <Step4Generate />}
      </div>
    </div>
  )
}
