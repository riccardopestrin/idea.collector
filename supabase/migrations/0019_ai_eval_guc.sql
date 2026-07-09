-- Fix bug latente (BugFixes002): le RPC eval (0013, allargate in 0016) autorizzano
-- anche il proposer / contributor accepted, ma il trigger (0017) lascia scrivere le
-- colonne ai_* solo agli admin — il percorso non-admin (edit in_valutazione →
-- runEvaluation) falliva a DB dentro le stesse RPC. Stesso pattern del dup_scan
-- (0017): GUC transaction-local idea.ai_eval settata dalle RPC, letta dal trigger.
-- proposer_id / method / internal_notes restano admin-only senza bypass.

-- [1] RPC eval: set/reset della GUC attorno all'update (pattern 0017 [3]).

create or replace function public.begin_ai_evaluation(p_id uuid, p_force boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  updated integer;
begin
  if not public.can_run_ai_evaluation(p_id) then
    raise exception 'non autorizzato ad avviare la valutazione AI';
  end if;
  perform set_config('idea.ai_eval', '1', true);
  update public.proposals
    set ai_eval_status = 'in_corso', ai_eval_error = null
    where id = p_id and (p_force or ai_eval_status <> 'in_corso');
  -- row_count va letto PRIMA del reset (pattern 0017)
  get diagnostics updated = row_count;
  perform set_config('idea.ai_eval', '', true);
  return updated > 0;
end;
$$;

create or replace function public.apply_ai_evaluation(
  p_id uuid,
  p_reach numeric,
  p_impact numeric,
  p_confidence numeric,
  p_effort numeric,
  p_rationale text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_run_ai_evaluation(p_id) then
    raise exception 'non autorizzato a salvare la valutazione AI';
  end if;
  -- backstop SEC-8: il clamp 1-10 vive in validateScores (TS); qui si rifiuta,
  -- non si clampa, così un bug del layer TS emerge invece di essere mascherato.
  -- Il check "is null" serve: NULL not between è NULL, non true.
  if p_reach is null or p_reach not between 1 and 10
    or p_impact is null or p_impact not between 1 and 10
    or p_confidence is null or p_confidence not between 1 and 10
    or p_effort is null or p_effort not between 1 and 10
  then
    raise exception 'fattori RICE fuori range (1-10)';
  end if;
  perform set_config('idea.ai_eval', '1', true);
  update public.proposals set
    reach = p_reach,
    impact = p_impact,
    confidence = p_confidence,
    effort = p_effort,
    ai_rationale = left(p_rationale, 2000),
    ai_generated = true,
    manually_edited = false,
    ai_eval_status = 'completata',
    ai_eval_error = null
    where id = p_id;
  perform set_config('idea.ai_eval', '', true);
end;
$$;

create or replace function public.fail_ai_evaluation(p_id uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_run_ai_evaluation(p_id) then
    raise exception 'non autorizzato ad aggiornare la valutazione AI';
  end if;
  perform set_config('idea.ai_eval', '1', true);
  update public.proposals
    set ai_eval_status = 'fallita', ai_eval_error = left(coalesce(p_error, 'errore sconosciuto'), 500)
    where id = p_id;
  perform set_config('idea.ai_eval', '', true);
end;
$$;

-- [2] trigger: le colonne dell'eval passano da admin-only a GUC-gated (come le
-- dup_*). proposer_id / method / internal_notes restano admin-only.
create or replace function public.enforce_proposal_privileged_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- method era protetto solo in UPDATE (gap da 0010): senza questo check un
    -- non-admin poteva inserire method='ice' via PostgREST diretto
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
