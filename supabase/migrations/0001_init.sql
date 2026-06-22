-- Dashboard proposte feature — schema MVP
-- Ruoli: contributor (default) e admin. L'autorizzazione vive nelle RLS policy.

create type proposal_status as enum (
  'nuova', 'in_valutazione', 'approvata', 'in_sviluppo',
  'rilasciata', 'parcheggiata', 'rifiutata'
);
create type scoring_method as enum ('rice', 'ice');

-- Profilo applicativo, 1:1 con auth.users. role decide cosa può fare.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text,
  role text not null default 'contributor' check (role in ('contributor', 'admin')),
  created_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  problem text,
  proposer_id uuid not null references profiles(id),
  status proposal_status not null default 'nuova',
  method scoring_method not null default 'rice',
  -- valori RICE/ICE (nullable finché non valutata). reach/effort in unità libere.
  reach numeric,
  impact numeric,
  confidence numeric,   -- 0..1 per RICE, 1..10 per ICE
  effort numeric,
  ai_rationale text,
  ai_generated boolean not null default false,
  manually_edited boolean not null default false,
  links text[] not null default '{}',
  internal_notes text,
  created_at timestamptz not null default now()
);

create table proposal_tags (
  proposal_id uuid not null references proposals on delete cascade,
  tag_id uuid not null references tags on delete cascade,
  primary key (proposal_id, tag_id)
);

create table status_history (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals on delete cascade,
  from_status proposal_status,
  to_status proposal_status not null,
  author_id uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- Nuovo utente -> profilo contributor. Gli admin si promuovono a mano in Supabase
-- (profiles.role = 'admin').
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create function is_admin() returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- RLS: ogni membro autenticato legge tutto; scrive con i limiti della spec.
alter table profiles enable row level security;
alter table tags enable row level security;
alter table proposals enable row level security;
alter table proposal_tags enable row level security;
alter table status_history enable row level security;

create policy "auth read" on profiles for select to authenticated using (true);
create policy "self update" on profiles for update to authenticated using (id = auth.uid());
create policy "admin manage profiles" on profiles for all to authenticated using (is_admin());

create policy "auth read" on tags for select to authenticated using (true);
create policy "auth create tags" on tags for insert to authenticated with check (true);
create policy "admin manage tags" on tags for all to authenticated using (is_admin());

create policy "auth read" on proposals for select to authenticated using (true);
create policy "auth create" on proposals for insert to authenticated
  with check (proposer_id = auth.uid());
-- contributor modifica le proprie (no stato: lo stato lo cambia l'admin via history); admin tutto.
create policy "owner or admin update" on proposals for update to authenticated
  using (proposer_id = auth.uid() or is_admin());
create policy "admin delete" on proposals for delete to authenticated using (is_admin());

create policy "auth read" on proposal_tags for select to authenticated using (true);
create policy "owner or admin tag" on proposal_tags for all to authenticated
  using (exists (select 1 from proposals p where p.id = proposal_id
                 and (p.proposer_id = auth.uid() or is_admin())));

create policy "auth read" on status_history for select to authenticated using (true);
-- solo admin registra cambi di stato (la action verifica role; la policy è la rete di sicurezza).
create policy "admin insert history" on status_history for insert to authenticated
  with check (is_admin() and author_id = auth.uid());
