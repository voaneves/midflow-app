-- Atomic quota reservation.
-- The API used to read the usage counter, check the plan limit and increment it in three separate calls, so parallel
-- requests could all pass the check and exceed the monthly allowance. reserve_usage does check and increment in a single
-- statement; refund_usage gives back what was reserved but not delivered (transient AI failure, fewer items than expected).
-- Both are callable only by the service role (the API); the browser can never touch the counters.

create function public.reserve_usage(p_user uuid, p_period text, p_cost integer, p_limit integer) returns integer
language sql security definer set search_path = '' as $$
  -- New row: reserved only when the cost itself fits the limit. Existing row: the update applies only while used + cost <= limit.
  -- No row returned (null) means the reservation was refused: over the limit.
  insert into public.usage_counters as u (user_id, period, used)
  select p_user, p_period, greatest(p_cost, 0)
  where greatest(p_cost, 0) <= p_limit
  on conflict (user_id, period)
  do update set used = u.used + greatest(p_cost, 0), updated_at = now()
  where u.used + greatest(p_cost, 0) <= p_limit
  returning u.used;
$$;
revoke all on function public.reserve_usage(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_usage(uuid, text, integer, integer) to service_role;

create function public.refund_usage(p_user uuid, p_period text, p_cost integer) returns integer
language sql security definer set search_path = '' as $$
  update public.usage_counters
  set used = greatest(used - greatest(p_cost, 0), 0), updated_at = now()
  where user_id = p_user and period = p_period
  returning used;
$$;
revoke all on function public.refund_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.refund_usage(uuid, text, integer) to service_role;
