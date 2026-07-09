-- Macchina a stati della board (branch cardDirections): move_proposal diventa
-- il backstop DB delle transizioni consentite, gemello del guard applicativo
-- canMoveTo (src/lib/board.ts) e di updateProposalStatus. Il grafo:
--   nuova          -> in_valutazione, rifiutata
--   in_valutazione -> approvata, rifiutata, archiviata
--   approvata      -> in_sviluppo, rifiutata
--   in_sviluppo    -> rilasciata, archiviata, rifiutata
--   rilasciata     -> rifiutata
--   rifiutata      -> (terminale: solo DELETE)
--   archiviata     -> in_valutazione, approvata, in_sviluppo, rifiutata
-- DELETE resta libero (policy "owner or admin delete", 0005): non passa da qui.
-- create or replace preserva i grant di 0005/0006 e il blocco dup di 0017.
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
  -- transizione consentita dalla macchina a stati?
  if not (
    (p_from = 'nuova'          and p_to in ('in_valutazione', 'rifiutata')) or
    (p_from = 'in_valutazione' and p_to in ('approvata', 'rifiutata', 'archiviata')) or
    (p_from = 'approvata'      and p_to in ('in_sviluppo', 'rifiutata')) or
    (p_from = 'in_sviluppo'    and p_to in ('rilasciata', 'archiviata', 'rifiutata')) or
    (p_from = 'rilasciata'     and p_to = 'rifiutata') or
    (p_from = 'archiviata'     and p_to in ('in_valutazione', 'approvata', 'in_sviluppo', 'rifiutata'))
  ) then
    raise exception 'transizione non consentita: % -> %', p_from, p_to;
  end if;
  -- RFC-006: una proposta flaggata come possibile duplicato non avanza (si
  -- sblocca con un edit in 'nuova' che abbassa la similarità). Gate sullo STATO
  -- del flag: resta libera solo 'rifiutata' (l'uscita di scarto). 'nuova' non è
  -- più un target raggiungibile dalla macchina a stati ma resta nell'elenco per
  -- coerenza col guard applicativo.
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
