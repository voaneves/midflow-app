import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './hooks'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'soft' | 'danger' | 'danger-solid' | 'glass'

const variants: Record<ButtonVariant, string> = {
  primary: 'btn-sheen bg-brand-700 text-white hover:bg-brand-800 shadow-cta disabled:bg-slate-300 disabled:text-slate-700 disabled:shadow-none',
  secondary: 'bg-white text-ink border border-line hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-500',
  ghost: 'text-slate-700 hover:bg-slate-100 hover:text-ink disabled:text-slate-500',
  dark: 'bg-ink text-white hover:bg-ink-3 disabled:bg-slate-300 disabled:text-slate-700',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100 disabled:text-slate-500',
  danger: 'bg-white text-danger border border-red-200 hover:bg-danger-soft',
  'danger-solid': 'bg-danger text-white hover:bg-red-800',
  glass: 'bg-white/15 text-white hover:bg-white/25 backdrop-blur',
}

/** Heights: sm 40 · md 44 · lg 52 px. */
const sizes = {
  sm: 'h-10 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-xl',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: keyof typeof sizes
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none active:scale-[.98] disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

const iconSizes = { sm: 'size-10', md: 'size-11', lg: 'size-12' }
const iconVariants = {
  ghost: 'text-slate-700 hover:bg-slate-100 hover:text-ink',
  secondary: 'border border-line bg-white text-slate-700 hover:bg-slate-50',
  glass: 'bg-black/40 text-white hover:bg-black/60',
  dark: 'bg-ink text-white hover:bg-ink-3',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
}

/** Icon-only button: the accessible name is mandatory; the hit area is ≥ 40 px even when the glyph is small. */
export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  className,
  children,
  type = 'button',
  badge,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  label: string
  size?: keyof typeof iconSizes
  variant?: keyof typeof iconVariants
  badge?: ReactNode
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      type={type}
      aria-label={label}
      {...rest}
      className={cx(
        'relative inline-grid shrink-0 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40',
        iconSizes[size],
        iconVariants[variant],
        className,
      )}
    >
      {children}
      {badge}
    </button>
  )
}
