-- Commenti/osservazioni sulle proposte (Step 4, pannello dettaglio).
-- Lettura aperta a tutti i membri; inserisce solo l'autore autenticato.
-- Niente update/delete finché non esiste una UI che li usa (YAGNI).
create table comments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index comments_proposal_created_idx on comments (proposal_id, created_at);

alter table comments enable row level security;

create policy "auth read" on comments for select to authenticated using (true);
create policy "author insert" on comments for insert to authenticated
  with check (author_id = auth.uid());

-- Grant DML espliciti come in 0004: i progetti Supabase nuovi non li danno di default.
grant select, insert on table public.comments to authenticated;
