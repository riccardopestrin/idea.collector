-- Valutazione RICE automatica (RFC-003, ADR-0003/0004).
--
-- [1] Stato della valutazione per la UI cue (rotella / pallino / rilancia).
-- [2] app_settings: riga singola con la config del repo GitHub collegato.
--     Nessun secret: installation_id non è un segreto, la private key sta in env.
-- [3] RPC SECURITY DEFINER admin-only per scrivere le colonne AI. Niente GUC:
--     il trigger lascia già passare gli admin (is_admin()), e le RPC rifiutano
--     i non-admin — il seam è il check dentro la funzione + RLS come backstop.
-- [4] Trigger esteso: anche method/reach/impact/confidence/effort e le nuove
--     colonne di stato diventano privilegiate (0003 non copriva i punteggi).

-- [1] enum + colonne stato
create type public.ai_eval_status as enum ('assente', 'in_corso', 'completata', 'fallita');

alter table public.proposals
  add column ai_eval_status public.ai_eval_status not null default 'assente',
  add column ai_eval_error text;

-- [2] app_settings riga singola (id sempre true)
create table public.app_settings (
  id boolean primary key default true check (id),
  github_installation_id bigint,
  github_owner text,
  github_repo text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "authenticated read" on public.app_settings for select to authenticated
  using (true);
create policy "admin insert" on public.app_settings for insert to authenticated
  with check (public.is_admin());
create policy "admin update" on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- pattern 0004: grant espliciti, niente anon
revoke all on table public.app_settings from public, anon;
grant select, insert, update on table public.app_settings to authenticated;

-- [4] trigger esteso alle colonne di scoring e di stato valutazione
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
  end if;
  return new;
end;
$$;

-- [3] RPC di valutazione — admin-only, transizioni di stato atomiche.

-- Avvia la valutazione: 'in_corso' + azzera l'errore. Ritorna false se una
-- valutazione è già in corso (una sola in-flight per proposta) o se la
-- proposta non esiste.
create function public.begin_ai_evaluation(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  updated integer;
begin
  if not public.is_admin() then
    raise exception 'solo un admin può avviare la valutazione AI';
  end if;
  update public.proposals
    set ai_eval_status = 'in_corso', ai_eval_error = null
    where id = p_id and ai_eval_status <> 'in_corso';
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- Persiste il risultato: punteggi + rationale, 'completata'.
create function public.apply_ai_evaluation(
  p_id uuid,
  p_reach numeric,
  p_impact numeric,
  p_confidence numeric,
  p_effort numeric,
  p_rationale text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'solo un admin può salvare la valutazione AI';
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

-- Marca il fallimento (non bloccante: il move resta valido). Errore troncato.
create function public.fail_ai_evaluation(p_id uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'solo un admin può aggiornare la valutazione AI';
  end if;
  update public.proposals
    set ai_eval_status = 'fallita', ai_eval_error = left(coalesce(p_error, 'errore sconosciuto'), 500)
    where id = p_id;
end;
$$;

revoke execute on function public.begin_ai_evaluation, public.apply_ai_evaluation, public.fail_ai_evaluation from public, anon;
grant execute on function public.begin_ai_evaluation, public.apply_ai_evaluation, public.fail_ai_evaluation to authenticated;
