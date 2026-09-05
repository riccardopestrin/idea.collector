-- Branch newFeatures: poteri admin + chiusura SEC-9/SEC-8 + git_ref.
--
-- [1] SEC-9 (HIGH) / SEC-8: gli esiti di scan duplicati e valutazione AI non
--     sono più scrivibili dall'utente autenticato. Le RPC begin/apply/fail
--     passano a service_role: la Server Action autorizza (proposer/admin,
--     contributore accepted) ed esegue la scrittura con il client service-role
--     lato server (src/lib/supabase/admin.ts). Il soggetto vincolato dal gate
--     non può più scriverne il verdetto via PostgREST — la superficie di
--     forging sparisce per costruzione. can_run_* diventano dead code: drop.
--     Il trigger enforce_proposal_privileged_columns resta com'è: sotto
--     service_role is_admin() è false e passano solo le colonne coperte dalle
--     GUC idea.ai_eval / idea.dup_scan settate dalle RPC.
-- [2] service_role: Supabase non concede DML di default ai ruoli sulle tabelle
--     di public (pattern 0004) — senza questi grant il client admin non legge
--     né scrive nulla.
-- [3] set_profile_role: l'admin cambia il ruolo di un altro profilo. Il grant
--     di colonna (0003) blocca update(role) via PostgREST anche agli admin;
--     l'RPC security definer con check is_admin() è il seam + backstop.
-- [4] Commenti: l'admin elimina qualsiasi commento non-accepted su proposta
--     aperta (stessi limiti dell'autore, 0016). Niente edit dei commenti altrui.
-- [5] proposals.git_ref: branch o PR (#n) della repo collegata su cui si lavora.
--     Scrivibile da proposer/admin (policy "owner or admin update"); non è un
--     campo di contenuto, quindi fuori dalla cristallizzazione (0013).

-- [1] RPC → service_role
create or replace function public.begin_dup_scan(p_id uuid, p_force boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  updated integer;
begin
  perform set_config('idea.dup_scan', '1', true);
  update public.proposals
    set dup_scan_status = 'in_corso', dup_scan_error = null
    where id = p_id and (p_force or dup_scan_status <> 'in_corso');
  get diagnostics updated = row_count;
  perform set_config('idea.dup_scan', '', true);
  return updated > 0;
end;
$$;

create or replace function public.apply_dup_scan(
  p_id uuid,
  p_flagged boolean,
  p_similarity integer,
  p_match uuid,
  p_report text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('idea.dup_scan', '1', true);
  update public.proposals set
    dup_flagged = p_flagged,
    dup_similarity = p_similarity,
    dup_match_id = p_match,
    dup_report = left(p_report, 8000),
    dup_scan_status = 'completata',
    dup_scan_error = null
    where id = p_id;
  perform set_config('idea.dup_scan', '', true);
end;
$$;

create or replace function public.fail_dup_scan(p_id uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('idea.dup_scan', '1', true);
  update public.proposals
    set dup_scan_status = 'fallita', dup_scan_error = left(coalesce(p_error, 'errore sconosciuto'), 500)
    where id = p_id;
  perform set_config('idea.dup_scan', '', true);
end;
$$;

create or replace function public.begin_ai_evaluation(p_id uuid, p_force boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  updated integer;
begin
  perform set_config('idea.ai_eval', '1', true);
  update public.proposals
    set ai_eval_status = 'in_corso', ai_eval_error = null
    where id = p_id and (p_force or ai_eval_status <> 'in_corso');
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
  -- backstop SEC-8 (0019): si rifiuta, non si clampa
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
  perform set_config('idea.ai_eval', '1', true);
  update public.proposals
    set ai_eval_status = 'fallita', ai_eval_error = left(coalesce(p_error, 'errore sconosciuto'), 500)
    where id = p_id;
  perform set_config('idea.ai_eval', '', true);
end;
$$;

-- Il grant è l'unico gate: nessun check interno (auth.uid() è null sotto service_role).
revoke execute on function
  public.begin_dup_scan, public.apply_dup_scan, public.fail_dup_scan,
  public.begin_ai_evaluation, public.apply_ai_evaluation, public.fail_ai_evaluation
from public, anon, authenticated;
grant execute on function
  public.begin_dup_scan, public.apply_dup_scan, public.fail_dup_scan,
  public.begin_ai_evaluation, public.apply_ai_evaluation, public.fail_ai_evaluation
to service_role;

drop function public.can_run_dup_scan(uuid);
drop function public.can_run_ai_evaluation(uuid);

-- [2] DML per il client service-role (bypassa RLS: solo lato server)
grant select, insert, update, delete on all tables in schema public to service_role;

-- [3] ruolo profilo: solo admin, mai su se stesso (non ci si toglie l'accesso da soli)
create function public.set_profile_role(p_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'solo un admin può cambiare i ruoli';
  end if;
  if p_id = auth.uid() then
    raise exception 'non puoi cambiare il tuo stesso ruolo';
  end if;
  update public.profiles set role = p_role where id = p_id;
  if not found then
    raise exception 'profilo inesistente';
  end if;
end;
$$;
revoke execute on function public.set_profile_role from public, anon;
grant execute on function public.set_profile_role to authenticated;

-- [4] admin elimina i commenti altrui (non-accepted, proposta aperta)
create policy "admin delete open" on public.comments
  for delete to authenticated
  using (
    public.is_admin()
    and promotion_status <> 'accepted'
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.status in ('nuova', 'in_valutazione')
    )
  );

-- [5] git_ref: branch name o "#123" (PR). Niente spazi, cap 200.
alter table public.proposals
  add column git_ref text check (git_ref !~ '\s' and length(git_ref) between 1 and 200);
