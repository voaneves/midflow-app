-- MIDFLOW: review requests, staff roles (RBAC), review audit trail and AI health events.
-- Run after 20261103000000_init.sql.
--
-- Access model: everything here is written and read by the API with the service role key (bypasses RLS).
--   * Clients get no insert/update/delete on any of these tables.
--   * A signed-in user may read only their own staff row and a limited set of columns of their own review requests.

-- ---------------------------------------------------------------------------
-- Staff roles: 'admin' (everything) and 'editor' (reviews only)
-- ---------------------------------------------------------------------------
create table public.staff_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('admin', 'editor')),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

alter table public.staff_members enable row level security;
create policy staff_select_own on public.staff_members for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.staff_members from anon, authenticated;
revoke all on public.staff_members from anon;

-- ---------------------------------------------------------------------------
-- Review requests ("Solicitar revisão")
-- ---------------------------------------------------------------------------
create table public.review_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid references auth.users (id) on delete set null,
  status          text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved')),
  brand_name      text not null,
  segment         text,
  engine          text,
  ai_error_kind   text check (ai_error_kind in ('transient', 'daily_cap', 'config')),
  comment         text,
  contact_email   text,
  -- { briefing: object, outputs: [{ kind, title, caption, hashtags }] } as sent by the customer (sanitized by the API)
  payload         jsonb not null default '{}'::jsonb,
  admin_note      text,
  updated_at      timestamptz not null default now(),
  assigned_to     uuid references auth.users (id) on delete set null,
  -- Creatives delivered by an editor, same shape as payload.outputs
  revised_outputs jsonb,
  resolved_at     timestamptz
);
create index review_requests_status_created_idx on public.review_requests (status, created_at desc);
create index review_requests_user_idx on public.review_requests (user_id, created_at desc);

alter table public.review_requests enable row level security;
-- The customer can read their own requests, but only these columns: internal notes, assignee and contact data stay server side.
create policy review_requests_select_own on public.review_requests for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.review_requests from anon, authenticated;
grant select (id, created_at, updated_at, user_id, status, brand_name, segment, comment, revised_outputs, resolved_at)
  on public.review_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Audit trail for status changes, assignments, notes and revisions
-- ---------------------------------------------------------------------------
create table public.review_events (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.review_requests (id) on delete cascade,
  actor_id     uuid references auth.users (id) on delete set null,
  -- 'admin-token' for the shared break-glass token, otherwise '<role>:<user id>'
  actor_label  text not null,
  action       text not null,
  from_status  text,
  to_status    text,
  note         text,
  created_at   timestamptz not null default now()
);
create index review_events_review_idx on public.review_events (review_id, created_at);

alter table public.review_events enable row level security;
revoke all on public.review_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- AI health: one row per AI attempt (generate / rewrite / image).
-- Only short fixed-vocabulary values and numbers: never prompts, briefing text, provider messages or keys.
-- ---------------------------------------------------------------------------
create table public.ai_events (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  route          text not null check (route in ('generate', 'rewrite', 'image')),
  provider       text,
  model          text,
  outcome        text not null check (outcome in ('ok', 'transient', 'daily_cap', 'config', 'repaired')),
  engine         text not null,
  latency_ms     integer check (latency_ms is null or latency_ms >= 0),
  quality_score  integer check (quality_score is null or quality_score between 0 and 100),
  retries        integer not null default 0 check (retries >= 0),
  error_code     text,
  user_id        uuid references auth.users (id) on delete set null
);
create index ai_events_created_idx on public.ai_events (created_at desc);

alter table public.ai_events enable row level security;
revoke all on public.ai_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bootstrap the first admin (run once in the SQL editor, after that person has signed up):
--
--   insert into public.staff_members (user_id, role)
--   select id, 'admin' from auth.users where email = 'you@example.com';
--
-- Later staff are managed through POST /api/admin/staff by an admin.
-- ---------------------------------------------------------------------------
