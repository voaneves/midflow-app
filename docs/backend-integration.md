# Backend integration: auth, persistence and billing

Phase A shipped the building blocks (client adapters, JWT / Stripe / PostgREST helpers, schema). Phase B wires them into the API: billing routes, quotas, review queue, staff roles and AI health. Everything is optional: with no keys configured the app behaves exactly as before (localStorage persistence, "Ver demonstração", Plans labelled "simulação").

Hosting model: static front end on GitHub Pages (`HashRouter`, base `/midflow-app/`) and a Cloudflare Worker that serves `https://voaneves.com/midflow-app/api/*` by wrapping `server/routes.ts`. Auth and database: Supabase. Payments: Stripe Checkout plus webhooks.

## What exists

| Path | Purpose |
|---|---|
| `src/lib/backend/types.ts` | `AuthProvider` and `Repository` interfaces |
| `src/lib/backend/local.ts` | localStorage-era adapter: any credentials accepted, repository is a no-op (the persisted Zustand store is the database) |
| `src/lib/backend/supabase.ts` | Supabase adapter: email + password auth, brands / generations / library / plan reads. `@supabase/supabase-js` is loaded with a dynamic import, so it is a separate lazy chunk |
| `src/lib/backend/index.ts` | `getBackend()` factory (Supabase when `VITE_SUPABASE_*` are set, otherwise local), `isBillingEnabled()`, `startCheckout()`, `authHeaders()` |
| `src/lib/backend/sync.ts` | Hydrates the store from the account and pushes brand / library changes (debounced diff) |
| `src/lib/backend/planLimits.ts` | Plan limits shared by browser and API (tested against `PLANS` in `src/lib/data.ts`) |
| `src/lib/store.ts` | New actions `authSignIn`, `authSignUp`, `refreshPlan`; `logout` signs out of the backend and wipes account data from the device |
| `server/auth.ts` | `verifyAccessToken` (ES256 / RS256 through the project JWKS, HS256 only with a configured secret), `verifySupabaseJwt` (legacy HS256), `getBearerToken`, `authenticate`. Web Crypto only |
| `server/billing.ts` | `createCheckoutSession`, `verifyStripeWebhook`, `handleStripeEvent`, `effectivePlan`, `checkQuota`, `generationCost`, `usagePeriod`, `billingConfigFromEnv` |
| `server/db/supabase.ts` | Service-role PostgREST helpers: `getSubscription`, `applySubscriptionUpdate`, `getUsage`, `incrementUsage`, `claimStripeEventState` / `markStripeEventProcessed` / `releaseStripeEvent`, `findUserByEmail` (RPC), `setStaffRoleGuarded` / `removeStaffGuarded` (RPC), `DbError` |
| `supabase/migrations/20261103000000_init.sql` | Schema and RLS |
| `supabase/migrations/20261103020000_security_hardening.sql` | Column-level grants on `profiles`, e-mail sync, service-role-only RPCs, event ordering, size and row limits (see "Security hardening") |
| `supabase/tests/rls.sql` | pgTAP assertions for the access model (not run in CI) |
| `src/pages/app/Plans.tsx` | Calls the checkout API when billing is live, otherwise keeps the simulation |

Demo mode and local logins have no `user.id`, so they never sync or call billing. Brands with id `brand_aurora` (the demo brand) are never uploaded.

## Environment variables

Public (build time, GitHub Pages repository **variables**, not secrets; safe in the bundle):

| Name | Example | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://abcd.supabase.co` | |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` (or legacy `eyJ...`) | The publishable (legacy: anon) key is public by design; Row Level Security protects data |
| `VITE_BILLING_ENABLED` | `true` | Shows real checkout in Plans. Needs the two above and a signed-in account |

Server only (Worker secrets via `wrangler secret put`, or `.env` for `npm start`). Never prefix with `VITE_`:

