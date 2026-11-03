/**
 * In-memory stand-in for the Supabase PostgREST API and the Stripe REST API, installed as `fetch` in tests.
 * Supports the few filters the server uses: eq., gte., lt., in.(...), order, limit, offset, and the Prefer headers
 * resolution=merge-duplicates / ignore-duplicates and return=representation.
 */
export type Row = Record<string, any>

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict'])
const KEYS: Record<string, string> = {
  subscriptions: 'user_id',
  usage_counters: 'user_id+period',
  staff_members: 'user_id',
  stripe_events: 'id',
  profiles: 'id',
}

export interface FakeBackend {
  tables: Record<string, Row[]>
  /** Every request seen, for assertions: "METHOD host/path". */
  calls: string[]
  stripeRequests: { url: string; headers: Record<string, string>; body: string }[]
  /** Body served at /auth/v1/.well-known/jwks.json. */
  jwks: { keys: unknown[] }
  /** Arguments of the RPC calls worth asserting on. */
  rpcArgs: { fn: string; args: Row }[]
  /** HTTP status the fake answers to DELETE /v1/subscriptions/:id (default 200). */
  stripeCancelStatus: number
  /** HTTP status the fake answers to POST /v1/billing_portal/sessions (default 200). */
  stripePortalStatus: number
  /** HTTP status the fake answers to DELETE /auth/v1/admin/users/:id (default 200). */
  authDeleteStatus: number
  fetch: typeof fetch
  /** Seeds a user the way Supabase would: an auth.users row (the source of truth for e-mail) plus its profile. */
  addUser(u: { id: string; email: string; name?: string; confirmed?: boolean }): void
  reset(): void
}

