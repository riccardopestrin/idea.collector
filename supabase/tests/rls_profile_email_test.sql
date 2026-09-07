-- Verifica 0025: il cambio email confermato su auth.users si riflette su profiles.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email)
values ('aaaa0025-0000-0000-0000-000000000001', 'prima25@test.local');
update auth.users set email = 'dopo25@test.local'
  where id = 'aaaa0025-0000-0000-0000-000000000001';
select is(
  (select email from public.profiles where id = 'aaaa0025-0000-0000-0000-000000000001'),
  'dopo25@test.local',
  'profiles.email segue il cambio email su auth.users'
);

select * from finish();
rollback;
