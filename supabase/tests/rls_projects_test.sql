-- Verifica 0021: isolamento tra progetti (proposte, commenti, profili), ruolo
-- per progetto, create_project rende admin il creatore, gestione membri solo
-- dall'admin del progetto e mai sulla propria riga, anon fuori.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Setup (come superuser): Aldo admin di P1, Bice membro di P1, Ciro solo in P2.
insert into auth.users (id, email)
values ('aaaa0021-0000-0000-0000-000000000001', 'aldo21@test.local'),
       ('aaaa0021-0000-0000-0000-000000000002', 'bice21@test.local'),
       ('aaaa0021-0000-0000-0000-000000000003', 'ciro21@test.local');
insert into public.projects (id, name, created_by)
values ('00000000-0000-0000-0000-000000000211', 'P1', 'aaaa0021-0000-0000-0000-000000000001'),
       ('00000000-0000-0000-0000-000000000212', 'P2', 'aaaa0021-0000-0000-0000-000000000003');
insert into public.project_members (project_id, user_id, role)
values ('00000000-0000-0000-0000-000000000211', 'aaaa0021-0000-0000-0000-000000000001', 'admin'),
       ('00000000-0000-0000-0000-000000000211', 'aaaa0021-0000-0000-0000-000000000002', 'contributor'),
       ('00000000-0000-0000-0000-000000000212', 'aaaa0021-0000-0000-0000-000000000003', 'admin');
insert into public.proposals (id, title, proposer_id, project_id)
values ('bbbb0021-0000-0000-0000-000000000001', 'In P1', 'aaaa0021-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000211'),
       ('bbbb0021-0000-0000-0000-000000000002', 'In P2', 'aaaa0021-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000212');
insert into public.comments (id, proposal_id, author_id, body)
values ('cccc0021-0000-0000-0000-000000000001', 'bbbb0021-0000-0000-0000-000000000001',
        'aaaa0021-0000-0000-0000-000000000002', 'su P1'),
       ('cccc0021-0000-0000-0000-000000000002', 'bbbb0021-0000-0000-0000-000000000002',
        'aaaa0021-0000-0000-0000-000000000003', 'su P2'),
       -- commento "orfano" di Ciro su P1, come se fosse stato membro e poi rimosso (SEC-14)
       ('cccc0021-0000-0000-0000-000000000003', 'bbbb0021-0000-0000-0000-000000000001',
        'aaaa0021-0000-0000-0000-000000000003', 'ex membro');
-- Bice è anche admin del proprio progetto P3 e proposer di una proposta in P1 (SEC-12)
insert into public.projects (id, name, created_by)
values ('00000000-0000-0000-0000-000000000213', 'P3', 'aaaa0021-0000-0000-0000-000000000002');
insert into public.project_members (project_id, user_id, role)
values ('00000000-0000-0000-0000-000000000213', 'aaaa0021-0000-0000-0000-000000000002', 'admin');
insert into public.proposals (id, title, proposer_id, project_id)
values ('bbbb0021-0000-0000-0000-000000000003', 'Di Bice in P1', 'aaaa0021-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000211');

-- Sessione di Bice (contributor di P1)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "aaaa0021-0000-0000-0000-000000000002", "role": "authenticated"}', true);

