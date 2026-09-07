-- Verifica 0009: commenti leggibili da tutti i membri, inserimento solo a
-- proprio nome, anon fuori, vincolo su body vuoto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Setup (come superuser): due contributor e una proposta.
insert into auth.users (id, email)
values ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'fina@test.local'),
       ('99999999-9999-9999-9999-999999999999', 'gino@test.local');

insert into public.projects (id, name, created_by)
values ('00000000-0000-0000-0000-00000000ffff', 'Test', 'ffffffff-ffff-ffff-ffff-ffffffffffff');
insert into public.project_members (project_id, user_id, role)
values ('00000000-0000-0000-0000-00000000ffff', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'admin'),
       ('00000000-0000-0000-0000-00000000ffff', '99999999-9999-9999-9999-999999999999', 'contributor');
insert into public.proposals (id, title, proposer_id, project_id)
values ('55555555-0000-0000-0000-000000000001', 'Di Fina',
        'ffffffff-ffff-ffff-ffff-ffffffffffff', '00000000-0000-0000-0000-00000000ffff');

-- Sessione di Gino (contributor, NON proprietario della proposta)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.comments (proposal_id, author_id, body)
    values ('55555555-0000-0000-0000-000000000001',
            '99999999-9999-9999-9999-999999999999', 'Ottima idea')$$,
  'un membro commenta una proposta altrui a proprio nome'
);

select throws_ok(
  $$insert into public.comments (proposal_id, author_id, body)
    values ('55555555-0000-0000-0000-000000000001',
            'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Spoofing')$$,
  '42501',
  null,
  'non si può commentare a nome di un altro (with check author_id = auth.uid())'
);

select throws_ok(
  $$insert into public.comments (proposal_id, author_id, body)
    values ('55555555-0000-0000-0000-000000000001',
            '99999999-9999-9999-9999-999999999999', '   ')$$,
  '23514',
  null,
  'un body vuoto/solo spazi viola il check constraint'
);

select is(
  (select count(*)::int from public.comments
    where proposal_id = '55555555-0000-0000-0000-000000000001'),
  1,
  'i commenti sono leggibili dai membri del progetto'
);

-- Anon: nessuna lettura.
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok(
  $$select count(*) from public.comments$$,
  '42501',
  null,
  'anon non legge i commenti (nessun grant)'
);

select * from finish();
rollback;