export function createFakeBackend(): FakeBackend {
  const empty = () => ({
    staff_members: [] as Row[],
    review_requests: [] as Row[],
    review_events: [] as Row[],
    ai_events: [] as Row[],
    generations: [] as Row[],
    profiles: [] as Row[],
    subscriptions: [] as Row[],
    usage_counters: [] as Row[],
    stripe_events: [] as Row[],
    auth_users: [] as Row[],
  })
  const be: FakeBackend = {
    tables: empty(),
    calls: [],
    stripeRequests: [],
    rpcArgs: [],
    jwks: { keys: [] },
    stripeCancelStatus: 200,
    authDeleteStatus: 200,
    stripePortalStatus: 200,
    addUser({ id, email, name, confirmed = true }) {
      be.tables.auth_users.push({ id, email, email_confirmed_at: confirmed ? '2026-01-01T00:00:00Z' : null, deleted_at: null })
      be.tables.profiles.push({ id, email, name: name ?? null })
    },
    reset() {
      be.tables = empty()
      be.calls = []
      be.stripeRequests = []
      be.rpcArgs = []
      be.jwks = { keys: [] }
      be.stripeCancelStatus = 200
      be.authDeleteStatus = 200
      be.stripePortalStatus = 200
    },
    fetch: (async (input: Parameters<typeof fetch>[0], init: RequestInit = {}) => {
      const url = new URL(String(input))
      const method = (init.method || 'GET').toUpperCase()
      be.calls.push(`${method} ${url.host}${url.pathname}`)

      if (url.host === 'api.stripe.com') {
        const headers = Object.fromEntries(Object.entries((init.headers || {}) as Record<string, string>))
        be.stripeRequests.push({ url: String(input), headers, body: String(init.body ?? '') })
        if (method === 'DELETE' && url.pathname.startsWith('/v1/subscriptions/')) {
          return Response.json(be.stripeCancelStatus === 200 ? { id: url.pathname.split('/').pop(), status: 'canceled' } : { error: { message: 'boom' } }, { status: be.stripeCancelStatus })
        }
        if (url.pathname === '/v1/billing_portal/sessions') {
          if (be.stripePortalStatus !== 200) return Response.json({ error: { message: 'No configuration provided' } }, { status: be.stripePortalStatus })
          return Response.json({ id: 'bps_test_1', url: 'https://billing.stripe.com/p/session/test_1' })
        }
        return Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
      }
      if (!url.host.endsWith('.supabase.co')) return new Response('blocked in test', { status: 599 })

      if (method === 'GET' && url.pathname === '/auth/v1/.well-known/jwks.json') return Response.json(be.jwks)

      if (method === 'DELETE' && url.pathname.startsWith('/auth/v1/admin/users/')) {
        if (be.authDeleteStatus !== 200) return new Response('{}', { status: be.authDeleteStatus })
        // Mirrors the foreign keys: cascade on most tables, set null on review requests and AI rows.
        const uid = decodeURIComponent(url.pathname.split('/').pop() ?? '')
        for (const t of ['staff_members', 'subscriptions', 'usage_counters']) be.tables[t] = be.tables[t].filter((r) => r.user_id !== uid)
        be.tables.profiles = be.tables.profiles.filter((r) => r.id !== uid)
        be.tables.auth_users = be.tables.auth_users.filter((r) => r.id !== uid)
        for (const t of ['review_requests', 'ai_events']) for (const r of be.tables[t]) if (r.user_id === uid) r.user_id = null
        return Response.json({})
      }

      const path = url.pathname.replace('/rest/v1/', '')
      const body = init.body ? JSON.parse(String(init.body)) : null
      const prefer = String((init.headers as Record<string, string> | undefined)?.Prefer || '')

      if (path === 'rpc/increment_usage') {
        const key = body.p_user + '|' + body.p_period
        let row = be.tables.usage_counters.find((r) => r.user_id + '|' + r.period === key)
        if (!row) be.tables.usage_counters.push((row = { user_id: body.p_user, period: body.p_period, used: 0 }))
        row.used += Math.max(0, body.p_cost)
        return Response.json(row.used)
      }

      // Mirrors public.reserve_usage / public.refund_usage (the handler runs synchronously, so it is atomic like the SQL).
      if (path === 'rpc/reserve_usage') {
        const cost = Math.max(0, body.p_cost)
        let row = be.tables.usage_counters.find((r) => r.user_id === body.p_user && r.period === body.p_period)
        if ((row?.used ?? 0) + cost > body.p_limit) return Response.json(null)
        if (!row) be.tables.usage_counters.push((row = { user_id: body.p_user, period: body.p_period, used: 0 }))
        row.used += cost
        return Response.json(row.used)
      }
      if (path === 'rpc/refund_usage') {
        const row = be.tables.usage_counters.find((r) => r.user_id === body.p_user && r.period === body.p_period)
        if (!row) return Response.json(null)
        row.used = Math.max(0, row.used - Math.max(0, body.p_cost))
        return Response.json(row.used)
      }

      // Mirrors public.find_confirmed_user_by_email: matches auth.users (not the editable profile), confirmed and not deleted, up to 2 rows.
      if (path === 'rpc/find_confirmed_user_by_email') {
        const wanted = String(body.p_email).toLowerCase()
        const rows = be.tables.auth_users
          .filter((u) => String(u.email).toLowerCase() === wanted && u.email_confirmed_at && !u.deleted_at)
          .slice(0, 2)
          .map((u) => ({ id: u.id, email: u.email, name: be.tables.profiles.find((p) => p.id === u.id)?.name ?? null }))
        return Response.json(rows)
      }

      // Mirrors the advisory-locked staff functions (a single-threaded fake needs no lock).
      if (path === 'rpc/set_staff_role_guarded' || path === 'rpc/remove_staff_guarded') {
        const cur = be.tables.staff_members.find((r) => r.user_id === body.p_user)
        const admins = be.tables.staff_members.filter((r) => r.role === 'admin').length
        if (path === 'rpc/remove_staff_guarded') {
          if (!cur) return Response.json('not_found')
          if (cur.role === 'admin' && admins <= 1) return Response.json('last_admin')
          be.tables.staff_members = be.tables.staff_members.filter((r) => r !== cur)
          return Response.json('ok')
        }
        if (cur?.role === 'admin' && body.p_role !== 'admin' && admins <= 1) return Response.json('last_admin')
        if (cur) cur.role = body.p_role
        else be.tables.staff_members.push({ user_id: body.p_user, role: body.p_role, created_by: body.p_actor, created_at: new Date().toISOString() })
        return Response.json('ok')
      }

      // Mirrors public.apply_subscription_event: null keeps the stored value, stale events are ignored, unique ids are enforced.
      if (path === 'rpc/apply_subscription_event') {
        be.rpcArgs.push({ fn: 'apply_subscription_event', args: body })
        const conflict = (col: string, val: unknown) => val != null && be.tables.subscriptions.some((r) => r.user_id !== body.p_user && r[col] === val)
        if (conflict('stripe_customer_id', body.p_customer) || conflict('stripe_subscription_id', body.p_subscription)) {
          return Response.json({ code: '23505', message: 'duplicate key value violates unique constraint' }, { status: 409 })
        }
        const cur = be.tables.subscriptions.find((r) => r.user_id === body.p_user)
        if (cur && cur.last_event_at != null && body.p_event_created != null && cur.last_event_at > body.p_event_created) return Response.json(false)
        const next = {
          status: body.p_status,
          plan: body.p_plan ?? cur?.plan ?? null,
          stripe_customer_id: body.p_customer ?? cur?.stripe_customer_id ?? null,
          stripe_subscription_id: body.p_subscription ?? cur?.stripe_subscription_id ?? null,
          current_period_end: body.p_period_end ?? cur?.current_period_end ?? null,
          cancel_at_period_end: body.p_cancel ?? cur?.cancel_at_period_end ?? false,
          last_event_at: body.p_event_created ?? cur?.last_event_at ?? null,
          updated_at: new Date().toISOString(),
        }
        if (cur) Object.assign(cur, next)
        else be.tables.subscriptions.push({ user_id: body.p_user, ...next })
        return Response.json(true)
      }

      const table = be.tables[path]
      if (!table) return new Response('unknown table', { status: 404 })

      // Single-column conditions of an or=(col.is.null,col.eq.value) filter.
      const orMatches = (r: Row, expr: string) =>
        expr
          .slice(1, -1)
          .split(',')
          .some((cond) => {
            const [col, op, ...rest] = cond.split('.')
            const val = rest.join('.')
            return op === 'is' && val === 'null' ? r[col] == null : op === 'eq' ? String(r[col]) === val : false
          })
      const matches = (r: Row) => {
        for (const [k, v] of url.searchParams) {
          if (RESERVED.has(k)) continue
          if (k === 'or') {
            if (!orMatches(r, v)) return false
            continue
          }
          const [op, ...rest] = v.split('.')
          const val = rest.join('.')
          const cell = r[k]
          if (op === 'eq' && String(cell) !== val) return false
          if (op === 'gte' && !(String(cell) >= val)) return false
          if (op === 'lt' && !(String(cell) < val)) return false
          if (op === 'in' && !val.slice(1, -1).split(',').includes(String(cell))) return false
          if (op === 'is' && val === 'null' && cell != null) return false
        }
        return true
      }

      if (method === 'GET') {
        let rows = table.filter(matches)
        const order = url.searchParams.get('order')
        if (order) {
          const [col, dir] = order.split('.')
          rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (dir === 'desc' ? -1 : 1))
        }
        const offset = Number(url.searchParams.get('offset') || 0)
        const limit = Number(url.searchParams.get('limit') || 1000)
        const select = url.searchParams.get('select') || '*'
        const cols = select === '*' ? null : select.split(',')
        return Response.json(
          rows.slice(offset, offset + limit).map((r) => (cols ? Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, r[c]])) : { ...r })),
        )
      }

      if (method === 'POST') {
        const inserted: Row[] = []
        for (const input of Array.isArray(body) ? body : [body]) {
          const row: Row = { ...input }
          if (path === 'review_requests') Object.assign(row, { created_at: new Date().toISOString(), updated_at: row.updated_at ?? new Date().toISOString(), status: row.status ?? 'pending', admin_note: null, assigned_to: null, revised_outputs: null, resolved_at: null })
          if (path === 'review_events' || path === 'ai_events') row.created_at = row.created_at ?? new Date().toISOString()
          if (path === 'review_events') row.id = `ev_${be.tables.review_events.length + 1}`
          if (path === 'staff_members') row.created_at = row.created_at ?? new Date().toISOString()
          if (path === 'stripe_events') Object.assign(row, { received_at: row.received_at ?? new Date().toISOString(), processed_at: row.processed_at ?? null })
          const keyCols = (KEYS[path] || 'id').split('+')
          const existing = keyCols.every((c) => row[c] !== undefined) ? table.find((r) => keyCols.every((c) => r[c] === row[c])) : undefined
          if (existing) {
            if (prefer.includes('ignore-duplicates')) continue
            if (prefer.includes('merge-duplicates')) {
              Object.assign(existing, row)
              inserted.push(existing)
              continue
            }
            return new Response('duplicate', { status: 409 })
          }
          table.push(row)
          inserted.push(row)
        }
        return prefer.includes('return=representation') ? Response.json(inserted, { status: 201 }) : new Response(null, { status: 201 })
      }

      if (method === 'PATCH') {
        const hit = table.filter(matches)
        for (const r of hit) Object.assign(r, body)
        return prefer.includes('return=representation') ? Response.json(hit.map((r) => ({ ...r }))) : new Response(null, { status: 204 })
      }

      if (method === 'DELETE') {
        const keep = table.filter((r) => !matches(r))
        table.splice(0, table.length, ...keep)
        return new Response(null, { status: 204 })
      }
      return new Response('unsupported', { status: 405 })
    }) as typeof fetch,
  }
  return be
}
