-- #10: macchina a stati "ibrida" + fine della cristallizzazione.
--
-- [1] move_proposal: 'nuova' è l'unica casella vincolata — da lì si esce solo
--     verso 'in_valutazione' e non ci si rientra mai; fra tutti gli altri stati
--     il movimento è libero (come 0027). Una proposta dup_flagged non si muove
--     affatto (RFC-006: si sblocca con un edit in 'nuova' o si elimina — l'uscita
--     'rifiutata' non esiste più da 'nuova'). Gemella di canMoveTo (src/lib/board.ts).
--     Restano membership (0022), CAS su p_from e insert in status_history.
-- [2] Cristallizzazione (0013) rimossa: contenuto, commenti e promozioni sono
--     modificabili in ogni stato. Il trigger e il gate di stato nelle policy dei
--     commenti (0013/0014/0016/0020) e in promotion_target (0016/0022) spariscono;
--     restano intatti i gate su chi (autore/admin/proposer) e su promotion_status.
--     I voti RICE erano già liberi fuori da 'nuova' (0028).
-- La prima valutazione AI parte al passaggio nuova → in_valutazione e viene
-- rilanciata dalle Server Action su edit del testo o dei contributi in ogni
-- stato ≠ 'nuova' (nessun backstop DB: le RPC eval sono service_role, 0020).

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
  if not public.is_project_member(public.proposal_project(p_id)) then
    raise exception 'non membro del progetto';
  end if;
  if p_from = p_to then
    raise exception 'from = to: nessuna transizione';
  end if;
  if p_to = 'nuova' or (p_from = 'nuova' and p_to <> 'in_valutazione') then
    raise exception 'transizione non consentita: % -> %', p_from, p_to;
  end if;
  if exists (select 1 from public.proposals where id = p_id and dup_flagged) then
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

-- [2a] niente più cristallizzazione del contenuto
drop trigger proposal_crystallization on public.proposals;
drop function public.enforce_proposal_crystallization();

-- [2b] commenti: stesse policy senza il gate di stato. L'exists su proposals
-- resta: sotto RLS ("member read", 0021) è il gate di membership implicito.
drop policy "author insert on open proposal" on public.comments;
create policy "author insert" on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and promotion_status = 'none'
    and exists (select 1 from public.proposals p where p.id = proposal_id)
  );

drop policy "author update own open" on public.comments;
create policy "author update own" on public.comments
  for update to authenticated
  using (
    author_id = auth.uid()
    and exists (select 1 from public.proposals p where p.id = proposal_id)
  )
  with check (author_id = auth.uid());

drop policy "author delete own open" on public.comments;
create policy "author delete own" on public.comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    and promotion_status <> 'accepted'
    and exists (select 1 from public.proposals p where p.id = proposal_id)
  );

drop policy "admin delete open" on public.comments;
create policy "admin delete" on public.comments
  for delete to authenticated
  using (
    public.is_project_admin(public.proposal_project(proposal_id))
    and promotion_status <> 'accepted'
  );

-- [2c] promozioni: resta il gate di membership (0022), cade quello di stato
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
  return c;
end;
$$;
