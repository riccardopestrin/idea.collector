-- #8/#9c: il voto RICE utente diventa MODIFICABILE e consentito in ogni stato
-- tranne 'nuova' (prima 0015: solo 'in_valutazione', immutabile). Il service fa
-- upsert sul vincolo (proposal_id, voter_id); qui il backstop RLS:
--  - insert: stessa forma di 0015 ma il gate di stato passa da '= in_valutazione'
--    a '<> nuova';
--  - update: il votante aggiorna il PROPRIO voto, stesso gate di stato;
--  - grant update solo sulle 4 componenti (mai voter_id/proposal_id, così un
--    update non può spostare il voto su un'altra proposta o cambiarne il titolare).
drop policy "voter insert" on public.rice_votes;
create policy "voter insert" on public.rice_votes for insert to authenticated
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id
        and p.status <> 'nuova'
        and p.proposer_id <> auth.uid()
    )
  );

create policy "voter update" on public.rice_votes for update to authenticated
  using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id
        and p.status <> 'nuova'
        and p.proposer_id <> auth.uid()
    )
  );

grant update (reach, impact, confidence, effort) on table public.rice_votes to authenticated;