| Name | Purpose |
|---|---|
| `SUPABASE_URL` | Same project URL, used by `server/db/supabase.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`, or legacy `service_role` `eyJ...`). Writes subscriptions / usage; bypasses RLS. Sent in both the `apikey` and `Authorization` headers, so either format works |
| `SUPABASE_JWT_SECRET` | Optional. Only for projects still on the legacy HS256 secret. With asymmetric signing keys (ES256 / RS256) leave it unset: tokens are verified against `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` |
| `TRUST_PROXY` | How to read the client IP for rate limits. `cloudflare` (Worker: only `CF-Connecting-IP`), a number N (the Nth entry from the right of `X-Forwarded-For`, N = proxies in front of the server), unset (socket address). `true` still works as 1 and logs a warning |
| `STRIPE_SECRET_KEY` | `sk_live_...` / `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` of the webhook endpoint |
| `STRIPE_PRICE_START`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | Monthly price ids |
| `STRIPE_PRICE_START_ANNUAL`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_BUSINESS_ANNUAL` | Optional annual price ids (the Plans toggle sends `year`; without a price the API answers 503 and the UI shows a message) |
| `APP_URL` | Optional; defaults to `https://voaneves.com/midflow-app`. Used for Checkout success / cancel URLs |
| `ADMIN_TOKEN` | Break-glass admin credential (always role `admin`, audit label `admin-token`). Day-to-day staff use their own accounts |
| `RATE_REVIEW_PER_HOUR`, `RATE_BILLING_PER_HOUR`, `RATE_TEST_AI_PER_HOUR`, `RATE_ACCOUNT_DELETE_PER_HOUR` | Optional per-IP limits: 10, 30, 5 and 5 per hour. `RATE_BILLING_PER_HOUR` covers both checkout and the billing portal |
| `RATE_IMAGE_PER_HOUR`, `RATE_EVENTS_PER_HOUR`, `IMAGE_TIMEOUT_MS`, `MAX_BODY_BYTES` | Optional: stock image requests per IP (1500), feedback / event posts per IP (600), image model timeout (60000 ms), JSON body cap (262144 bytes) |
| `AI_DAILY_MAX_TEXT`, `AI_DAILY_MAX_IMAGES` | Global daily ceilings (all visitors, UTC day) on /api/generate text calls and on AI images. Unset = unlimited (the Worker sets 500 / 1500) |
| `AI_DAILY_MAX_REWRITE` (300) | Global daily ceiling on rewrites. Its own budget, so rewrites can never starve /api/generate |
| `AI_DAILY_MAX_REWRITE_PER_USER` (60) | Rewrites per signed-in account per UTC day (anonymous callers in `ANON_AI=open` are counted per IP instead). Over it: honest template rewrite, `aiErrorKind: "daily_cap"` |
| `AI_DAILY_MAX_IMAGES_PER_USER` (40) | AI images per signed-in account per UTC day: editor requests plus every signed card image URL issued by /api/generate (8 per pack) |
| `REVIEWS_RETENTION_DAYS` (365), `GENERATIONS_RETENTION_DAYS` (0) | Retention for resolved review requests and for synced generations (0 = keep). Pruned lazily at most once a day, see Retention |

These daily budgets are counters keyed `daily:<kind>[:<subject>]:<UTC day>` (`daily:text`, `daily:rewrite`, `daily:image`, `daily:rewrite:<user id>`, `daily:img:<user id>`). On the Worker every key starting with `daily:` is held by a Durable Object, so they are exact across isolates.
| `AI_REQUIRE_LLM` | Deprecated and ignored; the API always answers with the honest template result when the AI fails |

`STRIPE_PRICE_*` ids are not secret, but they are server-side configuration so the browser can never choose a price. All of the above are listed in `.env.example`. `deploy.yml` uploads them to the Worker as **Worker secrets** in one `wrangler secret bulk` step, including `SUPABASE_URL`, `STRIPE_PRICE_*` and `APP_URL` (read from GitHub Variables). Only the non-secret tuning values in `wrangler.jsonc` `vars` (model names, timeouts, `TRUST_PROXY`, the `AI_DAILY_*` ceilings) are plain vars. The secrets live in the GitHub **Environment** `production` (Settings, Environments, production), which requires a manual approval; they are not repository secrets.

`VITE_API_URL` (build time, optional) points the browser at an API on another origin; leave it unset when the API is served under the same origin / Pages base.

## Wired in phase B (server)

Everything below is optional and degrades gracefully: with no Supabase / Stripe variables the API behaves as before (anonymous, no quotas, no billing; admin routes accept only `ADMIN_TOKEN`).

Server env is read **per request** (`getDbConfig()`, `getBillingConfig()`, `supabaseJwtSecret()` in `server/config.ts`). On the Worker, `worker/index.ts` copies string bindings into `process.env` before each request and runs the request inside `backgroundContext`, so fire-and-forget work (AI health rows) uses `ctx.waitUntil`.

| File | What it does |
|---|---|
| `server/routes.ts` | Billing, review, staff, AI-health and quota wiring; AI failure contract; path-parameter routes |
| `server/authz.ts` | `identifyCaller`, `resolveStaff`, `requireStaff(req, roles)`, `optionalUser`, `requireUser`; 60 s per-user staff role cache |
| `server/reviews.ts` | Validation, storage (Supabase or event log), listing, PATCH, revisions, audit rows, customer view |
| `server/aihealth.ts` | `recordAiCall` (fire-and-forget), `aggregateAiHealth` (pure), `loadAiHealth` |
| `server/aiService.ts` | `classifyAiError` / `aiErrorKindOf`; `rewriteWithAI` now returns `aiError` |
| `server/http.ts` | `readRawBody` (exact UTF-8 text, size capped), `HttpError.extra`, CORS methods `GET, POST, PATCH, DELETE, OPTIONS` (headers already include `Authorization`) |
| `server/telemetry.ts` | New event types `ai_unavailable`, `ai_call`, `review_request`; metrics gain `aiUnavailable` and `reviewRequests` |
| `supabase/migrations/20261103010000_reviews_staff_ai_events.sql` | `staff_members`, `review_requests`, `review_events`, `ai_events` |

### Authentication kinds

