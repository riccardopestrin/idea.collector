-- Verifica che 0003_lock_privileged_columns chiuda SEC-2 e SEC-3:
-- un contributor non può auto-promuoversi admin né toccare le colonne
-- privilegiate di proposals; l'admin mantiene il flusso di cambio stato.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Setup (come superuser): un contributor e un admin.
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'contributor@test.local'),
       ('22222222-2222-2222-2222-222222222222', 'admin@test.local');
update public.profiles set role = 'admin'
  where id = '22222222-2222-2222-2222-222222222222';

insert into public.proposals (id, title, proposer_id)
values ('33333333-3333-3333-3333-333333333333', 'Proposta del contributor',
        '11111111-1111-1111-1111-111111111111');

-- Sessione contributor
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- SEC-2: il column privilege blocca la scrittura di role (42501 = permission denied)
select throws_ok(
  $$ update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'contributor non può cambiare il proprio role'
);

select lives_ok(
  $$ update public.profiles set name = 'Nuovo Nome'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'contributor può cambiare il proprio name'
);

-- SEC-3, vettore INSERT: proposta già "approvata" rigettata dal trigger
select throws_ok(
  $$ insert into public.proposals (title, proposer_id, status)
     values ('Furba', '11111111-1111-1111-1111-111111111111', 'approvata') $$,
  'P0001',
  null,
  'contributor non può creare una proposta con status diverso da nuova'
);

select lives_ok(
  $$ insert into public.proposals (title, proposer_id)
     values ('Onesta', '11111111-1111-1111-1111-111111111111') $$,
  'contributor può creare una proposta con i default'
);

-- SEC-3, vettore UPDATE: colonne libere sì, status no
select lives_ok(
  $$ update public.proposals set title = 'Titolo aggiornato'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'contributor può modificare il titolo della propria proposta'
);

select throws_ok(
  $$ update public.proposals set status = 'approvata'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'P0001',
  null,
  'contributor non può cambiare lo status della propria proposta'
);

-- Sessione admin: il flusso di cambio stato resta funzionante
select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select lives_ok(
  $$ update public.proposals set status = 'in_valutazione'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'admin può cambiare lo status'
);

select * from finish();
rollback;
