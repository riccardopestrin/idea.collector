-- #9: libertà assoluta di spostamento. move_proposal non vincola più le
-- transizioni (era la macchina a stati di 0018): ogni membro sposta una card in
-- qualsiasi stato distinto (l'unico vincolo lato app è from <> to). Restano
-- invariati: il blocco duplicati RFC-006 (una card flaggata
-- non esce da 'nuova' se non verso 'rifiutata'), il compare-and-set su p_from e
-- l'insert in status_history. create or replace preserva grant e chiamanti.
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
  -- sblocca con un edit in 'nuova' che abbassa la similarità). Resta libera solo
  -- 'rifiutata' (l'uscita di scarto); 'nuova' non è un target reale per una card
  -- flaggata (è già lì, e from = to è bloccato), ma resta per simmetria col guard.
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