- **End user**: `Authorization: Bearer <Supabase access token>` (ES256 / RS256 via JWKS, or HS256 when `SUPABASE_JWT_SECRET` is set). The token must have `aud` = `authenticated`, `role` = `authenticated` (the anon and service_role keys are rejected) and `iss` = `{SUPABASE_URL}/auth/v1`. No token on `/api/generate`, `/api/rewrite`, `/api/generate-image`, `/api/review` means anonymous/demo. A Bearer token that fails verification is `401 {error}` (only when `SUPABASE_URL` or `SUPABASE_JWT_SECRET` is set; without either the header is ignored).
- **Staff**: the same Supabase token, for a user listed in `staff_members` (`admin` or `editor`).
- **Break-glass**: `Authorization: Bearer <ADMIN_TOKEN>` is always an `admin` with `via: "token"`. It is compared first, in constant time, then the value is tried as a JWT.

Admin-route errors: `404` when no staff access is configured at all (no `ADMIN_TOKEN`, and no Supabase), `401` for missing/invalid credentials, `403` for a signed-in customer or a role without permission. `501` (pt-BR) for routes that need the database when Supabase is not configured.

### `/api/generate` and `/api/rewrite`

Request unchanged. `/api/generate` response:

```jsonc
{
  "success": true,
  "generation": { "...": "as before", "engine": "gemini" | "openai" | "template" },
  "aiErrorKind": null | "transient" | "daily_cap" | "config",
  "retryable": false,            // true only when aiErrorKind === "transient"
  "usage": { "plan": "free", "used": 5, "limit": 5 }   // only for signed-in accounts with the database configured; plan is free | start | pro | business
}
```

`/api/rewrite` response: `{ success, engine, data, aiErrorKind, retryable }`.

- When the AI fails the answer is always `200` with the honest template result (`engine: "template"`). `AI_REQUIRE_LLM` is deprecated and ignored (no more `503`).
- `transient`: timeout, 5xx, provider rate limit or per-minute quota, answer below the quality bar. `daily_cap`: our own `AI_DAILY_MAX_TEXT` budget. `config`: missing key, rejected key or retired model.
- Anonymous callers in `ANON_AI=template` get the template with `code: "account_required"` and `aiErrorKind: null` (no account is not an AI failure, and it is not a daily cap); the client offers sign-up.
- No template result is charged, whatever the kind (the client retries a `transient` one by itself; only AI-delivered content counts). Rewrites are never charged.
- Per-user daily caps: `/api/rewrite` over `AI_DAILY_MAX_REWRITE_PER_USER` answers `engine: "template"`, `aiErrorKind: "daily_cap"`, `retryable: false`. `/api/generate-image` over `AI_DAILY_MAX_IMAGES_PER_USER` answers `{ success: true, imageUrl: <unsigned stock url>, aiEnabled: false, code: "daily_user_limit" }`. The same per-user counter is charged for each signed card image URL `/api/generate` issues (8 per pack); cards past the cap get stock photos, the pack itself is complete. Without that, an uncharged template answer could be requested over and over to mint signed AI image URLs.
- Signed image URLs are canonical: `/api/image` emits `<params sorted by key>&sig=<hmac>` and honors the paid model only for exactly that spelling (a reordered or re-encoded query is answered with the stock photo), and the Worker's edge cache key is the same normalized URL. One signed URL therefore cannot fan out into unlimited cache misses.
- Every fallback logs an `ai_unavailable` event (`aiErrorKind`, `errorCode`); `GET /api/admin/metrics` returns `aiUnavailable: { total, transient, daily_cap, config }`.

### Quota (`402`)

Signed-in account + Supabase configured: before any paid AI call the server resolves the plan (`effectivePlan`) and the month's usage (`usage_counters`). If `cost > remaining`:

```jsonc
// 402, free plan (accounts without an entitled subscription: 5 contents per month = one full pack)
{ "error": "Você já usou os 5 conteúdos grátis deste mês. Assine um plano para continuar criando. Seus conteúdos grátis renovam no dia 1º.",
  "code": "quota_exceeded", "plan": "free", "limit": 5, "used": 5 }

// 402, paid plan (message unchanged)
{ "error": "Você já usou os 20 conteúdos do plano Start neste mês. Faça upgrade para continuar.",
  "code": "quota_exceeded", "plan": "start", "limit": 20, "used": 18 }
```

`free` is a limit, never a stored plan: `subscriptions.plan` only holds `start | pro | business`, and an account without a row (or with one that is not `active`, `trialing` or `past_due`) resolves to `free` (`effectiveBillingPlan`).

`/api/generate` costs `4 posts + 1 Stories sequence = 5` (`generationCost`), is reserved **atomically** before any paid call (`public.reserve_usage`: check and increment in one statement, so parallel requests can never pass the limit; over the limit answers `402`). When the answer is ready the reservation is settled with `public.refund_usage`: **only AI-delivered content is charged**, so any template answer (`transient`, `daily_cap` or `config`) gives the whole reservation back, and an exception after reserving refunds it too. `/api/rewrite` and `/api/generate-image` need at least 1 unit left but are not charged. `GET /api/image` cannot carry headers (it is an `<img src>`), so it is not metered per account.

If the database **answers with an error** (a rejected call, a missing function, a 5xx) the quota cannot be enforced, so a signed-in request fails closed with `503` ("Não foi possível verificar seu plano agora."). Only when Supabase cannot be **reached at all** (the fetch itself fails: DNS, connection, timeout) is the quota skipped (fail open, warning logged), so an outage does not take the whole product down.

### Billing

