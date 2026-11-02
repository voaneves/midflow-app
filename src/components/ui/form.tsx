import { AlertCircle, Check } from 'lucide-react'
import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx } from './hooks'

/* ---------- Field: label + control + hint + error, wired for assistive tech ---------- */
interface FieldState {
  id: string
  describedBy?: string
  invalid?: boolean
  required?: boolean
}
const FieldCtx = createContext<FieldState | null>(null)

/** Props a control inherits from the surrounding <Field>. Explicit props win. */
function useFieldProps(p: { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: unknown; required?: boolean }) {
  const f = useContext(FieldCtx)
  const describedBy = [f?.describedBy, p['aria-describedby']].filter(Boolean).join(' ') || undefined
  const invalid = p['aria-invalid'] === true || p['aria-invalid'] === 'true' || !!f?.invalid
  return {
    id: p.id ?? f?.id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
    'aria-required': p.required || f?.required || undefined,
  }
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function Field({
  label,
  id,
  required,
  hint,
  error,
  children,
  className,
  labelAside,
}: {
  label: ReactNode
  id?: string
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
  /** Optional content on the right of the label row (e.g. a small action). */
  labelAside?: ReactNode
}) {
  const auto = useId()
  const fid = id ?? `f${auto.replace(/:/g, '')}`
  const hintId = hint ? `${fid}-hint` : undefined
  const errId = error ? `${fid}-err` : undefined
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label htmlFor={fid} className="text-sm font-semibold text-ink">
          {label}
          {required && (
            <span className="ml-1 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
        {labelAside}
      </div>
      <FieldCtx.Provider value={{ id: fid, describedBy: [hintId, errId].filter(Boolean).join(' ') || undefined, invalid: !!error, required }}>
        {children}
      </FieldCtx.Provider>
      {hint && (
        <p id={hintId} className="mt-1.5 text-caption text-fg-subtle">
          {hint}
        </p>
      )}
      {error && <FieldError id={errId}>{error}</FieldError>}
    </div>
  )
}

/** Legacy label (kept for simple, standalone controls). Prefer <Field>. */
export function Label({ children, required, hint, htmlFor, id }: { children: ReactNode; required?: boolean; hint?: string; htmlFor?: string; id?: string }) {
  return (
    <label htmlFor={htmlFor} id={id} className="mb-2 flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold text-ink">
      {children}
      {required && (
        <span className="text-danger" aria-hidden>
          *
        </span>
      )}
      {hint && <span className="font-normal text-fg-subtle">{hint}</span>}
    </label>
  )
}

/* ---------- Text controls (16 px on phones → no iOS zoom) ---------- */
export const fieldBase =
  'w-full rounded-xl border border-line bg-white px-3.5 text-base text-ink transition sm:text-sm focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/25 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20 disabled:bg-slate-50 disabled:text-slate-600'

export function Input({ className, icon, ref, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; ref?: Ref<HTMLInputElement> }) {
  const f = useFieldProps(rest)
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-500" aria-hidden>
          {icon}
        </span>
      )}
      <input ref={ref} {...rest} {...f} className={cx(fieldBase, 'h-11', icon && 'pl-10', className)} />
    </div>
  )
}

