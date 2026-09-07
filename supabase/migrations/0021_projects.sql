-- Progetti: più bacheche per account, ruolo per progetto (RFC-007, ADR-0009).
--
-- [1] projects (nome + repo GitHub, ex app_settings) e project_members
--     (project_id, user_id, role). Il ruolo vive SOLO sulla membership.
-- [2] is_admin() → is_project_admin(project_id) / is_project_member(project_id).
--     Ogni punto che usava is_admin() ha una proposta a portata di mano, quindi
--     la sostituzione è meccanica; proposal_project() serve dove c'è solo l'id.
-- [3] Backfill: la bacheca esistente diventa il progetto "test" — tutte le
--     proposte, tutti i profili come membri con il ruolo che hanno oggi, la
--     repo GitHub di app_settings. Zero cambi di comportamento per chi c'è già.
-- [4] RLS: da "ogni autenticato legge tutto" a "solo i membri del progetto".
--     comments / rice_votes / status_history ereditano la visibilità dalla
--     sub-query su proposals (filtrata dalla RLS di proposals): la regola vive
--     in un posto solo. profiles visibili solo tra co-membri.
-- [5] Trigger e RPC riscritti con la membership; create_project (definer:
--     progetto + membership admin del creatore in una transazione).
-- [6] Drop: is_admin(), set_profile_role, app_settings, profiles.role.

-- [1] tabelle
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  -- repo GitHub collegata (ADR-0004): nessun secret, la private key sta in env
  github_installation_id bigint,
  github_owner text,
  github_repo text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'contributor' check (role in ('contributor', 'admin')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;

-- grant espliciti (pattern 0004); created_by/created_at non aggiornabili
revoke all on table public.projects, public.project_members from public, anon;
grant select on table public.projects to authenticated;
grant update (name, github_installation_id, github_owner, github_repo)
  on table public.projects to authenticated;
grant select, insert, delete on table public.project_members to authenticated;
grant update (role) on table public.project_members to authenticated;
-- 0020 [2] copriva solo le tabelle esistenti allora
grant select, insert, update, delete on table public.projects, public.project_members
  to service_role;

-- [2] helper di autorizzazione (security definer: leggono project_members
-- senza passare dalle sue policy — stesso pattern di is_admin() in 0001)
create function public.is_project_member(p_project uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project and user_id = auth.uid()
  );
$$;

create function public.is_project_admin(p_project uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project and user_id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_project_member, public.is_project_admin
from public, anon;
grant execute on function public.is_project_member, public.is_project_admin
to authenticated;

-- [3] backfill: progetto "test" (solo se esiste almeno un profilo — un DB
-- vuoto, come quello dei test pgTAP, non ne ha bisogno)
-- on delete cascade: il progetto È la bacheca — eliminarlo porta via le sue proposte
alter table public.proposals add column project_id uuid references public.projects on delete cascade;

-- (dopo la colonna: una funzione sql viene validata alla creazione)
create function public.proposal_project(p_proposal uuid)
returns uuid language sql security definer set search_path = '' stable as $$
  select project_id from public.proposals where id = p_proposal;
$$;
revoke execute on function public.proposal_project from public, anon;
grant execute on function public.proposal_project to authenticated;

do $$
declare
  owner_id uuid;
  test_id uuid;
  gh_installation bigint;
  gh_owner text;
  gh_repo text;
begin
  select id into owner_id from public.profiles
    order by (role = 'admin') desc, created_at limit 1;
  if owner_id is null then
    return;
  end if;
  select github_installation_id, github_owner, github_repo
    into gh_installation, gh_owner, gh_repo
    from public.app_settings limit 1;
  insert into public.projects (name, github_installation_id, github_owner, github_repo, created_by)
    values ('test', gh_installation, gh_owner, gh_repo, owner_id)
    returning id into test_id;
  insert into public.project_members (project_id, user_id, role)
    select test_id, id, role from public.profiles;
  update public.proposals set project_id = test_id;
end;
$$;

alter table public.proposals alter column project_id set not null;
create index proposals_project_idx on public.proposals (project_id);

-- [4] RLS

-- profiles: sé stessi + co-membri di almeno un progetto. Il ruolo globale
-- sparisce: nessun "admin manage profiles".
drop policy "auth read" on public.profiles;
drop policy "admin manage profiles" on public.profiles;
create policy "self or co-member read" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.project_members m
      where m.user_id = profiles.id and public.is_project_member(m.project_id)
    )
  );

