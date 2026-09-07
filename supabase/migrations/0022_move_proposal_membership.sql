-- Review chain + Security Expert 2026-09-07 su 0021 (RFC-007).
--
-- [1] move_proposal era l'unica RPC security definer callable da authenticated
--     senza legame con l'identità: bastava conoscere l'uuid di una proposta per
--     spostarla e firmare status_history da fuori progetto (es. un ex-membro
--     rimosso). Si aggiunge il gate di membership; il resto del corpo è quello
--     di 0018 (state machine) + 0017 (blocco duplicati), identico.
-- [2] tags / proposal_tags: mai usate dal codice, con policy globali
--     (`using (true)`, `with check (true)`) incoerenti con l'isolamento per
--     progetto. Schema morto: si eliminano.
-- [3] SEC-12: in 0021 il trigger valutava is_project_admin(new.project_id) — il
--     progetto di DESTINAZIONE — prima del lock su project_id: il proposer di
--     una proposta in A, admin di un proprio progetto B, poteva spostarla in B
--     via PostgREST portandosi via commenti e voti altrui. Il lock diventa il
--     primo statement, incondizionato. Resto del corpo identico a 0021.
-- [4] SEC-14: le RPC di promozione (0016) autorizzano per identità (autore /
--     proposer / admin), non per membership: un ex-membro conservava i poteri
--     sui propri commenti. Gate di membership in promotion_target, il guard
--     comune delle tre RPC.
-- [5] SEC-13: le colonne github_* di projects non sono più scrivibili via
--     PostgREST (un admin poteva legare il progetto a un'installazione altrui
--     della nostra App e leggerne le repo tramite l'eval). Scrittura solo dal
--     server con il client service-role dopo il guard admin (pattern 0020);
--     authenticated aggiorna solo name.

-- [1] create or replace preserva i grant di 0005/0006.
create or replace function public.move_proposal(
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
  -- solo i membri del progetto della proposta (0021)
  if not public.is_project_member(public.proposal_project(p_id)) then
    raise exception 'non membro del progetto';
  end if;
  if p_from = p_to then
    raise exception 'from = to: nessuna transizione';
  end if;
  -- macchina a stati della board (0018), gemella di canMoveTo
  if not (
    (p_from = 'nuova' and p_to in ('in_valutazione', 'rifiutata'))
    or (p_from = 'in_valutazione' and p_to in ('approvata', 'rifiutata', 'archiviata'))
    or (p_from = 'approvata' and p_to in ('in_sviluppo', 'rifiutata'))
    or (p_from = 'in_sviluppo' and p_to in ('rilasciata', 'archiviata', 'rifiutata'))
    or (p_from = 'rilasciata' and p_to = 'rifiutata')
    or (p_from = 'archiviata' and p_to in ('in_valutazione', 'approvata', 'in_sviluppo', 'rifiutata'))
  ) then
    raise exception 'transizione non consentita: % -> %', p_from, p_to;
  end if;
  -- RFC-006: una proposta flaggata come possibile duplicato non avanza (0017)
  if p_to not in ('rifiutata', 'nuova') and exists (
    select 1 from public.proposals where id = p_id and dup_flagged
  ) then
    raise exception 'proposta segnalata come possibile duplicato';
  end if;
  perform set_config('idea.move_proposal', '1', true);
  update public.proposals set status = p_to
    where id = p_id and status = p_from;
  -- row_count va letto PRIMA del reset: get diagnostics guarda l'ultimo statement
  get diagnostics moved = row_count;
  perform set_config('idea.move_proposal', '', true);
  if moved = 0 then
    return false; -- proposta inesistente o già spostata da qualcun altro (CAS)
  end if;
  insert into public.status_history (proposal_id, from_status, to_status, author_id)
  values (p_id, p_from, p_to, auth.uid());
  return true;
end;
$$;

-- [2] schema morto
drop table public.proposal_tags;
drop table public.tags;

-- [3] lock su project_id prima di qualsiasi bypass admin
create or replace function public.enforce_proposal_privileged_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'una proposta non cambia progetto';
  end if;
  if public.is_project_admin(new.project_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'nuova'
      or new.method <> 'rice'
      or new.reach is not null
      or new.impact is not null
      or new.confidence is not null
      or new.effort is not null
      or new.ai_rationale is not null
      or new.ai_generated
      or new.manually_edited
      or new.internal_notes is not null
      or new.ai_eval_status <> 'assente'
      or new.ai_eval_error is not null
      or new.dup_scan_status <> 'assente'
      or new.dup_scan_error is not null
      or new.dup_flagged
      or new.dup_match_id is not null
      or new.dup_similarity is not null
      or new.dup_report is not null
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
      or new.method is distinct from old.method
      or new.internal_notes is distinct from old.internal_notes
    then
      raise exception 'solo un admin può modificare proposer, method o note interne';
    end if;
    if (new.reach is distinct from old.reach
      or new.impact is distinct from old.impact
      or new.confidence is distinct from old.confidence
      or new.effort is distinct from old.effort
      or new.ai_rationale is distinct from old.ai_rationale
      or new.ai_generated is distinct from old.ai_generated
      or new.manually_edited is distinct from old.manually_edited
      or new.ai_eval_status is distinct from old.ai_eval_status
      or new.ai_eval_error is distinct from old.ai_eval_error)
      and current_setting('idea.ai_eval', true) is distinct from '1'
    then
      raise exception 'le colonne della valutazione AI si scrivono solo dalle RPC eval';
    end if;
    if (new.dup_scan_status is distinct from old.dup_scan_status
      or new.dup_scan_error is distinct from old.dup_scan_error
      or new.dup_flagged is distinct from old.dup_flagged
      or new.dup_match_id is distinct from old.dup_match_id
      or new.dup_similarity is distinct from old.dup_similarity
      or new.dup_report is distinct from old.dup_report)
      and current_setting('idea.dup_scan', true) is distinct from '1'
    then
      raise exception 'le colonne dello scan duplicati si scrivono solo dalle RPC dup_scan';
    end if;
  end if;
  return new;
end;
$$;

-- [4] membership nel guard comune delle RPC di promozione (0016)
create or replace function public.promotion_target(p_comment_id uuid)
returns public.comments language plpgsql security definer set search_path = '' stable as $$
declare
  c public.comments;
begin
  if auth.uid() is null then
    raise exception 'non autenticato';
  end if;
  select * into c from public.comments where id = p_comment_id;
  if not found then
    raise exception 'commento inesistente';
  end if;
  if not public.is_project_member(public.proposal_project(c.proposal_id)) then
    raise exception 'non membro del progetto';
  end if;
  if not exists (
    select 1 from public.proposals p
    where p.id = c.proposal_id and p.status in ('nuova', 'in_valutazione')
  ) then
    raise exception 'proposta non più aperta: promozione congelata';
  end if;
  return c;
end;
$$;

-- [5] github_* solo lato server (service-role, dopo il guard admin)
revoke update on table public.projects from authenticated;
grant update (name) on table public.projects to authenticated;
