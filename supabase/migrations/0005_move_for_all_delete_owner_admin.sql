-- Rettifica ADR-0002 (2026-07-02): spostamento aperto a tutti i membri,
-- eliminazione solo autore o admin.
--
-- [1] move_proposal: unica via con cui un non-admin cambia lo status.
--     Transazionale (update + history in un colpo) e compare-and-set su
--     from_status: chiude be-careful 2026-07-02-1d20 (history persa / stale read).
--     security definer → gira come owner della tabella: bypassa la RLS
--     "owner or admin update" e la policy "admin insert history", che restano
--     strette per le scritture dirette via PostgREST.
create function public.move_proposal(
  p_id uuid,
  p_from public.proposal_status,
  p_to public.proposal_status
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  moved integer;
begin
  if auth.uid() is null then
    raise exception 'non autenticato';
  end if;
  -- GUC transaction-local letta dal trigger: autorizza questo cambio di status.
  perform set_config('idea.move_proposal', '1', true);
  update public.proposals set status = p_to
    where id = p_id and status = p_from;
  get diagnostics moved = row_count;
  if moved = 0 then
    return false; -- proposta inesistente o già spostata da qualcun altro (CAS)
  end if;
  insert into public.status_history (proposal_id, from_status, to_status, author_id)
  values (p_id, p_from, p_to, auth.uid());
  return true;
end;
$$;

revoke execute on function public.move_proposal from public, anon;
grant execute on function public.move_proposal to authenticated;

-- [2] Trigger di 0003: lo status esce dalle colonne admin-only e diventa
--     "solo via move_proposal (o admin)". Le altre colonne privilegiate
--     (proposer, campi AI, note interne) restano admin-only. INSERT invariato.
create or replace function public.enforce_proposal_privileged_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'nuova'
      or new.ai_rationale is not null
      or new.ai_generated
      or new.manually_edited
      or new.internal_notes is not null
    then
      raise exception 'solo un admin può impostare status, campi AI o note interne';
    end if;
  else
    if new.status is distinct from old.status
      and current_setting('idea.move_proposal', true) is distinct from '1'
    then
      raise exception 'lo status si cambia solo dalla board (move_proposal)';
    end if;
    if new.proposer_id is distinct from old.proposer_id
      or new.ai_rationale is distinct from old.ai_rationale
      or new.ai_generated is distinct from old.ai_generated
      or new.manually_edited is distinct from old.manually_edited
      or new.internal_notes is distinct from old.internal_notes
    then
      raise exception 'solo un admin può modificare proposer o campi AI/note interne';
    end if;
  end if;
  return new;
end;
$$;

-- [3] Eliminazione: da admin-only a autore-o-admin (rettifica ADR-0002).
--     status_history segue la proposta via FK on delete cascade (0001).
drop policy "admin delete" on public.proposals;
create policy "owner or admin delete" on public.proposals for delete to authenticated
  using (proposer_id = auth.uid() or public.is_admin());
