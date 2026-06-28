-- Hardening delle funzioni SECURITY DEFINER: senza search_path esplicito non
-- risolvevano `profiles` e — peggio — erano esposte a search-path hijack.
--
-- handle_new_user: falliva all'invito/registrazione ("Database error saving new
-- user") perché nel contesto di auth non trovava la tabella.
-- is_admin: regge tutte le policy RLS, quindi è la più importante da blindare.
--
-- Fix: set search_path = '' + qualificazione esplicita dello schema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;
