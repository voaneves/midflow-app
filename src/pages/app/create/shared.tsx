import { ArrowLeft, Eye } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { ActionBar, Button, cx, Dialog, useIsDesktop } from '../../../components/ui'


export function Panel({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={cx('rounded-2xl border border-line bg-white p-4 shadow-card sm:p-6', className)}>
      {children}
    </section>
  )
}

export function PreviewPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-brand-100 bg-gradient-to-b from-[#f1fbf7] to-white p-4 sm:p-6', className)}>{children}</section>
}

export function SectionTitle({ children, hint, id }: { children: ReactNode; hint?: ReactNode; id?: string }) {
  return (
    <div className="mb-3">
      <h3 id={id} className="text-base font-bold text-ink">
        {children}
      </h3>
      {hint && <p className="mt-0.5 text-sm text-fg-subtle">{hint}</p>}
    </div>
  )
}

/**
 * Create-flow layout: the form on the left and a sticky live preview on the right from `lg`.
 * On phones/tablets the preview lives in a bottom sheet opened by a "Ver prévia" pill above the action bar.
 */
export function FlowLayout({ children, preview, previewTitle, previewAction }: { children: ReactNode; preview: ReactNode; previewTitle: string; previewAction?: ReactNode }) {
  const desktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const titleId = useId()
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
      <div className="min-w-0 pb-14 lg:pb-0">{children}</div>
      {desktop ? (
        <aside aria-labelledby={titleId} className="lg:sticky lg:top-[calc(var(--header-offset)+16px)] lg:max-h-[calc(100dvh-var(--header-offset)-32px)] lg:self-start lg:overflow-y-auto lg:rounded-2xl scroll-thin">
          <PreviewPanel>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <h2 id={titleId} className="text-title-sm font-bold">
                {previewTitle}
              </h2>
              {previewAction}
            </div>
            {preview}
          </PreviewPanel>
        </aside>
      ) : (
        <>
          <button
            type="button"
            data-hide-on-keyboard
            onClick={() => setOpen(true)}
            className="fixed bottom-[calc(var(--bottom-nav-h)+var(--action-bar-h)+12px)] left-1/2 z-30 inline-flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-pop"
          >
            <Eye className="size-4" aria-hidden /> Ver prévia
          </button>
          <Dialog open={open} onClose={() => setOpen(false)} title={previewTitle} headerAside={previewAction}>
            <div className="px-4 pb-6">{preview}</div>
          </Dialog>
        </>
      )}
    </div>
  )
}

/**
 * Sticky Voltar + primary action. When the step cannot continue, the primary stays focusable
 * (aria-disabled) and the reason is shown and announced instead of failing silently.
 */
export function FlowActions({
  onBack,
  backLabel = 'Voltar',
  primaryLabel,
  primaryIcon,
  onPrimary,
  blockedReason,
  onBlocked,
  loading,
  secondary,
}: {
  onBack?: () => void
  backLabel?: string
  primaryLabel: string
  primaryIcon?: ReactNode
  onPrimary: () => void
  blockedReason?: string
  onBlocked?: () => void
  loading?: boolean
  secondary?: ReactNode
}) {
  const hintId = useId()
  return (
    <ActionBar hint={blockedReason ? <span id={hintId} role="status">{blockedReason}</span> : undefined}>
      {onBack && (
        <Button variant="secondary" size="lg" onClick={onBack} className="flex-none px-3! sm:flex-1 sm:px-6! lg:flex-none">
          <ArrowLeft className="size-5" aria-hidden /> <span className="truncate">{backLabel}</span>
        </Button>
      )}
      {secondary}
      <Button
        size="lg"
        loading={loading}
        aria-disabled={blockedReason ? true : undefined}
        aria-describedby={blockedReason ? hintId : undefined}
        onClick={() => (blockedReason ? onBlocked?.() : onPrimary())}
        className={cx('min-w-0 flex-1 px-4! sm:flex-[2] sm:px-6! lg:flex-none', blockedReason && 'opacity-60 shadow-none')}
      >
        <span className="truncate">{primaryLabel}</span> {primaryIcon}
      </Button>
    </ActionBar>
  )
}
