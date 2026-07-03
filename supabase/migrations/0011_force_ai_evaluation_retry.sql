-- Review chain 2026-07-03, finding [1] (BLOCKER): una valutazione morta a metà
-- (crash/deploy tra begin e fail) lasciava 'in_corso' per sempre — begin
-- ritornava false e il "Rilancia" non compariva mai. p_force bypassa il guard
-- in-flight per il rilancio manuale dell'admin. Trade-off accettato: un force
-- durante una valutazione davvero in corso è last-writer-wins su apply/fail —
-- ok per un tool interno mono-admin.
--
-- drop + create: create or replace con firma diversa creerebbe un overload.
drop function public.begin_ai_evaluation(uuid);

create function public.begin_ai_evaluation(p_id uuid, p_force boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  updated integer;
begin
  if not public.is_admin() then
    raise exception 'solo un admin può avviare la valutazione AI';
  end if;
  update public.proposals
    set ai_eval_status = 'in_corso', ai_eval_error = null
    where id = p_id and (p_force or ai_eval_status <> 'in_corso');
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke execute on function public.begin_ai_evaluation from public, anon;
grant execute on function public.begin_ai_evaluation to authenticated;