- `POST /api/billing/checkout` body `{ plan: "start"|"pro"|"business", interval?: "month"|"year" }`, Bearer required. `200 {url}`; `401` without a valid token; `400` bad plan (`free` is not for sale and is rejected too); `409` (pt-BR) when the account already has an entitled subscription (`active`, `trialing`, `past_due`) with a Stripe subscription id: plan changes and cancellation do not go through a second Checkout; `503 {error}` when Stripe or Supabase is not configured or the plan has no price id; `502` when Stripe fails. Rate limit: `RATE_BILLING_PER_HOUR` (30).
- `POST /api/billing/portal`, Bearer required, no body. Opens a Stripe Customer Portal session (`POST /v1/billing_portal/sessions`) for the customer id stored in `subscriptions` (never one from the browser) with `return_url` = `${APP_URL}/#/app/config`, and answers `200 {url}`. `401` without a valid token; `404 "Nenhuma assinatura encontrada."` when the account has no Stripe customer; `503` when Stripe or Supabase is not configured; `502` when Stripe fails (the portal needs a configuration saved once in the Stripe dashboard, Settings, Billing, Customer portal). Shares `RATE_BILLING_PER_HOUR` with checkout. The checkout `409` message points the customer to "Gerenciar assinatura".
- `POST /api/billing/webhook`: raw body (cap 256 KB, `413` above), `Stripe-Signature` header, no auth/CORS. `400 {error: reason}` for an invalid signature; `200 {received:true}`; `200 {received:true, duplicate:true}` for a replay of an event whose claim has `processed_at` set; a claim that is **in flight** (claimed less than 5 minutes ago, not processed yet) answers `503 {error:"retry"}` so Stripe retries instead of treating an event that may still fail as done; a claim never marked processed and older than 5 minutes is processed again; `200 {received:true, ignored:true}` when the database rejects the event with a unique violation (a Stripe customer / subscription id already belongs to another account row): it is logged without ids and not retried; `500 {error:"retry"}` after releasing the claim when persisting fails so Stripe retries; `503` when not configured. The body and the signature are never logged.

### Account deletion (LGPD art. 18)

`POST /api/account/delete`, body `{ "confirm": "EXCLUIR" }`, `Authorization: Bearer <Supabase access token>`. Limit: `RATE_ACCOUNT_DELETE_PER_HOUR` (5) per IP. Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the service role key is what authorizes the Auth admin call. `SUPABASE_JWT_SECRET` is **not** required: the Bearer token is verified against the project JWKS (it is only for legacy HS256 projects).

| Status | When |
|---|---|
| `200 {success:true}` | The Auth user and everything tied to it are gone |
| `400` | `confirm` is not exactly `EXCLUIR` |
| `401` | Missing, invalid or expired token |
| `409` | The caller is the last `admin` in `staff_members` (hand over administration first) |
| `501` | Supabase is not configured (pt-BR) |
| `502` | The user has a live Stripe subscription and cancelling it failed (or Stripe is not configured): nothing was deleted, the customer can retry |
| `503` | The database or the Auth admin API failed after the earlier steps: safe to retry (every step is idempotent) |

Order: last-admin guard, `DELETE https://api.stripe.com/v1/subscriptions/:id` (skipped for no / already `canceled` subscription; a 404 from Stripe counts as cancelled), delete the user's `review_requests` (their briefing, comment and contact e-mail; `review_events` cascade), set `ai_events.user_id` to null, then `DELETE {SUPABASE_URL}/auth/v1/admin/users/:id`. Every table that references `auth.users` already cascades (`profiles`, `brands`, `generations`, `library_items`, `subscriptions`, `usage_counters`, `staff_members`) or sets null (`review_requests.user_id`, `review_requests.assigned_to`, `review_events.actor_id`, `ai_events.user_id`, `staff_members.created_by`), so no migration is needed. The Stripe customer record is not deleted: Stripe keeps invoices and payment records for the legal retention period. A telemetry event `account_deleted` is written with no user id, e-mail or brand.

### Review requests

`POST /api/review` (anonymous allowed, Bearer optional to link the account, `10/hour/IP`, body cap 48 KB):

```jsonc
{ "brandName": "Studio Aurora",            // required, max 80
  "segment": "beleza",                      // slug, default "outro"
  "engine": "template",                     // max 20
  "aiErrorKind": "transient",               // optional: transient | daily_cap | config | null
  "comment": "Não gostei do tom.",          // optional, max 1000 (400 above)
  "contactEmail": "cliente@exemplo.com",    // optional, validated
  "briefing": { "...": "..." },             // object, JSON <= 8 KB, sanitized (depth 4, strings 500)
  "outputs": [ { "kind": "post"|"story", "title": "<=120", "caption": "<=2200", "hashtags": ["<=15 items, <=40 chars"] } ] // 0..8 items
}
// 201 { "id": "<uuid>" }
```

Stored in `review_requests` when Supabase is configured; otherwise appended to the event log as `review_request` (on the Worker this reaches **Workers Logs only**: there is no queue, listing or update without Supabase).

Customer: `GET /api/reviews/mine` (Bearer required) returns `{ items: [{ id, createdAt, updatedAt, status, brandName, comment, revisedOutputs, resolvedAt }] }`, newest first, max 50. No internal notes, contact data or assignee.

Staff (`admin` and `editor` unless stated):

