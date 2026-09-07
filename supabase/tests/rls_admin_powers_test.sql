-- Verifica 0020: esiti scan/eval scrivibili solo da service_role (SEC-9/SEC-8),
-- ruolo membri cambiabile solo dall'admin del progetto e mai su se stessi (0021),
-- admin elimina commenti altrui,
-- git_ref scrivibile dal proposer con i vincoli del check.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Setup (come superuser): un admin, due contributor, una proposta di Anna con un commento di Bruno.
insert into auth.users (id, email)
values ('aaaa0020-0000-0000-0000-000000000001', 'admin20@test.local'),
       ('aaaa0020-0000-0000-0000-000000000002', 'anna20@test.local'),
       ('aaaa0020-0000-0000-0000-000000000003', 'bruno20@test.local');
insert into public.projects (id, name, created_by)
values ('00000000-0000-0000-0000-000000000020', 'Test', 'aaaa0020-0000-0000-0000-000000000001');
insert into public.project_members (project_id, user_id, role)
values ('00000000-0000-0000-0000-000000000020', 'aaaa0020-0000-0000-0000-000000000001', 'admin'),
       ('00000000-0000-0000-0000-000000000020', 'aaaa0020-0000-0000-0000-000000000002', 'contributor'),
       ('00000000-0000-0000-0000-000000000020', 'aaaa0020-0000-0000-0000-000000000003', 'contributor');

insert into public.proposals (id, title, proposer_id, project_id)
values ('bbbb0020-0000-0000-0000-000000000001', 'Di Anna', 'aaaa0020-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000020');
insert into public.comments (id, proposal_id, author_id, body)
values ('cccc0020-0000-0000-0000-000000000001', 'bbbb0020-0000-0000-0000-000000000001',
        'aaaa0020-0000-0000-0000-000000000003', 'Commento di Bruno');

-- Sessione di Anna (contributor, proposer)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "aaaa0020-0000-0000-0000-000000000002", "role": "authenticated"}', true);

select throws_ok(
  $$select public.apply_dup_scan('bbbb0020-0000-0000-0000-000000000001', false, null, null, 'forged')$$,
  '42501', null,
  'SEC-9: il proposer non può più scrivere l''esito dello scan duplicati'
);
select throws_ok(
  $$select public.apply_ai_evaluation('bbbb0020-0000-0000-0000-000000000001', 5, 5, 5, 5, 'forged')$$,
  '42501', null,
  'SEC-8: un utente autenticato non può scrivere la valutazione AI'
);
update public.project_members set role = 'admin'
  where user_id = 'aaaa0020-0000-0000-0000-000000000003';
select is(
  (select role from public.project_members where user_id = 'aaaa0020-0000-0000-0000-000000000003'),
  'contributor',
  'un contributor non cambia i ruoli (policy filtra, 0 righe)'
);
select lives_ok(
  $$update public.proposals set git_ref = 'feature/offline'
    where id = 'bbbb0020-0000-0000-0000-000000000001'$$,
  'il proposer collega un branch'
);
select throws_ok(
  $$update public.proposals set git_ref = 'two words'
    where id = 'bbbb0020-0000-0000-0000-000000000001'$$,
  '23514', null,
  'git_ref rifiuta gli spazi (check)'
);
delete from public.comments where id = 'cccc0020-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.comments where id = 'cccc0020-0000-0000-0000-000000000001'),
  1::bigint,
  'un contributor non elimina il commento di un altro'
);

-- Sessione admin
select set_config('request.jwt.claims',
  '{"sub": "aaaa0020-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select lives_ok(
  $$update public.project_members set role = 'admin'
    where user_id = 'aaaa0020-0000-0000-0000-000000000003'$$,
  'l''admin promuove un altro membro'
);
select is(
  (select role from public.project_members where user_id = 'aaaa0020-0000-0000-0000-000000000003'),
  'admin',
  'il ruolo è cambiato'
);
update public.project_members set role = 'contributor'
  where user_id = 'aaaa0020-0000-0000-0000-000000000001';
select is(
  (select role from public.project_members where user_id = 'aaaa0020-0000-0000-0000-000000000001'),
  'admin',
  'l''admin non si toglie il ruolo da solo (policy filtra la propria riga)'
);
delete from public.comments where id = 'cccc0020-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.comments where id = 'cccc0020-0000-0000-0000-000000000001'),
  0::bigint,
  'l''admin elimina il commento di un altro (policy "admin delete open")'
);

-- service_role: scrive l'esito dello scan (unico principal con execute)
set local role service_role;
select lives_ok(
  $$select public.apply_dup_scan('bbbb0020-0000-0000-0000-000000000001', false, null, null, 'ok')$$,
  'service_role scrive l''esito dello scan'
);

select * from finish();
rollback;
