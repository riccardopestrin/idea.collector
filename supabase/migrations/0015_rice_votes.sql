-- Voti RICE degli utenti (oltre a quello di Claude).
-- Ogni membro autenticato assegna i componenti RICE su slider 1–10; il punteggio
-- normalizzato e la media composita si calcolano in TS (src/lib/proposals.ts).
--
-- Regole (autorizzazione nel service + questo RLS come backstop):
--  - un voto per utente per proposta (unique) — immutabile: nessun update/delete
--  - solo mentre la proposta è 'in_valutazione'
--  - l'autore della proposta non può votare la propria idea
create table rice_votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals on delete cascade,
  voter_id uuid not null references profiles(id),
  -- componenti su scala 1–10 (slider). reach è null per il metodo ICE.
  reach numeric check (reach is null or reach between 1 and 10),
  impact numeric not null check (impact between 1 and 10),
  confidence numeric not null check (confidence between 1 and 10),
  effort numeric not null check (effort between 1 and 10),
  created_at timestamptz not null default now(),
  unique (proposal_id, voter_id)
);

create index rice_votes_proposal_idx on rice_votes (proposal_id);

alter table rice_votes enable row level security;

-- lettura aperta a tutti i membri (la lista votanti è visibile nel pannello)
create policy "auth read" on rice_votes for select to authenticated using (true);

-- insert: solo il votante stesso, solo su proposta in valutazione, e mai
-- sulla propria proposta. Niente policy update/delete → voto immutabile.
create policy "voter insert" on rice_votes for insert to authenticated
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from proposals p
      where p.id = proposal_id
        and p.status = 'in_valutazione'
        and p.proposer_id <> auth.uid()
    )
  );

-- Grant DML espliciti come in 0004/0009: solo select+insert, niente update/delete.
grant select, insert on table public.rice_votes to authenticated;