-- projects
create policy "member read" on public.projects for select to authenticated
  using (public.is_project_member(id));
create policy "admin update" on public.projects for update to authenticated
  using (public.is_project_admin(id)) with check (public.is_project_admin(id));

-- project_members: legge chi è membro; scrive l'admin del progetto, mai sulla
-- propria riga (non ci si toglie l'accesso o il ruolo da soli — regola ex
-- set_profile_role 0020, ora dichiarativa).
create policy "member read" on public.project_members for select to authenticated
  using (public.is_project_member(project_id));
create policy "admin insert" on public.project_members for insert to authenticated
  with check (public.is_project_admin(project_id));
create policy "admin update others" on public.project_members for update to authenticated
  using (public.is_project_admin(project_id) and user_id <> auth.uid())
  with check (public.is_project_admin(project_id) and user_id <> auth.uid());
create policy "admin delete others" on public.project_members for delete to authenticated
  using (public.is_project_admin(project_id) and user_id <> auth.uid());

-- tags: mai usate dal codice; via il ruolo globale
drop policy "admin manage tags" on public.tags;
drop policy "owner or admin tag" on public.proposal_tags;
create policy "owner or admin tag" on public.proposal_tags for all to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id
                 and (p.proposer_id = auth.uid() or public.is_project_admin(p.project_id))));

-- proposals
drop policy "auth read" on public.proposals;
drop policy "auth create" on public.proposals;
drop policy "owner or admin update" on public.proposals;
drop policy "owner or admin delete" on public.proposals;
create policy "member read" on public.proposals for select to authenticated
  using (public.is_project_member(project_id));
create policy "member create" on public.proposals for insert to authenticated
  with check (proposer_id = auth.uid() and public.is_project_member(project_id));
create policy "owner or admin update" on public.proposals for update to authenticated
  using (proposer_id = auth.uid() or public.is_project_admin(project_id));
create policy "owner or admin delete" on public.proposals for delete to authenticated
  using (proposer_id = auth.uid() or public.is_project_admin(project_id));

-- comments / rice_votes / status_history: visibilità ereditata da proposals
drop policy "auth read" on public.comments;
create policy "member read" on public.comments for select to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id));
drop policy "admin delete open" on public.comments;
create policy "admin delete open" on public.comments for delete to authenticated
  using (
    public.is_project_admin(public.proposal_project(proposal_id))
    and promotion_status <> 'accepted'
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.status in ('nuova', 'in_valutazione')
    )
  );

drop policy "auth read" on public.rice_votes;
create policy "member read" on public.rice_votes for select to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id));

drop policy "auth read" on public.status_history;
drop policy "admin insert history" on public.status_history;
create policy "member read" on public.status_history for select to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id));
create policy "admin insert history" on public.status_history for insert to authenticated
  with check (
    public.is_project_admin(public.proposal_project(proposal_id)) and author_id = auth.uid()
  );

-- [5] trigger e RPC

