-- MIDFLOW security hardening. Run after 20261103010000_reviews_staff_ai_events.sql.
--
-- What this fixes:
--   * profiles.email was editable by the signed-in user and the staff invite looked people up there (account takeover of
--     an invite). Users can now change only name / company / segment, e-mail is synced from auth.users, and the invite
--     lookup goes through a service-role-only function that reads the verified e-mail in auth.users.
--   * Stripe events could be applied out of order; the latest applied event is now tracked.
--   * Stripe webhook claims that crashed mid-way were lost; claims now carry processed_at.
--   * Clients could store unbounded jsonb / unlimited rows; sizes and per-user counts are now capped.
--   * The "last admin" guard raced; it now runs under an advisory lock.
--   * SECURITY DEFINER functions now pin search_path to the empty string and use schema-qualified names.

-- ---------------------------------------------------------------------------
-- profiles: the client may edit only its descriptive fields
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name, company, segment, updated_at) on public.profiles to authenticated;

-- Keep profiles.email equal to the verified e-mail in auth.users.
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email, updated_at = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- Same body as before, now with an empty search_path and qualified names.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
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

-- Heal values that users may have edited before this migration.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- Staff invites: match the verified account e-mail, never the editable profile. Returns up to 2 rows so the API can
-- treat ambiguity as "not found".
create or replace function public.find_confirmed_user_by_email(p_email text)
returns table (id uuid, email text, name text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, p.name
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(p_email)
    and u.email_confirmed_at is not null
    and u.deleted_at is null
  limit 2;
$$;

revoke execute on function public.find_confirmed_user_by_email(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
grant execute on function public.find_confirmed_user_by_email(text) to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.sync_profile_email() to service_role;

-- increment_usage: same logic, hardened search_path.
create or replace function public.increment_usage(p_user uuid, p_period text, p_cost integer) returns integer
language sql security definer set search_path = '' as $$
  insert into public.usage_counters (user_id, period, used)
  values (p_user, p_period, greatest(p_cost, 0))
  on conflict (user_id, period)
  do update set used = public.usage_counters.used + greatest(p_cost, 0), updated_at = now()
  returning used;
$$;
revoke all on function public.increment_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Stripe: ordering of subscription events and a processed marker for webhook claims
-- ---------------------------------------------------------------------------
alter table public.subscriptions add column if not exists last_event_at bigint;
alter table public.stripe_events add column if not exists processed_at timestamptz;

-- Events that were handled before this column existed are done.
update public.stripe_events set processed_at = received_at where processed_at is null;

-- Applies a Stripe subscription event unless a newer one was already applied (p_event_created is Stripe event.created,
-- in seconds). Null arguments keep the stored value. Returns true when the row was written, false when the event was stale.
create or replace function public.apply_subscription_event(
  p_user          uuid,
  p_status        text,
  p_plan          text,
  p_customer      text,
  p_subscription  text,
  p_period_end    timestamptz,
  p_cancel        boolean,
  p_event_created bigint
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.subscriptions as s
    (user_id, status, plan, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, updated_at, last_event_at)
  values
    (p_user, p_status, p_plan, p_customer, p_subscription, p_period_end, coalesce(p_cancel, false), now(), p_event_created)
  on conflict (user_id) do update set
    status                 = excluded.status,
    plan                   = coalesce(excluded.plan, s.plan),
    stripe_customer_id     = coalesce(excluded.stripe_customer_id, s.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, s.stripe_subscription_id),
    current_period_end     = coalesce(excluded.current_period_end, s.current_period_end),
    cancel_at_period_end   = coalesce(p_cancel, s.cancel_at_period_end),
    updated_at             = now(),
    last_event_at          = coalesce(excluded.last_event_at, s.last_event_at)
  where s.last_event_at is null or p_event_created is null or s.last_event_at <= p_event_created;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.apply_subscription_event(uuid, text, text, text, text, timestamptz, boolean, bigint) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, text, text, text, text, timestamptz, boolean, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- Staff: the "never zero admins" rule, race free
-- ---------------------------------------------------------------------------
-- Returns 'ok' or 'last_admin'.
create or replace function public.set_staff_role_guarded(p_user uuid, p_role text, p_actor uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  cur text;
  admins integer;
begin
  if p_role not in ('admin', 'editor') then
    raise exception 'invalid staff role' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('midflow:staff_admins', 0));
  select role into cur from public.staff_members where user_id = p_user;
  if cur = 'admin' and p_role <> 'admin' then
    select count(*) into admins from public.staff_members where role = 'admin';
    if admins <= 1 then
      return 'last_admin';
    end if;
  end if;
  insert into public.staff_members (user_id, role, created_by)
  values (p_user, p_role, p_actor)
  on conflict (user_id) do update set role = excluded.role;
  return 'ok';
end;
$$;

-- Returns 'ok', 'not_found' or 'last_admin'.
create or replace function public.remove_staff_guarded(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  cur text;
  admins integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('midflow:staff_admins', 0));
  select role into cur from public.staff_members where user_id = p_user;
  if cur is null then
    return 'not_found';
  end if;
  if cur = 'admin' then
    select count(*) into admins from public.staff_members where role = 'admin';
    if admins <= 1 then
      return 'last_admin';
    end if;
  end if;
  delete from public.staff_members where user_id = p_user;
  return 'ok';
end;
$$;

revoke all on function public.set_staff_role_guarded(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.remove_staff_guarded(uuid) from public, anon, authenticated;
grant execute on function public.set_staff_role_guarded(uuid, text, uuid) to service_role;
grant execute on function public.remove_staff_guarded(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Storage limits on user-owned data
-- ---------------------------------------------------------------------------
-- NOT VALID: existing rows are left alone, every insert and update from now on is checked.
-- Run "alter table ... validate constraint ..." after cleaning old rows, if any are bigger.
alter table public.brands        add constraint brands_data_size        check (pg_column_size(data) <= 262144) not valid;
alter table public.generations   add constraint generations_data_size   check (pg_column_size(data) <= 262144) not valid;
alter table public.library_items add constraint library_items_data_size check (pg_column_size(data) <= 262144) not valid;

-- Per-user row caps. An upsert of a row that already exists is an update and passes.
create or replace function public.enforce_user_row_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  max_rows integer := tg_argv[0]::integer;
  have     integer;
  known    boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.user_id::text, 0));
  execute format('select exists (select 1 from %I.%I where user_id = $1 and id = $2)', tg_table_schema, tg_table_name)
    into known using new.user_id, new.id;
  if known then
    return new;
  end if;
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
    into have using new.user_id;
  if have >= max_rows then
    raise exception 'Limite de % registros atingido em %.', max_rows, tg_table_name using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_user_row_limit() from public, anon, authenticated;
grant execute on function public.enforce_user_row_limit() to service_role;

create trigger brands_row_limit        before insert on public.brands        for each row execute function public.enforce_user_row_limit(50);
create trigger generations_row_limit   before insert on public.generations   for each row execute function public.enforce_user_row_limit(500);
create trigger library_items_row_limit before insert on public.library_items for each row execute function public.enforce_user_row_limit(2000);
