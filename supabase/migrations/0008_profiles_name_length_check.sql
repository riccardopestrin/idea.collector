-- SEC-5: backstop a DB per il cap applicativo di 80 caratteri su profiles.name
-- (la Server Action updateName valida, ma un update diretto via PostgREST lo aggira).
alter table public.profiles
  add constraint profiles_name_length_check check (char_length(name) <= 80);
