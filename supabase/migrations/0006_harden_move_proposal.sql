-- Hardening di move_proposal (review chain 2026-07-02, finding [1] e [2]).
--
-- [1] La GUC idea.move_proposal viene azzerata subito dopo l'update: prima
--     restava '1' per il resto della transazione chiamante, e un update diretto
--     dello status accodato nella stessa transazione avrebbe aggirato il trigger
--     senza riga di history. (Il SET nell'header della funzione sarebbe più
--     pulito ma richiede superuser dal PG15 — il ruolo postgres di Supabase non
--     può: "permission denied to set parameter".) Se l'update solleva
--     un'eccezione la transazione abortisce, quindi il reset esplicito serve
--     solo sul percorso di successo.
-- [2] p_from = p_to rifiutato: passava il CAS e inseriva transizioni X → X
--     in status_history — spazzatura nell'audit trail. L'app non lo chiama
--     mai con stati uguali (guard in updateProposalStatus), quindi l'eccezione
--     è il segnale onesto per una chiamata diretta malformata.
--
-- create or replace preserva i grant di 0005.
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
