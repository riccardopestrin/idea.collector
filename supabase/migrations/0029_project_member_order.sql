-- #6: ordine manuale delle bacheche in home, PER-UTENTE. Ogni membership porta
-- una 'position'; l'utente riordina trascinando le card. Le nuove membership
-- partono da 0 (in cima, prima di quelle già riordinate; a parità di position il
-- tie-break è created_at, gestito in TS in listProjects).
--
-- Il riordino passa da una RPC security definer, NON da un update self su
-- project_members: aprire una policy update sulla propria riga, insieme al grant
-- update(role) di 0021, permetterebbe l'auto-promozione ad admin. La RPC tocca
-- solo le righe di auth.uid() e solo la colonna position.
alter table public.project_members add column position integer not null default 0;

create function public.reorder_projects(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'non autenticato';
  end if;
  update public.project_members m
    set position = o.idx
    from unnest(p_ids) with ordinality as o(project_id, idx)
    where m.user_id = auth.uid() and m.project_id = o.project_id;
end;
$$;
revoke execute on function public.reorder_projects from public, anon;
grant execute on function public.reorder_projects to authenticated;
