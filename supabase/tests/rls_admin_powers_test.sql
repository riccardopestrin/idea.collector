-- Verifica 0020: esiti scan/eval scrivibili solo da service_role (SEC-9/SEC-8),
-- set_profile_role admin-only e mai su se stessi, admin elimina commenti altrui,
-- git_ref scrivibile dal proposer con i vincoli del check.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Setup (come superuser): un admin, due contributor, una proposta di Anna con un commento di Bruno.
insert into auth.users (id, email)
values ('aaaa0020-0000-0000-0000-000000000001', 'admin20@test.local'),
       ('aaaa0020-0000-0000-0000-000000000002', 'anna20@test.local'),
       ('aaaa0020-0000-0000-0000-000000000003', 'bruno20@test.local');
update public.profiles set role = 'admin' where id = 'aaaa0020-0000-0000-0000-000000000001';

insert into public.proposals (id, title, proposer_id)
values ('bbbb0020-0000-0000-0000-000000000001', 'Di Anna', 'aaaa0020-0000-0000-0000-000000000002');
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
select throws_ok(
  $$select public.set_profile_role('aaaa0020-0000-0000-0000-000000000003', 'admin')$$,
  'P0001', 'solo un admin può cambiare i ruoli',
  'un contributor non cambia i ruoli'
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
  $$select public.set_profile_role('aaaa0020-0000-0000-0000-000000000003', 'admin')$$,
  'l''admin promuove un altro profilo'
);
select is(
  (select role from public.profiles where id = 'aaaa0020-0000-0000-0000-000000000003'),
  'admin',
  'il ruolo è cambiato'
);
select throws_ok(
  $$select public.set_profile_role('aaaa0020-0000-0000-0000-000000000001', 'contributor')$$,
  'P0001', 'non puoi cambiare il tuo stesso ruolo',
  'l''admin non si toglie il ruolo da solo'
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