export function Textarea({
  className,
  max,
  value,
  ref,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { max?: number; value: string; ref?: Ref<HTMLTextAreaElement> }) {
  const f = useFieldProps(rest)
  const left = max ? max - value.length : 0
  const near = !!max && left <= Math.max(10, Math.round(max * 0.1))
  return (
    <div>
      <textarea ref={ref} {...rest} {...f} value={value} maxLength={max} className={cx(fieldBase, 'min-h-[96px] resize-y py-3 leading-relaxed', className)} />
      {max && (
        <div className={cx('mt-1 text-right text-caption tabular-nums', near ? 'font-semibold text-warning' : 'text-fg-subtle')}>
          <span aria-hidden>
            {value.length}/{max}
          </span>
          {/* announced politely only when close to the limit */}
          <span className="sr-only" aria-live="polite">
            {near ? `Restam ${left} caracteres` : ''}
          </span>
        </div>
      )}
    </div>
  )
}

export function Select({ className, children, ref, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  const f = useFieldProps(rest)
  return (
    <select
      ref={ref}
      {...rest}
      {...f}
      className={cx(
        fieldBase,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%234a585d%22 stroke-width=%222%22><path d=%22m4 6 4 4 4-4%22/></svg>')] bg-[right_12px_center] bg-no-repeat pr-10",
        className,
      )}
    >
      {children}
    </select>
  )
}

/* ---------- Checkable controls ---------- */
const focusRing = 'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid'

export function CheckBadge({ on, shape = 'square' }: { on: boolean; shape?: 'square' | 'round' }) {
  return (
    <span
      aria-hidden
      className={cx(
        'grid size-5 shrink-0 place-items-center border-2 transition',
        shape === 'round' ? 'rounded-full' : 'rounded-md',
        on ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-400 bg-white',
      )}
    >
      {on && <Check className="size-3.5 animate-pop" strokeWidth={3} />}
    </span>
  )
}

export function Checkbox({ checked, onChange, label, className, id, describedBy }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string; id?: string; describedBy?: string }) {
  return (
    <label className={cx('inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg text-sm text-slate-800 select-none', focusRing, className)}>
      <input id={id} type="checkbox" className="sr-only" checked={checked} aria-describedby={describedBy} onChange={(e) => onChange(e.target.checked)} />
      <CheckBadge on={checked} />
      {label}
    </label>
  )
}

/** Toggle chip (aria-pressed). For a group of exclusive/multiple options prefer <ChoiceGroup variant="chip">. */
export function Chip({ active, onClick, children, icon, className }: { active?: boolean; onClick?: () => void; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition',
        active ? 'border-brand-400 bg-brand-50 text-brand-900' : 'border-line bg-white text-slate-700 hover:border-slate-300',
        className,
      )}
    >
      {active ? (
        <span className="grid size-4 place-items-center rounded-full bg-brand-700 text-white animate-pop" aria-hidden>
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : (
        icon
      )}
      {children}
    </button>
  )
}

/** On/off switch (role="switch"). The whole row is the hit area. */
export function Toggle({ on, onChange, label, description, className }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; className?: string }) {
  const id = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-describedby={description ? `${id}-d` : undefined}
      onClick={() => onChange(!on)}
      className={cx('flex min-h-11 w-full items-center gap-3 text-left text-sm font-semibold text-ink', className)}
    >
      <span className="min-w-0 flex-1">
        {label}
        {description && (
          <span id={`${id}-d`} className="mt-0.5 block text-caption font-normal text-fg-subtle">
            {description}
          </span>
        )}
      </span>
      <span aria-hidden className={cx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-brand-700' : 'bg-slate-400')}>
        <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
      </span>
    </button>
  )
}

/* ---------- ChoiceGroup: radio / checkbox groups built on native inputs ----------
   Native radios give arrow-key navigation and a single tab stop for free; checkboxes are one tab stop each
   (WAI-ARIA APG checkbox group). Selected state is shown with a check mark + border, never by color alone. */
export interface ChoiceOption<T extends string> {
  value: T
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** image/visual on top (variant="media") */
  media?: ReactNode
  disabled?: boolean
}

type ChoiceProps<T extends string> = {
  legend: ReactNode
  legendHidden?: boolean
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  options: ChoiceOption<T>[]
  variant?: 'card' | 'chip' | 'segmented' | 'media'
  className?: string
  optionClassName?: string
  id?: string
} & ({ type?: 'radio'; value: T | '' | null; onChange: (v: T) => void } | { type: 'checkbox'; value: T[]; onChange: (v: T[]) => void })

const listClass = {
  card: 'grid gap-3 sm:grid-cols-2',
  chip: 'flex flex-wrap gap-2',
  segmented: 'flex rounded-xl bg-slate-100 p-1',
  media: 'grid grid-cols-2 gap-3',
}

