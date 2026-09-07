-- Eliminazione progetto: solo l'admin del progetto. Irreversibile: le FK di
-- project_members e proposals (0021) sono on delete cascade, e da proposals
-- cascano commenti, voti, history e tag. Le referential action girano come
-- owner della tabella, quindi non servono policy di delete sui figli.
grant delete on table public.projects to authenticated;
create policy "admin delete" on public.projects for delete to authenticated
  using (public.is_project_admin(id));
