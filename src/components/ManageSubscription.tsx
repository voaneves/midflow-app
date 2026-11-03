import { CreditCard } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { manageSubscription } from '../lib/subscription'
import { Button } from './ui'

export function ManageSubscriptionButton({ children = 'Gerenciar assinatura', ...props }: Omit<ComponentProps<typeof Button>, 'onClick' | 'loading'>) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      {...props}
      loading={busy}
      onClick={async () => {
        setBusy(true)
        // On success the page navigates away, so the spinner stays until it unloads.
        if (!(await manageSubscription())) setBusy(false)
      }}
    >
      <CreditCard className="size-4" aria-hidden /> {children}
    </Button>
  )
}
