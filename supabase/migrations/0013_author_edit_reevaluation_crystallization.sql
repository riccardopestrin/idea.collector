-- Edit dell'autore + ri-valutazione AI + cristallizzazione (RFC-004 Fase E, ADR-0005).
--
-- [1] can_run_ai_evaluation: le RPC begin/apply/fail (0010/0011) passano da
--     is_admin()-only a "admin, oppure proposer con proposta in_valutazione".
--     Superficie allargata consapevolmente (ADR-0005): l'autore può muovere
--     ai_eval_status solo sulla propria proposta e solo mentre è in valutazione.
-- [2] Cristallizzazione: da 'approvata' in poi niente edit non-admin e niente
--     nuovi commenti (per tutti). Guard nel Server Action, qui il backstop.

-- [1] helper + RPC rilassate
create function public.can_run_ai_evaluation(p_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_admin() or exists (
    select 1 from public.proposals
    where id = p_id and proposer_id = auth.uid() and status = 'in_valutazione'
  );
$$;

create or replace function public.begin_ai_evaluation(p_id uuid, p_force boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  updated integer;
begin
  if not public.can_run_ai_evaluation(p_id) then
    raise exception 'non autorizzato ad avviare la valutazione AI';
  end if;
  update public.proposals
    set ai_eval_status = 'in_corso', ai_eval_error = null
    where id = p_id and (p_force or ai_eval_status <> 'in_corso');
  get diagnostics updated = row_count;
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
  update public.proposals set
    reach = p_reach,
    impact = p_impact,
    confidence = p_confidence,
    effort = p_effort,
    ai_rationale = p_rationale,
    ai_generated = true,
    manually_edited = false,
    ai_eval_status = 'completata',
    ai_eval_error = null
    where id = p_id;
end;
$$;

create or replace function public.fail_ai_evaluation(p_id uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_run_ai_evaluation(p_id) then
    raise exception 'non autorizzato ad aggiornare la valutazione AI';
  end if;
  update public.proposals
    set ai_eval_status = 'fallita', ai_eval_error = left(coalesce(p_error, 'errore sconosciuto'), 500)
    where id = p_id;
end;
$$;

revoke execute on function public.can_run_ai_evaluation from public, anon;
grant execute on function public.can_run_ai_evaluation to authenticated;

-- [2a] cristallizzazione edit: un non-admin non modifica i *contenuti* di una
-- proposta oltre 'in_valutazione'. Solo i campi testuali: i cambi di status
-- dalla board (move_proposal) restano liberi come da ADR-0002.
create function public.enforce_proposal_crystallization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin()
    and old.status not in ('nuova', 'in_valutazione')
    and (new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.problem is distinct from old.problem
      or new.links is distinct from old.links)
  then
    raise exception 'proposta non più modificabile (cristallizzata)';
  end if;
  return new;
end;
$$;

create trigger proposal_crystallization
  before update on public.proposals
  for each row execute function public.enforce_proposal_crystallization();

-- [2b] cristallizzazione commenti: insert consentito solo con proposta in
-- 'nuova' o 'in_valutazione' (vale anche per gli admin, per tutti come da RFC).
drop policy "author insert" on public.comments;
create policy "author insert on open proposal" on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.status in ('nuova', 'in_valutazione')
    )
  );
