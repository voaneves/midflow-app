import { Check } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { cx } from '../../../components/ui'
import { useApp } from '../../../lib/store'
import { Step1Briefing } from './Step1Briefing'
import { Step2Content } from './Step2Content'
import { Step3Style } from './Step3Style'
import { Step4Generate } from './Step4Generate'

const STEPS = [
  { n: 1, title: 'Briefing', sub: 'Informações da sua marca' },
  { n: 2, title: 'Conteúdo', sub: 'Tipo, tema e objetivo' },
  { n: 3, title: 'Estilo', sub: 'Voz, referências e formato' },
  { n: 4, title: 'Gerar', sub: 'IA cria seu conteúdo' },
]

export function Stepper({ step }: { step: number }) {
  const done = useApp((s) => s.done)
  const nav = useNavigate()
  const reachable = (n: number) => n === 1 || (n === 2 && done[1]) || (n === 3 && done[1] && done[2]) || (n === 4 && done[1] && done[2] && done[3])
  const cur = STEPS[step - 1]
  return (
    <>
    <ol className="flex items-center gap-2" aria-label="Etapas">
      {STEPS.map((s, i) => {
        const isDone = s.n < 4 && done[s.n as 1 | 2 | 3] && s.n !== step
        const active = s.n === step
        const can = reachable(s.n)
        return (
          <li key={s.n} className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              disabled={!can}
              onClick={() => nav(`/app/criar/${s.n}`)}
              className={cx('flex shrink-0 items-center gap-3 rounded-xl py-1 pr-2 text-left transition', can && !active && 'hover:bg-white')}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={cx(
                  'grid size-9 shrink-0 place-items-center rounded-full text-[15px] font-bold transition-colors duration-300 sm:size-10',
                  active && 'ring-4 ring-brand-100',
                  active || isDone ? 'bg-brand-700 text-white' : 'bg-slate-200 text-slate-500',
                )}
              >
                {s.n}
              </span>
              <span className="hidden leading-tight md:block">
                <span className={cx('block text-[15px] font-semibold whitespace-nowrap', active || isDone ? 'text-ink' : 'text-slate-600')}>{s.title}</span>
                <span className="hidden text-[12.5px] whitespace-nowrap text-slate-500 2xl:block">{s.sub}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="flex min-w-6 flex-1 items-center gap-2">
                {isDone && <Check className="size-4 shrink-0 text-brand-600" strokeWidth={3} />}
                <span className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-slate-200">
                  {isDone && <span className="absolute inset-0 origin-left rounded-full bg-brand-400 [animation:grow-x_.6s_var(--ease-out-soft)_both]" />}
                </span>
              </span>
            )}
          </li>
        )
      })}
    </ol>
    <p className="mt-3 text-sm text-slate-500 md:hidden">
      Etapa {step} de 4 · <b className="text-ink">{cur.title}</b> — {cur.sub.toLowerCase()}
    </p>
    </>
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
      <div className="mb-6">
        <Stepper step={n} />
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
