-- Eliminazione account self-service. Il profilo sopravvive alla riga auth.users
-- (via la FK cascade) perché proposte, commenti, voti e history restano
-- attribuiti alla riga; senza membership la RLS "self or co-member read" lo
-- rende illeggibile (personLabel → "sconosciuto") e la RPC lo anonimizza.
-- La riga auth.users la cancella la Server Action con il service role, dopo.
alter table public.profiles drop constraint profiles_id_fkey;

create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  stuck text;
begin
  if uid is null then
    raise exception 'non autenticato';
  end if;
  -- progetti con altri membri di cui sono l'unico admin: resterebbero orfani
  select string_agg(p.name, ', ' order by p.name) into stuck
    from public.projects p
    where exists (select 1 from public.project_members m
                  where m.project_id = p.id and m.user_id = uid and m.role = 'admin')
      and exists (select 1 from public.project_members m
                  where m.project_id = p.id and m.user_id <> uid)
      and not exists (select 1 from public.project_members m
                      where m.project_id = p.id and m.user_id <> uid and m.role = 'admin');
  if stuck is not null then
    raise exception 'unico admin: %', stuck;
  end if;
  -- progetti in cui sono l'unico membro: via con tutto (cascade FK)
  delete from public.projects p
    where exists (select 1 from public.project_members m
                  where m.project_id = p.id and m.user_id = uid)
      and not exists (select 1 from public.project_members m
                      where m.project_id = p.id and m.user_id <> uid);
  delete from public.project_members where user_id = uid;
  update public.profiles set name = null, email = '' where id = uid;
end;
$$;
revoke execute on function public.delete_account from public, anon;
grant execute on function public.delete_account to authenticated;
