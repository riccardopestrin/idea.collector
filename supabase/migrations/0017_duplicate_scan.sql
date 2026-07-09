-- Scan anti-duplicato locale + competitor web (RFC-006, branch ideaChecker).
--
-- [1] Colonne dup_* su proposals: stato dello scan (riusa l'enum ai_eval_status,
--     0010), hard flag, match locale, punteggio e report scritto da Claude.
--     Se l'idea matchata viene eliminata, dup_match_id va a null ma il flag
--     resta: il re-scan (edit o Rilancia) lo ricalcola.
-- [2] can_run_dup_scan: admin, oppure proposer con proposta in 'nuova' (lo
--     scan ha senso solo lì: il gate blocca solo l'uscita da 'nuova').
-- [3] RPC SECURITY DEFINER begin/apply/fail (pattern 0010/0011/0013) con GUC
--     transaction-local idea.dup_scan letta dal trigger — pattern move_proposal
--     (0005/0006): senza GUC il trigger [5] rifiuterebbe la scrittura delle
--     colonne dup_* fatta da un proposer non-admin.
-- [4] move_proposal esteso: backstop del blocco — una proposta dup_flagged
--     non esce da 'nuova' se non verso 'rifiutata'. Il delete resta libero
--     (policy "owner or admin delete", 0005).
-- [5] enforce_proposal_privileged_columns esteso alle colonne dup_*: non
--     scrivibili via PostgREST diretto, solo RPC (GUC) o admin.

-- [1] colonne
alter table public.proposals
  add column dup_scan_status public.ai_eval_status not null default 'assente',
  add column dup_scan_error text,
  add column dup_flagged boolean not null default false,
  add column dup_match_id uuid references public.proposals(id) on delete set null,
  add column dup_similarity integer check (dup_similarity between 0 and 100),
  add column dup_report text,
  add constraint proposals_dup_match_not_self check (dup_match_id <> id);

-- [2] autorizzazione comune delle RPC di scan
create function public.can_run_dup_scan(p_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_admin() or exists (
    select 1 from public.proposals
    where id = p_id and proposer_id = auth.uid() and status = 'nuova'
  );
$$;

-- [3] RPC — transizioni di stato atomiche, GUC per il trigger [5].

-- Avvia lo scan: 'in_corso' + azzera l'errore. false se già in corso (una sola
-- in-flight); p_force recupera scan orfani di un crash (pattern 0011).
create function public.begin_dup_scan(p_id uuid, p_force boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  updated integer;
begin
  if not public.can_run_dup_scan(p_id) then
    raise exception 'non autorizzato ad avviare lo scan duplicati';
  end if;
  perform set_config('idea.dup_scan', '1', true);
  update public.proposals
    set dup_scan_status = 'in_corso', dup_scan_error = null
    where id = p_id and (p_force or dup_scan_status <> 'in_corso');
  get diagnostics updated = row_count;
  perform set_config('idea.dup_scan', '', true);
  return updated > 0;
end;
$$;

-- Persiste l'esito: flag (soglia decisa nel service, TS), match, punteggio,
-- report. La proposta flaggata resta bloccata in 'nuova' (backstop in [4]).
create function public.apply_dup_scan(
  p_id uuid,
  p_flagged boolean,
  p_similarity integer,
  p_match uuid,
  p_report text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_run_dup_scan(p_id) then
    raise exception 'non autorizzato a salvare lo scan duplicati';
  end if;
  perform set_config('idea.dup_scan', '1', true);
  update public.proposals set
    dup_flagged = p_flagged,
    dup_similarity = p_similarity,
    dup_match_id = p_match,
    dup_report = p_report,
    dup_scan_status = 'completata',
    dup_scan_error = null
    where id = p_id;
  perform set_config('idea.dup_scan', '', true);
end;
$$;

-- Marca il fallimento (non bloccante, come fail_ai_evaluation). Errore troncato.
create function public.fail_dup_scan(p_id uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_run_dup_scan(p_id) then
    raise exception 'non autorizzato ad aggiornare lo scan duplicati';
  end if;
  perform set_config('idea.dup_scan', '1', true);
  update public.proposals
    set dup_scan_status = 'fallita', dup_scan_error = left(coalesce(p_error, 'errore sconosciuto'), 500)
    where id = p_id;
  perform set_config('idea.dup_scan', '', true);
end;
$$;

revoke execute on function public.can_run_dup_scan, public.begin_dup_scan, public.apply_dup_scan, public.fail_dup_scan from public, anon;
grant execute on function public.can_run_dup_scan, public.begin_dup_scan, public.apply_dup_scan, public.fail_dup_scan to authenticated;

-- [4] move_proposal: blocco anti-duplicato prima del CAS. create or replace
-- preserva i grant di 0005/0006.
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
  if p_from = p_to then
    raise exception 'from = to: nessuna transizione';
  end if;
  -- RFC-006: una proposta flaggata come possibile duplicato non avanza (si
  -- sblocca con un edit in 'nuova' che abbassa la similarità). Gate sullo
  -- STATO del flag, non sul percorso: senza il vincolo su p_from un round-trip
  -- nuova → rifiutata → in_valutazione aggirerebbe il blocco (review chain
  -- 2026-07-08, finding [1]). Restano liberi 'rifiutata' e il rientro in
  -- 'nuova' (percorso di sblocco/re-scan).
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

-- [5] trigger esteso: le colonne dup_* diventano privilegiate, scrivibili dai
-- non-admin solo attraverso le RPC di scan (GUC idea.dup_scan).
create or replace function public.enforce_proposal_privileged_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'nuova'
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
      or new.reach is distinct from old.reach
      or new.impact is distinct from old.impact
      or new.confidence is distinct from old.confidence
      or new.effort is distinct from old.effort
      or new.ai_rationale is distinct from old.ai_rationale
      or new.ai_generated is distinct from old.ai_generated
      or new.manually_edited is distinct from old.manually_edited
      or new.internal_notes is distinct from old.internal_notes
      or new.ai_eval_status is distinct from old.ai_eval_status
      or new.ai_eval_error is distinct from old.ai_eval_error
    then
      raise exception 'solo un admin può modificare proposer o campi AI/note interne';
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
