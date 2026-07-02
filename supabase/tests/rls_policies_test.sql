-- Verifica le policy RLS "row-scope" di 0001 (+ grant di 0004):
-- lettura condivisa, scrittura solo sulle proprie righe, delete e
-- status_history riservati all'admin, anon fuori da tutto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Setup (come superuser): due contributor e un admin.
insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@test.local'),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bruno@test.local'),
       ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin@test.local');
update public.profiles set role = 'admin'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

insert into public.proposals (id, title, proposer_id)
values ('11111111-0000-0000-0000-000000000001', 'Di Alice',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Sessione di Bruno (contributor, non proprietario)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.proposals),
  1,
  'ogni membro autenticato legge tutte le proposte'
);

select throws_ok(
  $$ insert into public.proposals (title, proposer_id)
     values ('Spacciata per di Alice', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501',
  null,
  'un contributor non può creare proposte a nome altrui'
);

-- L'update su una riga altrui non è un errore: la policy la filtra (0 righe).
update public.proposals set title = 'Manomessa'
  where id = '11111111-0000-0000-0000-000000000001';
select is(
  (select title from public.proposals
    where id = '11111111-0000-0000-0000-000000000001'),
  'Di Alice',
  'un contributor non può modificare le proposte altrui'
);

-- Il delete è autore-o-admin (0005): la riga altrui resta, la propria va via.
insert into public.proposals (id, title, proposer_id)
values ('11111111-0000-0000-0000-000000000002', 'Di Bruno',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
delete from public.proposals;
select is(
  (select array_agg(title) from public.proposals),
  array['Di Alice'],
  'un contributor elimina solo le proprie proposte, non quelle altrui'
);

select throws_ok(
  $$ insert into public.status_history (proposal_id, to_status, author_id)
     values ('11111111-0000-0000-0000-000000000001', 'in_valutazione',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501',
  null,
  'un contributor non può registrare cambi di stato'
);

-- Sessione admin
select set_config('request.jwt.claims',
  '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc", "role": "authenticated"}', true);

select throws_ok(
  $$ insert into public.status_history (proposal_id, to_status, author_id)
     values ('11111111-0000-0000-0000-000000000001', 'in_valutazione',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501',
  null,
  'l''admin non può firmare la history a nome di altri'
);

select lives_ok(
  $$ insert into public.status_history (proposal_id, to_status, author_id)
     values ('11111111-0000-0000-0000-000000000001', 'in_valutazione',
             'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'l''admin registra il cambio di stato a proprio nome'
);

delete from public.proposals
  where id = '11111111-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.proposals
    where id = '11111111-0000-0000-0000-000000000001'),
  0,
  'l''admin può eliminare una proposta altrui'
);

-- Sessione anonima: nessun grant, nessuna lettura.
set local role anon;
select throws_ok(
  $$ select count(*) from public.proposals $$,
  '42501',
  null,
  'anon non legge le proposte'
);

select * from finish();
rollback;
