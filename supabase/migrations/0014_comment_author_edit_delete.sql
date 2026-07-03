-- Edit/delete dei propri commenti (solo l'autore). 0009 non aveva né policy né
-- grant per update/delete (YAGNI); si aggiungono ora che esiste la UI.
-- Coerente con la cristallizzazione (0013): consentiti solo finché la proposta
-- è aperta ('nuova'/'in_valutazione'), come l'insert. L'admin non è incluso —
-- è una capacità del creatore del commento (decisione owner).

-- Grant di colonna (come 0003 per profiles.name): l'update diretto via PostgREST
-- può toccare solo `body`; author_id/proposal_id/anchor_* restano immutabili.
grant update (body) on table public.comments to authenticated;
grant delete on table public.comments to authenticated;

create policy "author update own open" on public.comments
  for update to authenticated
  using (
    author_id = auth.uid()
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.status in ('nuova', 'in_valutazione')
    )
  )
  with check (author_id = auth.uid());

create policy "author delete own open" on public.comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.status in ('nuova', 'in_valutazione')
    )
  );
