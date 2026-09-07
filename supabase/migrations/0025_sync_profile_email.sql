-- profiles.email nasce con handle_new_user e non seguiva il cambio email
-- (auth.updateUser + conferma dei link): qui si allinea al momento in cui
-- GoTrue scrive la nuova email su auth.users.
create function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_profile_email();
