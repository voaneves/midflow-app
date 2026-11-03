import { toast } from '../components/ui/toast-store'
import { isBillingEnabled, openBillingPortal } from './backend'
import { useApp } from './store'

/** True for a signed-in cloud account with billing enabled and an active paid plan (the only case a Stripe portal exists). */
export function useCanManageSubscription(): boolean {
  const accountId = useApp((s) => s.user?.id)
  const plan = useApp((s) => s.plan)
  return isBillingEnabled() && !!accountId && plan !== 'start'
}

/** Opens the Stripe Customer Portal in this tab. Returns false (after an error toast) when it could not be opened. */
export async function manageSubscription(): Promise<boolean> {
  const res = await openBillingPortal()
  if (res.ok) {
    window.location.assign(res.url)
    return true
  }
  toast(res.error, 'error')
  return false
}