| Route | Notes |
|---|---|
| `GET /api/admin/me` | `{ role, userId \| null, via: "token" \| "session" }` |
| `GET /api/admin/reviews?status=pending\|in_progress\|resolved` | `{ items, storage: "supabase" \| "events" }`, newest first, max 100. Items have `id, createdAt, updatedAt, userId, status, brandName, segment, engine, aiErrorKind, comment, contactEmail, adminNote, assignedTo, resolvedAt` (no briefing or outputs) |
| `GET /api/admin/reviews/:id` | `{ item (adds briefing, outputs, revisedOutputs), events: [audit rows], storage }` |
| `PATCH /api/admin/reviews/:id` | Body any of `{ status, adminNote (<=2000 \| null), assignedTo (uuid \| null) }`. Editors may only assign themselves, and only a review that is unassigned or already theirs: a review assigned to someone else is `403` "Este pedido está atribuído a outra pessoa." for an editor trying to take it over, release it, change its status or deliver a revision. Admins and the token can. `{ item }`. `501` without Supabase |
| `POST /api/admin/reviews/:id/revision` | Body `{ outputs: [1..8 items, same shape] }`. Stores `revised_outputs`, sets `status: "resolved"`, `resolved_at`. `{ item }` |

Every status change, assignment, note and revision writes a `review_events` row (`actor_id`, `actor_label` = `admin-token` or `<role>:<user id>`, `action` = `status|assign|note|revision`, `from_status`, `to_status`, `note`). Unchanged values write nothing.

### Staff management (admin only; `501` without Supabase)

- `GET /api/admin/staff` returns `{ items: [{ userId, email, name, role, createdAt, createdBy }] }`.
- `POST /api/admin/staff` body `{ email, role: "admin"|"editor" }` returns `{ staff: { userId, email, name, role } }`. `404` (pt-BR) if no confirmed account has that e-mail. The lookup calls `public.find_confirmed_user_by_email`, which matches the verified e-mail in `auth.users` (never the editable profile), ignores unconfirmed and deleted accounts, and is "not found" unless exactly one account matches. `409` when demoting the last admin; the check and the write run in `public.set_staff_role_guarded` under an advisory lock.
- `DELETE /api/admin/staff/:userId` returns `{ success: true }`; `404` if not staff; `409` for the last admin (`public.remove_staff_guarded`, same lock).
- Role changes clear the cache of that user in the current isolate; other Worker isolates pick them up within 60 s.

### AI health (admin only; editors get `403`)

`GET /api/admin/ai-health?range=24h|7d|30d` returns:

```jsonc
{ "range": "24h", "storage": "supabase" | "events",
  "totals": { "calls": 0, "ok": 0, "fallback": 0, "successRate": 97.5 /* % or null */,
              "fallbackByKind": { "transient": 0, "daily_cap": 0, "config": 0 } },
  "latency": { "p50": 0, "p95": 0 },                 // ms, nearest rank, null when empty
  "quality": { "avg": 91.2, "belowThreshold": 0 },    // belowThreshold = score < 85
  "images": { "ai": 0, "stock": 0, "procedural": 0 },
  "dailyCap": { "text": { "used": 0, "max": 500 | null }, "rewrite": { "used": 0, "max": 300 | null }, "images": { "used": 0, "max": null } },
  "providers": [ { "name": "gemini", "configured": true, "model": "gemini-3.5-flash-lite" } ],  // never keys
  "lastError": { "at": 1730000000000, "route": "generate", "outcome": "transient", "errorCode": "timeout" } | null,
  "series": [ { "bucket": "2026-11-03T12:00:00.000Z", "calls": 0, "ok": 0, "fallback": 0, "p95": null } ] }  // hourly for 24h, daily otherwise, gaps filled
```

One row per AI attempt is written to `ai_events` (generate, rewrite, and `GET /api/image?ai=1` cache misses) without delaying the request. Values are a fixed vocabulary (`outcome`: `ok|repaired|transient|daily_cap|config`; `error_code`: `not_configured|invalid_key|model_not_found|daily_cap|rate_limit|timeout|provider_error|low_quality|bad_response|network`); prompts, briefing text, provider messages and keys are never stored. Rows older than `EVENTS_RETENTION_DAYS` are pruned at most once a day, and the same pass (`server/retention.ts`) deletes resolved `review_requests` older than `REVIEWS_RETENTION_DAYS` (default 365, measured from `resolved_at`; open requests are never pruned; their `review_events` cascade) and `generations` older than `GENERATIONS_RETENTION_DAYS` (default 0 = keep). It runs inside a request, service role only, at most once a day per instance. Without Supabase the same data goes to the event log (`ai_call`), which on the Worker lives in `/tmp` and is lost on restart. Aggregation reads the window in pages of 1000 rows (max 20 pages), so an extreme `30d` volume is truncated to the newest 20 000 rows. `dailyCap.*.used` counts today's attempts that were allowed to reach the provider.

`POST /api/test-ai` stays admin only in production (`requireStaff(['admin'])`, editors `403`), limited to `RATE_TEST_AI_PER_HOUR` (5) per IP. It returns `{ ok, provider, model, latencyMs, message }` after a real model round trip, or `{ ok:false, message }` when no AI key is configured.

### Brand limits

