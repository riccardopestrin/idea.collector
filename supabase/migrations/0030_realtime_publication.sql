-- #3: aggiornamento sincrono cross-utente ("come ClickUp"). Le tabelle entrano
-- nella publication realtime di Supabase; Realtime rispetta la RLS, quindi ogni
-- utente riceve solo gli eventi delle righe che può leggere (i propri progetti).
--
-- replica identity full: senza, un evento DELETE non porta la riga vecchia, e
-- Realtime non può valutare la RLS sul delete (né far sparire live una proposta
-- eliminata per gli altri utenti). Costo: un po' più di WAL sugli update; qui
-- accettabile (tabelle a basso volume di scrittura).
alter table public.proposals replica identity full;
alter table public.status_history replica identity full;
alter table public.comments replica identity full;
alter table public.rice_votes replica identity full;
alter table public.projects replica identity full;
alter table public.project_members replica identity full;

alter publication supabase_realtime add table
  public.proposals,
  public.status_history,
  public.comments,
  public.rice_votes,
  public.projects,
  public.project_members;
