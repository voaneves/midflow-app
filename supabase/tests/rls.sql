-- pgTAP assertions for the MIDFLOW access model (RLS, column grants, function privileges).
--
-- Not run in CI and not part of `npm test`: it needs a Postgres with the Supabase auth schema and pgTAP.
-- Run it against a local or branch database with the Supabase CLI:
--
--   supabase start
--   supabase db reset            # applies supabase/migrations/*
--   supabase test db             # runs supabase/tests/*.sql
--
-- Everything runs inside a transaction that is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Two customers and one staff member.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-000000000001', 'ana@example.com',   now(), '{"name":"Ana"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000002', 'bruno@example.com', now(), '{"name":"Bruno"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000003', 'unconfirmed@example.com', null, '{}', 'authenticated', 'authenticated');

insert into public.staff_members (user_id, role) values ('00000000-0000-4000-8000-000000000002', 'admin');
insert into public.subscriptions (user_id, plan, status) values ('00000000-0000-4000-8000-000000000001', 'start', 'active');
insert into public.review_requests (id, user_id, brand_name, admin_note, contact_email)
values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Studio Aurora', 'internal', 'ana@example.com');

-- Act as Ana (a signed-in customer).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- profiles -------------------------------------------------------------------
select lives_ok($$update public.profiles set name = 'Ana B.', company = 'Aurora' where id = auth.uid()$$, 'customer can edit name and company');
select throws_ok($$update public.profiles set email = 'admin@example.com' where id = auth.uid()$$, '42501', null, 'customer cannot edit profiles.email');
select throws_ok($$update public.profiles set id = '00000000-0000-4000-8000-000000000009' where id = auth.uid()$$, '42501', null, 'customer cannot edit profiles.id');
select throws_ok($$insert into public.profiles (id, email) values ('00000000-0000-4000-8000-000000000009', 'x@example.com')$$, '42501', null, 'customer cannot insert profiles');
select throws_ok($$delete from public.profiles where id = auth.uid()$$, '42501', null, 'customer cannot delete profiles');

-- server-written tables ------------------------------------------------------
select throws_ok($$update public.subscriptions set plan = 'business' where user_id = auth.uid()$$, '42501', null, 'customer cannot write subscriptions');
select throws_ok($$insert into public.usage_counters (user_id, period, used) values (auth.uid(), '2026-11', 0)$$, '42501', null, 'customer cannot write usage_counters');
select throws_ok($$update public.usage_counters set used = 0 where user_id = auth.uid()$$, '42501', null, 'customer cannot reset usage_counters');
select throws_ok($$insert into public.staff_members (user_id, role) values (auth.uid(), 'admin')$$, '42501', null, 'customer cannot grant themselves staff access');
select throws_ok($$select * from public.stripe_events$$, '42501', null, 'customer cannot read stripe_events');

-- reviews: own rows, limited columns -------------------------------------------
select is((select count(*)::int from (select id, status, brand_name from public.review_requests) r), 1, 'customer reads own review requests');
select throws_ok($$select admin_note from public.review_requests$$, '42501', null, 'customer cannot read review_requests.admin_note');
select throws_ok($$select contact_email from public.review_requests$$, '42501', null, 'customer cannot read review_requests.contact_email');
select throws_ok($$update public.review_requests set status = 'resolved'$$, '42501', null, 'customer cannot update review_requests');

-- functions -------------------------------------------------------------------
select throws_ok($$select public.increment_usage(auth.uid(), '2026-11', 1)$$, '42501', null, 'customer cannot execute increment_usage');
select throws_ok($$select * from public.find_confirmed_user_by_email('bruno@example.com')$$, '42501', null, 'customer cannot execute find_confirmed_user_by_email');
select throws_ok($$select public.set_staff_role_guarded(auth.uid(), 'admin', auth.uid())$$, '42501', null, 'customer cannot execute set_staff_role_guarded');
select throws_ok($$select public.apply_subscription_event(auth.uid(), 'active', 'business', null, null, null, null, 1)$$, '42501', null, 'customer cannot execute apply_subscription_event');
select throws_ok($$select public.reserve_usage(auth.uid(), '2026-11', 1, 1000)$$, '42501', null, 'customer cannot execute reserve_usage');
select throws_ok($$select public.refund_usage(auth.uid(), '2026-11', 1)$$, '42501', null, 'customer cannot execute refund_usage');
select throws_ok($$select public.remove_staff_guarded(auth.uid())$$, '42501', null, 'customer cannot execute remove_staff_guarded');
select throws_ok($$select public.set_staff_role_guarded(auth.uid(), 'editor', auth.uid())$$, '42501', null, 'customer cannot execute set_staff_role_guarded as an editor either');

-- other people's data ------------------------------------------------------------
select is((select count(*)::int from public.profiles where id <> auth.uid()), 0, 'customer cannot read other profiles');

reset role;

-- the same functions are closed to anon as well
set local role anon;
select throws_ok($$select public.reserve_usage('00000000-0000-4000-8000-000000000001', '2026-11', 1, 1000)$$, '42501', null, 'anon cannot execute reserve_usage');
reset role;

-- service role behaviour -------------------------------------------------------
set local role service_role;
select is((select count(*)::int from public.find_confirmed_user_by_email('BRUNO@example.com')), 1, 'service role finds a confirmed user, case-insensitively');
select is((select count(*)::int from public.find_confirmed_user_by_email('unconfirmed@example.com')), 0, 'unconfirmed accounts are not returned');
select is(public.remove_staff_guarded('00000000-0000-4000-8000-000000000002'), 'last_admin', 'the last admin cannot be removed');
select is(public.apply_subscription_event('00000000-0000-4000-8000-000000000001', 'canceled', null, null, null, null, null, 100)
        and not public.apply_subscription_event('00000000-0000-4000-8000-000000000001', 'active', null, null, null, null, null, 50),
        true, 'a stale subscription event is ignored');
reset role;

select * from finish();
rollback;