Nothing on the API enforces `profiles` per plan yet; `addBrand` in the client does. Add an RPC or route that checks `profileLimit(plan)` when that matters.

### Client contract notes

- Send `Authorization` from `authHeaders()` on generate/rewrite/review/billing calls.
- Retry `retryable: true` responses a few times, then keep the template result and tell the customer honestly it is the fallback; "Solicitar revisão" posts to `/api/review`.
- On `402` with `code: "quota_exceeded"` show the Plans upsell.
- Adopt `usage` from `/api/generate` when present. The store does this for signed-in accounts (`user.id`): `used` and `plan` come from the server. Demo and browser-only logins keep counting locally. `refreshPlan` (after hydrate and after Checkout) reads `usage_counters` and the effective plan, so a free account with no `subscriptions` row still gets its real monthly usage.

### Client wiring: `src/pages/Auth.tsx` (and `Settings.tsx`)

- Sign-in submit: `const res = await useApp.getState().authSignIn(email, password)`; on `!res.ok` show `res.error` (already pt-BR). On success navigate to `/app`.
- Sign-up submit: `authSignUp({ name, email, password }, company, segment)`. When `res.ok && res.needsConfirmation`, show "Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre." (the business is created on first sign-in from the sign-up metadata). Otherwise navigate to `/app`.
- Keep "Ver demonstração" calling `loadDemo()` unchanged.
- When Supabase is not configured the same actions use the local adapter and behave like today's `login` / `signup`, so Auth.tsx can switch to them unconditionally. Password is ignored by the local adapter.
- Password recovery (`/esqueci-senha`, `/nova-senha`): `AuthProvider.resetPassword(email)` calls `resetPasswordForEmail` with `redirectTo` = the app root. The e-mail link comes back as `?code=` (PKCE), supabase-js exchanges it and emits `PASSWORD_RECOVERY`; `store.ts` then sets a session flag (`src/lib/oauthReturn.ts`) and moves to `#/nova-senha`, where `updatePassword` calls `updateUser({ password })` and signs the person in. Opening `/nova-senha` without that flag shows "link expirado". The local adapter has no passwords: the link is hidden and both routes redirect to `/entrar`.
- `Settings.tsx` still calls `login({ name, email })` to edit the local profile name; that stays valid (the store keeps the account `id` when the e-mail is unchanged).
- `Privacy.tsx` / `Terms.tsx` should mention Supabase (storage) and Stripe (payments) as processors once enabled.

### Worker and Pages

- Routes `/midflow-app/api/billing/*` and `/midflow-app/api/admin/*` live under the existing `voaneves.com/midflow-app/api/*` Worker route; no extra route is needed.
- Secrets: set by `deploy.yml` from GitHub Secrets (never in `wrangler.jsonc` `vars`).
- Pages build: `deploy.yml` passes `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_BILLING_ENABLED` from repository **Variables** (empty is fine: local mode).
- CSP: `connect-src` allows `https://*.supabase.co`; Checkout is a full-page navigation to `checkout.stripe.com`.

## Manual setup

### Supabase

1. Create a project (region near Brazil, `sa-east-1`).
2. Apply all five migrations in `supabase/migrations/`, in order: `20261103000000_init.sql` (schema, RLS), `20261103010000_reviews_staff_ai_events.sql` (staff, reviews, AI events), `20261103020000_security_hardening.sql`, `20261103030000_usage_reservation.sql` (atomic quota reservation), `20261103040000_sync_limits.sql` (uncompressed size limits). Recommended: the Supabase CLI (`npx supabase login`, `link --project-ref <ref>`, `migration list --remote`, `db push --remote --dry-run`, `db push --remote`) rather than the SQL editor; versions pasted by hand earlier are marked with `npx supabase migration repair --remote --status applied <version>`. Use one mechanism only (CLI `db push` or the Supabase GitHub integration), not both. Keep **Automatically expose new tables** on when creating the project: the migrations rely on the default grants and only revoke from `anon`. `supabase/config.toml` is for local `supabase start` / `supabase test db`.
3. Authentication → Providers: enable Email. Decide on "Confirm email" (default on; the app handles both).
4. Authentication → URL configuration: Site URL `https://voaneves.com/midflow-app/`; add the same and `http://localhost:5173/` to Redirect URLs.
5. Project Settings → API: copy the Project URL, the publishable key (`sb_publishable_...`, legacy `anon`; public) and the secret key (`sb_secret_...`, legacy `service_role`; secret). Both formats work.
   - **JWT keys.** `server/auth.ts` verifies ES256 (EC P-256) and RS256 tokens against the project JWKS (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, cached 10 minutes, refetched at most every 30 s when an unknown `kid` shows up, stale keys kept if Supabase is unreachable). That is what projects on Supabase's new asymmetric signing keys need: set `SUPABASE_URL` and **leave `SUPABASE_JWT_SECRET` unset**. Only set the legacy secret if the project still signs with it (HS256); it is never used to verify an ES256 / RS256 token, and HS256 tokens are refused outright when no secret is configured, so a public key cannot be replayed as an HMAC secret. Staff access needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, not the JWT secret.