select is(
  (select array_agg(title order by title) from public.proposals), array['Di Bice in P1', 'In P1'],
  'un membro legge solo le proposte dei propri progetti'
);
select is(
  (select array_agg(body order by body) from public.comments), array['ex membro', 'su P1'],
  'i commenti ereditano la visibilità dalla proposta'
);
select is(
  (select array_agg(name order by name) from public.projects), array['P1', 'P3'],
  'un membro vede solo i propri progetti'
);
-- SEC-12: proposer in P1 e admin di P3 non può ri-domiciliare la proposta in P3
select throws_ok(
  $$update public.proposals set project_id = '00000000-0000-0000-0000-000000000213'
    where id = 'bbbb0021-0000-0000-0000-000000000003'$$,
  'P0001', 'una proposta non cambia progetto',
  'il proposer non sposta la propria proposta in un altro progetto di cui è admin'
);
select is(
  (select count(*)::int from public.profiles), 2,
  'i profili visibili sono sé stessi e i co-membri (Ciro no)'
);
select throws_ok(
  $$insert into public.proposals (title, proposer_id, project_id)
    values ('Intrusa', 'aaaa0021-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000212')$$,
  '42501', null,
  'non si crea una proposta in un progetto di cui non si è membri'
);
select throws_ok(
  $$insert into public.project_members (project_id, user_id)
    values ('00000000-0000-0000-0000-000000000211', 'aaaa0021-0000-0000-0000-000000000003')$$,
  '42501', null,
  'un contributor non aggiunge membri'
);
update public.projects set name = 'Manomesso' where id = '00000000-0000-0000-0000-000000000211';
select is(
  (select name from public.projects where id = '00000000-0000-0000-0000-000000000211'), 'P1',
  'un contributor non rinomina il progetto (policy filtra)'
);
select is(public.is_project_admin('00000000-0000-0000-0000-000000000211'), false,
  'is_project_admin è false per un contributor');

-- Sessione di Aldo (admin di P1, estraneo a P2)
select set_config('request.jwt.claims',
  '{"sub": "aaaa0021-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select is(public.is_project_admin('00000000-0000-0000-0000-000000000212'), false,
  'l''admin di P1 non è admin di P2');
select lives_ok(
  $$insert into public.project_members (project_id, user_id)
    values ('00000000-0000-0000-0000-000000000211', 'aaaa0021-0000-0000-0000-000000000003')$$,
  'l''admin aggiunge un membro al proprio progetto'
);
delete from public.project_members
  where project_id = '00000000-0000-0000-0000-000000000211'
    and user_id = 'aaaa0021-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.project_members
    where project_id = '00000000-0000-0000-0000-000000000211'
      and user_id = 'aaaa0021-0000-0000-0000-000000000001'), 1,
  'l''admin non rimuove sé stesso'
);
select lives_ok(
  $$delete from public.project_members
    where project_id = '00000000-0000-0000-0000-000000000211'
      and user_id = 'aaaa0021-0000-0000-0000-000000000003'$$,
  'l''admin rimuove un altro membro'
);
select lives_ok(
  $$update public.projects set name = 'P1 rinominato'
    where id = '00000000-0000-0000-0000-000000000211'$$,
  'l''admin rinomina il progetto'
);

-- create_project: il creatore è admin del nuovo progetto. Statement separato:
-- is_project_admin è STABLE e nello stesso statement non vedrebbe la riga appena inserita.
create temp table created as select public.create_project('  Nuovo  ') as id;
select is(
  public.is_project_admin((select id from created)), true,
  'create_project rende admin il creatore'
);
select is(
  (select name from public.projects where name = 'Nuovo'), 'Nuovo',
  'il nome viene salvato senza spazi ai bordi'
);

-- Sessione di Ciro (solo P2): move_proposal su una proposta di P1 (0022)
select set_config('request.jwt.claims',
  '{"sub": "aaaa0021-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select throws_ok(
  $$select public.move_proposal('bbbb0021-0000-0000-0000-000000000001', 'nuova', 'in_valutazione')$$,
  'P0001', 'non membro del progetto',
  'un non-membro non sposta le proposte di un altro progetto'
);
reset role;
select is(
  (select count(*)::int from public.status_history
    where proposal_id = 'bbbb0021-0000-0000-0000-000000000001'), 0,
  'nessuna riga di history firmata da un non-membro'
);

-- SEC-14: l'ex-membro non promuove il proprio vecchio commento
select throws_ok(
  $$select public.request_comment_promotion('cccc0021-0000-0000-0000-000000000003')$$,
  'P0001', 'non membro del progetto',
  'un non-membro non usa le RPC di promozione sui propri vecchi commenti'
);

-- Anon: niente RPC
set local role anon;
select throws_ok(
  $$select public.create_project('X')$$, '42501', null,
  'anon non crea progetti'
);

select * from finish();
rollback;
