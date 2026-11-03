-- MIDFLOW initial schema.
-- Apply with the Supabase CLI (supabase db push) or paste into the SQL editor.
--
-- Access model:
--   * Browser (anon key + user JWT): reads and writes only its own profile, brands, generations, library.
--   * Subscriptions, usage counters and processed Stripe events: browser may only READ its own rows.
--     Writes happen on the API with the service role key, which bypasses RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created by trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  name        text,
  company     text,
  segment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, company, segment)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'company',
    new.raw_user_meta_data ->> 'segment'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Brands (business profiles). Ids are client-generated text, unique per user.
-- ---------------------------------------------------------------------------
create table public.brands (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  name        text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- Generations (a run of 4 posts + stories)
-- ---------------------------------------------------------------------------
create table public.generations (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  brand_id    text,
  version     integer not null default 1,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);
create index generations_user_created_idx on public.generations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Library (saved creatives)
-- ---------------------------------------------------------------------------
create table public.library_items (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  brand_id    text,
  data        jsonb not null,
  saved_at    timestamptz not null default now(),
  primary key (user_id, id)
);
create index library_items_user_saved_idx on public.library_items (user_id, saved_at desc);

-- ---------------------------------------------------------------------------
-- Subscriptions (written by the Stripe webhook only)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  plan                    text check (plan in ('start', 'pro', 'business')),
  status                  text not null default 'incomplete',
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Usage counters: contents generated per calendar month (UTC), key "YYYY-MM"
-- ---------------------------------------------------------------------------
create table public.usage_counters (
  user_id     uuid not null references auth.users (id) on delete cascade,
  period      text not null check (period ~ '^\d{4}-\d{2}$'),
  used        integer not null default 0 check (used >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, period)
);

-- Webhook idempotency: Stripe may deliver an event more than once.
create table public.stripe_events (
  id           text primary key,
  received_at  timestamptz not null default now()
);

-- Atomic increment used by the API after a successful generation (service role only).
create function public.increment_usage(p_user uuid, p_period text, p_cost integer) returns integer
language sql security definer set search_path = public as $$
  insert into public.usage_counters (user_id, period, used)
  values (p_user, p_period, greatest(p_cost, 0))
  on conflict (user_id, period)
  do update set used = public.usage_counters.used + greatest(p_cost, 0), updated_at = now()
  returning used;
$$;
revoke all on function public.increment_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.brands         enable row level security;
alter table public.generations    enable row level security;
alter table public.library_items  enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.usage_counters enable row level security;
alter table public.stripe_events  enable row level security;

-- profiles: read and update own row (inserts come from the trigger)
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- brands, generations, library_items: full CRUD on own rows
create policy brands_select_own on public.brands for select to authenticated using (user_id = (select auth.uid()));
create policy brands_insert_own on public.brands for insert to authenticated with check (user_id = (select auth.uid()));
create policy brands_update_own on public.brands for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy brands_delete_own on public.brands for delete to authenticated using (user_id = (select auth.uid()));

create policy generations_select_own on public.generations for select to authenticated using (user_id = (select auth.uid()));
create policy generations_insert_own on public.generations for insert to authenticated with check (user_id = (select auth.uid()));
create policy generations_update_own on public.generations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy generations_delete_own on public.generations for delete to authenticated using (user_id = (select auth.uid()));

create policy library_select_own on public.library_items for select to authenticated using (user_id = (select auth.uid()));
create policy library_insert_own on public.library_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy library_update_own on public.library_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy library_delete_own on public.library_items for delete to authenticated using (user_id = (select auth.uid()));

-- subscriptions, usage_counters: read-only for the owner. No insert/update/delete policies exist,
-- so only the service role (which bypasses RLS) can write. stripe_events has no policies at all.
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy usage_select_own on public.usage_counters for select to authenticated using (user_id = (select auth.uid()));

-- Defense in depth: also withhold write privileges at the grant level.
revoke insert, update, delete on public.subscriptions, public.usage_counters from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;
revoke all on all tables in schema public from anon;
