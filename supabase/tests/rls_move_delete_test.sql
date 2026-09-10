-- Verifica 0005: spostamento aperto a tutti via move_proposal (CAS + history
-- atomici), delete autore-o-admin, anon fuori dalla RPC.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Setup (come superuser): due contributor.
insert into auth.users (id, email)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'dora@test.local'),
       ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'enea@test.local');

insert into public.projects (id, name, created_by)
values ('00000000-0000-0000-0000-00000000dddd', 'Test', 'dddddddd-dddd-dddd-dddd-dddddddddddd');
insert into public.project_members (project_id, user_id, role)
values ('00000000-0000-0000-0000-00000000dddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'admin'),
       ('00000000-0000-0000-0000-00000000dddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'contributor');
insert into public.proposals (id, title, proposer_id, project_id)
values ('44444444-0000-0000-0000-000000000001', 'Di Dora',
        'dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-00000000dddd');

-- Sessione di Enea (contributor, NON proprietario)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}', true);

select is(
  public.move_proposal('44444444-0000-0000-0000-000000000001',
                       'nuova', 'in_valutazione'),
  true,
  'un contributor sposta una proposta altrui via move_proposal'
);

select is(
  (select status from public.proposals
    where id = '44444444-0000-0000-0000-000000000001'),
  'in_valutazione'::public.proposal_status,
  'lo status è cambiato'
);

select is(
  (select count(*)::int from public.status_history
    where proposal_id = '44444444-0000-0000-0000-000000000001'
      and from_status = 'nuova' and to_status = 'in_valutazione'
      and author_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'la transizione è registrata in status_history a nome di chi sposta'
);

-- CAS: from_status stale (la carta non è più "nuova") -> nessuna mossa.
-- Transizione lecita per la macchina ibrida (0031), così si arriva al CAS.
select is(
  public.move_proposal('44444444-0000-0000-0000-000000000001',
                       'nuova', 'in_valutazione'),
  false,
  'una mossa basata su uno stato stale fallisce (compare-and-set)'
);

-- 0031 [1]: macchina ibrida — in 'nuova' non si torna, da 'nuova' solo
-- 'in_valutazione', il resto è libero.
select throws_ok(
  $$ select public.move_proposal('44444444-0000-0000-0000-000000000001',
                                 'in_valutazione', 'nuova') $$,
  'P0001',
  null,
  'nessuna transizione riporta in nuova'
);
select is(
  public.move_proposal('44444444-0000-0000-0000-000000000001',
                       'in_valutazione', 'rilasciata'),
  true,
  'fuori da nuova ogni salto fra stati distinti è consentito'
);
insert into public.proposals (id, title, proposer_id, project_id)
values ('44444444-0000-0000-0000-000000000003', 'Di Enea, nuova',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-00000000dddd');
select throws_ok(
  $$ select public.move_proposal('44444444-0000-0000-0000-000000000003',
                                 'nuova', 'approvata') $$,
  'P0001',
  null,
  'da nuova si esce solo verso in_valutazione'
);

-- 0006 [2]: from = to non è una transizione, niente riga X -> X in history.
select throws_ok(
  $$ select public.move_proposal('44444444-0000-0000-0000-000000000001',
                                 'rilasciata', 'rilasciata') $$,
  'P0001',
  null,
  'una mossa con from = to è rifiutata'
);

-- 0006 [1]: la GUC non trapela fuori dalla RPC — anche dopo una move_proposal
-- riuscita, l'update diretto dello status resta vietato al non-admin.
insert into public.proposals (id, title, proposer_id, project_id)
values ('44444444-0000-0000-0000-000000000002', 'Di Enea',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-00000000dddd');
select throws_ok(
  $$ update public.proposals set status = 'approvata'
     where id = '44444444-0000-0000-0000-000000000002' $$,
  'P0001',
  null,
  'update diretto dello status ancora bloccato dopo una chiamata a move_proposal'
);

-- Delete: la proposta di Dora non è di Enea -> la RLS filtra, la riga resta.
delete from public.proposals
  where id = '44444444-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.proposals
    where id = '44444444-0000-0000-0000-000000000001'),
  1,
  'un contributor non elimina le proposte altrui'
);

-- Anon: nessun grant execute sulla RPC.
set local role anon;
select throws_ok(
  $$ select public.move_proposal('44444444-0000-0000-0000-000000000001',
                                 'rilasciata', 'approvata') $$,
  '42501',
  null,
  'anon non può chiamare move_proposal'
);

select * from finish();
rollback;
