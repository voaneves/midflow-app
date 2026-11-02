import { lazy, Suspense, type ComponentProps } from 'react'
import { Spinner } from '../ui'

const Editor = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })))

/** Loads the editor code only when it is first opened. */
export function LazyEditor(props: ComponentProps<typeof Editor>) {
  if (!props.open) return null
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40">
          <Spinner label="Abrindo editor" className="size-8 text-white" />
        </div>
      }
    >
      <Editor {...props} />
    </Suspense>
  )
}