-- Corpo identico a 0019: cambia solo il gate admin (membership del progetto
-- della riga) e si blinda project_id (una proposta non cambia progetto).
create or replace function public.enforce_proposal_privileged_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_project_admin(new.project_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'nuova'
      or new.method <> 'rice'
      or new.reach is not null
      or new.impact is not null
      or new.confidence is not null
      or new.effort is not null
      or new.ai_rationale is not null
      or new.ai_generated
      or new.manually_edited
      or new.internal_notes is not null
      or new.ai_eval_status <> 'assente'
      or new.ai_eval_error is not null
      or new.dup_scan_status <> 'assente'
      or new.dup_scan_error is not null
      or new.dup_flagged
      or new.dup_match_id is not null
      or new.dup_similarity is not null
      or new.dup_report is not null
    then
      raise exception 'solo un admin può impostare status, campi AI o note interne';
    end if;
  else
    if new.status is distinct from old.status
      and current_setting('idea.move_proposal', true) is distinct from '1'
    then
      raise exception 'lo status si cambia solo dalla board (move_proposal)';
    end if;
    if new.proposer_id is distinct from old.proposer_id
      or new.project_id is distinct from old.project_id
      or new.method is distinct from old.method
      or new.internal_notes is distinct from old.internal_notes
    then
      raise exception 'solo un admin può modificare proposer, progetto, method o note interne';
    end if;
    if (new.reach is distinct from old.reach
      or new.impact is distinct from old.impact
      or new.confidence is distinct from old.confidence
      or new.effort is distinct from old.effort
      or new.ai_rationale is distinct from old.ai_rationale
      or new.ai_generated is distinct from old.ai_generated
      or new.manually_edited is distinct from old.manually_edited
      or new.ai_eval_status is distinct from old.ai_eval_status
      or new.ai_eval_error is distinct from old.ai_eval_error)
      and current_setting('idea.ai_eval', true) is distinct from '1'
    then
      raise exception 'le colonne della valutazione AI si scrivono solo dalle RPC eval';
    end if;
    if (new.dup_scan_status is distinct from old.dup_scan_status
      or new.dup_scan_error is distinct from old.dup_scan_error
      or new.dup_flagged is distinct from old.dup_flagged
      or new.dup_match_id is distinct from old.dup_match_id
      or new.dup_similarity is distinct from old.dup_similarity
      or new.dup_report is distinct from old.dup_report)
      and current_setting('idea.dup_scan', true) is distinct from '1'
    then
      raise exception 'le colonne dello scan duplicati si scrivono solo dalle RPC dup_scan';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_proposal_crystallization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_project_admin(new.project_id)
    and old.status not in ('nuova', 'in_valutazione')
    and (new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.problem is distinct from old.problem
      or new.links is distinct from old.links)
  then
    raise exception 'proposta non più modificabile (cristallizzata)';
  end if;
  return new;
end;
$$;

-- promozione commenti (0016): "admin" = admin del progetto della proposta
create or replace function public.resolve_comment_promotion(p_comment_id uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  c public.comments;
  updated integer;
begin
  c := public.promotion_target(p_comment_id);
  if not public.is_project_admin(public.proposal_project(c.proposal_id)) and not exists (
    select 1 from public.proposals p
    where p.id = c.proposal_id and p.proposer_id = auth.uid()
  ) then
    raise exception 'solo il proposer o un admin decide sulla promozione';
  end if;
  update public.comments
    set promotion_status = case when p_accept then 'accepted' else 'none' end
    where id = p_comment_id and promotion_status = 'pending';
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

create or replace function public.revoke_comment_promotion(p_comment_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  c public.comments;
  updated integer;
begin
  c := public.promotion_target(p_comment_id);
  if c.author_id <> auth.uid()
    and not public.is_project_admin(public.proposal_project(c.proposal_id))
    and not exists (
      select 1 from public.proposals p
      where p.id = c.proposal_id and p.proposer_id = auth.uid()
    ) then
    raise exception 'solo autore, proposer o admin possono revocare il contributo';
  end if;
  update public.comments set promotion_status = 'none'
    where id = p_comment_id and promotion_status = 'accepted';
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- Creazione progetto: chi crea è admin. Definer perché al momento dell'insert
-- il creatore non è ancora membro e nessuna policy lo lascerebbe passare.
create function public.create_project(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
begin
  if auth.uid() is null then
    raise exception 'non autenticato';
  end if;
  insert into public.projects (name, created_by)
    values (btrim(p_name), auth.uid())
    returning id into pid;
  insert into public.project_members (project_id, user_id, role)
    values (pid, auth.uid(), 'admin');
  return pid;
end;
$$;
revoke execute on function public.create_project from public, anon;
grant execute on function public.create_project to authenticated;

-- [6] via il ruolo globale
drop function public.set_profile_role(uuid, text);
drop table public.app_settings; -- prima di is_admin(): le sue policy la referenziano
drop function public.is_admin();
alter table public.profiles drop column role;
