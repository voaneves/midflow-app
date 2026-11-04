-- Google sign-in: the provider sends the display name as "full_name" (and "name"), while e-mail sign-up stores "name".
-- Same function as in 20261103020000_security_hardening.sql (security definer, empty search_path, qualified names),
-- only the name now falls back to "full_name". Company and segment stay null for Google users until they fill the brand.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name, company, segment)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'company',
    new.raw_user_meta_data ->> 'segment'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