6. Optional: add custom SMTP and pt-BR e-mail templates (Authentication → Emails) so confirmation mails come from Midflow. Translate the **Reset Password** template too: it is the "Esqueci minha senha" mail, and its link must keep `{{ .ConfirmationURL }}`. The built-in mail service is rate limited (a few messages per hour); configure custom SMTP before launch.
7. **First admin.** Sign up in the app with the owner e-mail, then run once in the SQL editor:

   ```sql
   insert into public.staff_members (user_id, role)
   select id, 'admin' from auth.users where email = 'owner@example.com';
   ```

   Alternative without SQL: with `ADMIN_TOKEN` set, `POST /api/admin/staff` with `{ "email": "...", "role": "admin" }` and the token as Bearer. After that, admins add editors from the app (or the same endpoint).
8. GitHub → Settings → Environments → `production` → Environment secrets (not repository secrets): `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (plus `SUPABASE_JWT_SECRET` only for a legacy HS256 project). Then Settings → Secrets and variables → Actions → Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BILLING_ENABLED`, `STRIPE_PRICE_*`, optionally `APP_URL`. Push to `main` to deploy. (`SUPABASE_JWT_SECRET` is only needed for legacy HS256 projects; `TRUST_PROXY` is set in `wrangler.jsonc`.)

RLS summary for the review tables: `staff_members` (a user may read only their own row), `review_requests` (a customer may read only their own rows and only the columns `id, created_at, updated_at, user_id, status, brand_name, segment, comment, revised_outputs, resolved_at`), `review_events` and `ai_events` have no client access at all. Everything is read and written by the API with the service role.

RLS summary: users read and write only their own `brands`, `generations`, `library_items`, and read their own `profiles` row, of which they may update only `name`, `company` and `segment` (column-level grant; no insert or delete; `email` is synced from `auth.users` by a trigger). `subscriptions` and `usage_counters` are read-only for the owner; only the service role writes them. `stripe_events` is invisible to clients. `increment_usage`, `reserve_usage`, `refund_usage`, `find_confirmed_user_by_email`, `apply_subscription_event`, `set_staff_role_guarded`, `remove_staff_guarded`, `handle_new_user` and `sync_profile_email` are executable by the service role only, and every `security definer` function pins `search_path` to the empty string.

### Stripe

1. Create three Products: Start, Pro, Business. For each, a recurring BRL price per month: 47, 77, 127. Optional annual prices: 470, 770, 1270 (the Plans screen advertises "2 meses grátis", i.e. 10 months).
2. Copy the price ids into `STRIPE_PRICE_*` (monthly) and `STRIPE_PRICE_*_ANNUAL`.
3. Developers → Webhooks → add endpoint `https://voaneves.com/midflow-app/api/billing/webhook` listening to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
4. Use test mode first (`sk_test_...`, test price ids, test webhook secret) with `stripe listen --forward-to` for local checks.
5. Settings → Billing → Customer portal: enable (cancel / change plan); the "Gerenciar assinatura" button (Plans and Settings) opens it via `POST /api/billing/portal`. Card is the supported method for subscriptions; Pix and boleto recurring need a separate evaluation.
6. Settings → Public details: business name and support e-mail shown on Checkout.

## Behaviour notes

- A subscription that is not `active`, `trialing` or `past_due` resolves to the free plan (5 contents per month, `effectivePlan`), matching the app where every new account starts on Grátis.
- Webhook handling is idempotent three ways: event ids are claimed in `stripe_events` (marked `processed_at` after success; an unfinished claim older than 5 minutes is retried), the subscription write is an upsert on `user_id`, and `apply_subscription_event` ignores an event whose Stripe `created` is older than `subscriptions.last_event_at`.
- Out-of-order deliveries are handled: a late event with an older `created` does not roll the subscription back (events in the same second are applied in arrival order). The plan comes from the Stripe price id (`STRIPE_PRICE_*`) first and from `metadata.plan` only when the price is not recognised, because metadata can be edited in the Stripe dashboard.
- The browser never sends prices or amounts. It names a paid plan (`start`, `pro`, `business`; `free` is rejected) and an interval; the server maps them to configured price ids.
- Checkout returns to `/#/app/planos?checkout=success`. Plans then re-reads plan and usage a few times while the webhook lands.
- The API now enforces quotas for signed-in accounts (see Quota). The `used` counter in the UI is overwritten by `usage` from `/api/generate` and by `usage_counters` whenever the plan is refreshed.
- Staff roles live in `staff_members`; the shared `ADMIN_TOKEN` is a break-glass admin only. Rotate it if it was ever shared.
- E-mail lookup for staff uses `auth.users` through `find_confirmed_user_by_email`. `profiles.email` is only a convenience copy (kept in sync by the `on_auth_user_email_changed` trigger) and is no longer trusted for anything.
- The Auth admin API is used only by `POST /api/account/delete` (service role key). Token verification uses the project JWKS (the JWT secret only for legacy HS256 projects) and staff lookup still reads `profiles` through PostgREST.

## Security hardening (migration `20261103020000_security_hardening.sql`)