export function ChoiceGroup<T extends string>(props: ChoiceProps<T>) {
  const { legend, legendHidden, hint, error, required, options, variant = 'card', className, optionClassName } = props
  const auto = useId()
  const base = props.id ?? `cg${auto.replace(/:/g, '')}`
  const name = `${base}-n`
  const hintId = hint ? `${base}-hint` : undefined
  const errId = error ? `${base}-err` : undefined
  const isOn = (v: T) => (props.type === 'checkbox' ? props.value.includes(v) : props.value === v)
  const change = (v: T) => {
    if (props.type === 'checkbox') props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v])
    else props.onChange(v)
  }
  return (
    <fieldset id={base} aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined} className="min-w-0" tabIndex={-1}>
      <legend className={cx(legendHidden ? 'sr-only' : 'mb-2 text-sm font-semibold text-ink')}>
        {legend}
        {required && (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        )}
      </legend>
      {hint && (
        <p id={hintId} className="-mt-1 mb-2.5 text-caption text-fg-subtle">
          {hint}
        </p>
      )}
      {/* card/media layouts are replaced by a custom className (grids vs. carousels); chip/segmented extend it */}
      <div className={variant === 'card' || variant === 'media' ? (className ?? listClass[variant]) : cx(listClass[variant], className)}>
        {options.map((o) => {
          const on = isOn(o.value)
          const input = (
            <input
              type={props.type === 'checkbox' ? 'checkbox' : 'radio'}
              name={name}
              value={o.value}
              checked={on}
              disabled={o.disabled}
              required={required && props.type !== 'checkbox'}
              onChange={() => change(o.value)}
              className="sr-only"
            />
          )
          const indicator = <CheckBadge on={on} shape={props.type === 'checkbox' ? 'square' : 'round'} />
          if (variant === 'chip')
            return (
              <label
                key={o.value}
                className={cx(
                  'inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition select-none',
                  on ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-line bg-white text-slate-700 hover:border-slate-300',
                  focusRing,
                  optionClassName,
                )}
              >
                {input}
                {on ? (
                  <span className="grid size-4 place-items-center rounded-full bg-brand-700 text-white" aria-hidden>
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : (
                  o.icon
                )}
                {o.label}
              </label>
            )
          if (variant === 'segmented')
            return (
              <label
                key={o.value}
                className={cx(
                  'flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-center text-sm font-semibold transition select-none',
                  on ? 'bg-white text-brand-800 shadow-sm ring-1 ring-brand-200' : 'text-slate-700 hover:text-ink',
                  focusRing,
                  optionClassName,
                )}
              >
                {input}
                {o.icon}
                {o.label}
              </label>
            )
          if (variant === 'media')
            return (
              <label
                key={o.value}
                className={cx(
                  'group relative block cursor-pointer overflow-hidden rounded-xl border-2 bg-white text-left transition select-none',
                  on ? 'border-brand-600' : 'border-line hover:border-slate-300',
                  focusRing,
                  optionClassName,
                )}
              >
                {input}
                {o.media}
                <span className="absolute top-2 right-2 rounded-full bg-white/90 p-0.5 shadow">{indicator}</span>
                <span className="block p-2.5">
                  <span className={cx('block text-sm leading-tight font-semibold', on && 'text-brand-900')}>{o.label}</span>
                  {o.description && <span className="mt-0.5 block text-caption text-fg-subtle">{o.description}</span>}
                </span>
              </label>
            )
          return (
            <label
              key={o.value}
              className={cx(
                'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 text-left transition select-none',
                on ? 'border-brand-600 bg-brand-50/60' : 'border-line bg-white hover:border-slate-300',
                o.disabled && 'cursor-not-allowed opacity-50',
                focusRing,
                optionClassName,
              )}
            >
              {input}
              {o.icon}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-sm font-semibold text-ink">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-caption text-fg-subtle">{o.description}</span>}
              </span>
              {indicator}
            </label>
          )
        })}
      </div>
      {error && <FieldError id={errId}>{error}</FieldError>}
    </fieldset>
  )
}
