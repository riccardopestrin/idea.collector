-- Verifica 0024: delete_account rifiuta l'unico admin di un progetto con altri
-- membri, elimina i progetti in cui si è soli, toglie le membership e
-- anonimizza il profilo lasciando le proposte attribuite; il profilo
-- sopravvive alla cancellazione di auth.users; anon fuori.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Setup (come superuser): Aldo admin di P1, Bice contributor di P1 e sola in P3.
insert into auth.users (id, email)
values ('aaaa0024-0000-0000-0000-000000000001', 'aldo24@test.local'),
       ('aaaa0024-0000-0000-0000-000000000002', 'bice24@test.local');
insert into public.projects (id, name, created_by)
values ('00000000-0000-0000-0000-000000000241', 'P1', 'aaaa0024-0000-0000-0000-000000000001'),
       ('00000000-0000-0000-0000-000000000243', 'P3', 'aaaa0024-0000-0000-0000-000000000002');
insert into public.project_members (project_id, user_id, role)
values ('00000000-0000-0000-0000-000000000241', 'aaaa0024-0000-0000-0000-000000000001', 'admin'),
       ('00000000-0000-0000-0000-000000000241', 'aaaa0024-0000-0000-0000-000000000002', 'contributor'),
       ('00000000-0000-0000-0000-000000000243', 'aaaa0024-0000-0000-0000-000000000002', 'admin');
insert into public.proposals (id, title, proposer_id, project_id)
values ('bbbb0024-0000-0000-0000-000000000001', 'Di Bice in P1', 'aaaa0024-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000241');

-- Aldo: unico admin di P1, che ha un altro membro
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "aaaa0024-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select throws_ok(
  $$select public.delete_account()$$,
  'P0001', 'unico admin: P1',
  'l''unico admin di un progetto con altri membri non elimina l''account'
);

-- Bice: contributor in P1, sola in P3
select set_config('request.jwt.claims',
  '{"sub": "aaaa0024-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select lives_ok($$select public.delete_account()$$, 'un utente elimina il proprio account');

reset role;
select is(
  (select count(*)::int from public.projects where id = '00000000-0000-0000-0000-000000000243'), 0,
  'il progetto in cui era l''unico membro viene eliminato'
);
select is(
  (select count(*)::int from public.project_members
    where user_id = 'aaaa0024-0000-0000-0000-000000000002'), 0,
  'le membership vengono rimosse'
);
select is(
  (select name is null and email = '' from public.profiles
    where id = 'aaaa0024-0000-0000-0000-000000000002'), true,
  'il profilo viene anonimizzato'
);
select is(
  (select proposer_id from public.proposals where id = 'bbbb0024-0000-0000-0000-000000000001'),
  'aaaa0024-0000-0000-0000-000000000002',
  'le proposte negli altri progetti restano, attribuite alla riga profilo'
);

-- La riga auth.users sparisce (service role, dalla Server Action) e il profilo resta
select lives_ok(
  $$delete from auth.users where id = 'aaaa0024-0000-0000-0000-000000000002'$$,
  'l''utente auth si cancella nonostante le proposte'
);
select is(
  (select count(*)::int from public.profiles where id = 'aaaa0024-0000-0000-0000-000000000002'), 1,
  'il profilo sopravvive alla cancellazione di auth.users'
);

set local role anon;
select throws_ok($$select public.delete_account()$$, '42501', null, 'anon non chiama delete_account');

select * from finish();
rollback;