| Finding | Fix |
|---|---|
| Staff invite hijack: users could edit `profiles.email` and the invite matched on it | `revoke update` on `profiles`, then `grant update (name, company, segment, updated_at)`; no insert / delete for clients; e-mail sync trigger on `auth.users`; invites use `find_confirmed_user_by_email` (service role only, confirmed and non-deleted accounts, exactly one match); `profiles.email` backfilled from `auth.users` |
| JWT: only legacy HS256 | ES256 / RS256 via JWKS plus `iss` and `role` checks, see "JWT keys" |
| `handle_new_user` without a pinned `search_path` | Recreated with `set search_path = ''` and qualified names (all other definer functions follow the same rule) |
| Subscription plan taken from editable metadata | The Stripe price decides (`planForPrice`), metadata is the fallback |
| Out-of-order Stripe events | `subscriptions.last_event_at` and the `apply_subscription_event` RPC (service role only) |
| Double subscription | `POST /api/billing/checkout` answers 409 for accounts with an entitled subscription |
| Spoofable client IP | `TRUST_PROXY` modes (`cloudflare`, N hops, socket); the leftmost `X-Forwarded-For` entry is never used |
| Brute-forcing the admin token | Bearer credentials that fail on `/api/admin/*` (unknown token, customer session) count against `admin-auth`, 20 per hour per IP, then `429`. Anonymous probes and valid staff do not count |
| Unbounded client data | `check (octet_length(data::text) <= ...)` on `brands` and `library_items` (8 MB) and `generations` (2 MB), uncompressed (migration `20261103040000_sync_limits.sql`; the first version measured the compressed 256 KB); added `not valid`: old rows are untouched, run `alter table ... validate constraint` after cleaning; per-user row caps by trigger: 50 brands, 500 generations, 2000 library items (error 54000, pt-BR message; upserts of an existing id still pass) |
| Last-admin race | `set_staff_role_guarded` / `remove_staff_guarded` check and write under `pg_advisory_xact_lock`. `POST /api/account/delete` still uses the plain count (a rare race there is accepted: the caller is deleting their own account and the bootstrap SQL can restore an admin) |
| Editors and assigned reviews | Enforced in `server/reviews.ts` (see the PATCH / revision notes) |
| Webhook retries | `stripe_events.processed_at`; stale unprocessed claims are re-run; unique violations on Stripe ids are logged and answered 200 |
| Non-object JSON bodies | `readJson` answers 400 "JSON inválido." for arrays, `null` and scalars (an empty body is still `{}`) |
| Contact data in logs | Review requests stored only in the event log (no database) keep `hasContact` and `briefingBytes`, not the e-mail or the briefing; the admin queue then shows them as empty |

### Applying it

1. Run the migration after the two earlier ones (SQL editor or `supabase db push`). It is idempotent where PostgreSQL allows it, but the three `add constraint` lines and the three `create trigger ... row_limit` lines run once.
2. Deploy the API. The new code calls the RPCs, so **apply the migration first**: until it runs, staff invites, role changes and subscription webhooks answer 5xx (Stripe retries webhooks safely).
3. Set `TRUST_PROXY` to `cloudflare` on the Worker and to the real hop count anywhere else. Update `PRODUCAO.md` / `.env.example`, which still say `TRUST_PROXY=true`.
4. If the project uses Supabase asymmetric signing keys, remove `SUPABASE_JWT_SECRET`.

### pgTAP checks

`supabase/tests/rls.sql` documents and checks the access model with pgTAP: an authenticated user cannot update `profiles.email`, cannot insert or delete profiles, cannot write `subscriptions`, `usage_counters` or `staff_members`, cannot read `review_requests.admin_note` or `contact_email`, and cannot execute `increment_usage`, `reserve_usage`, `refund_usage`, `find_confirmed_user_by_email`, `set_staff_role_guarded`, `remove_staff_guarded` or `apply_subscription_event`; the service role finds confirmed users case-insensitively, refuses to remove the last admin, and ignores stale subscription events. It needs a database with the Supabase `auth` schema, so it does not run in `npm test` or CI. Run it with `supabase test db` against a local stack (`supabase start`).

## Verification

```powershell
npm run typecheck; npm run lint; npm test; npm run build; npm run check:budget
```

Unit tests: `server/tests/auth.test.ts` (JWT: HS256, ES256 / RS256 with a fake JWKS, issuer, role, key rotation, algorithm confusion), `server/tests/http.test.ts` (rate limits, `TRUST_PROXY`, `readJson`), `server/tests/billing.test.ts` (checkout, webhook signature, events, quota, db helpers with a fake `fetch`), `server/tests/backend-sync.test.ts` (sync and local adapter), `server/tests/backend-routes.test.ts` (billing routes, quota, AI failure contract, review requests, RBAC role matrix, last-admin protection, audit rows, AI health recording, staff-invite hijack, ES256 sessions, admin-auth rate limit, checkout 409, webhook ordering / claims / unique violations, editor assignment rules, log redaction), `server/tests/aihealth.test.ts` (percentiles, rates, buckets, sanitizing, error classification), `server/tests/account-delete.test.ts` (auth required, confirmation, last admin, Stripe cancel before the Auth delete, Auth delete, retry, 501, rate limit). `server/tests/fakeBackend.ts` is an in-memory Supabase / Stripe used by the route tests (it mirrors the RPCs: `find_confirmed_user_by_email`, `apply_subscription_event`, the staff guards, and serves a JWKS). `server/tests/jwtKeys.ts` builds test key pairs and tokens.
