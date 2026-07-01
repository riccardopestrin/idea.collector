-- Chiude due falle nel modello di autorizzazione (review 2026-07-01, finding [1] e [2]).
--
-- [1] profiles: la policy "self update" (USING id = auth.uid(), senza WITH CHECK)
--     non vincola le colonne: un contributor poteva settarsi role='admin' via
--     PostgREST. Fix: privilegi di colonna — authenticated aggiorna solo name.
--     NB: i column privilege sono valutati PRIMA delle RLS e valgono anche per gli
--     admin (che operano anch'essi come ruolo authenticated): oggi va bene perché
--     gli admin si promuovono a mano da dashboard/SQL (vedi 0001, handle_new_user).
--     La futura feature "gestione profili da admin" dovrà estendere questo grant.
revoke update on table public.profiles from authenticated;
grant update (name) on table public.profiles to authenticated;

-- [2] proposals: "owner or admin update" permetteva al proprietario di cambiare
--     status/campi AI/note interne, contraddicendo l'invariante "lo stato lo cambia
--     l'admin via status_history". Un column grant qui bloccherebbe anche il futuro
--     flusso admin (che gira come authenticated), quindi: trigger che rigetta le
--     modifiche alle colonne privilegiate se non admin. Copre anche l'INSERT,
--     altrimenti bastava creare la proposta già con status/campi AI arbitrari
--     (la Server Action oggi inserisce solo title/description/problem/links).
--     search_path = '' + qualificazione esplicita, come in 0002.
create function public.enforce_proposal_privileged_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'nuova'
      or new.ai_rationale is not null
      or new.ai_generated
      or new.manually_edited
      or new.internal_notes is not null
    then
      raise exception 'solo un admin può impostare status, campi AI o note interne';
    end if;
  elsif new.status is distinct from old.status
    or new.proposer_id is distinct from old.proposer_id
    or new.ai_rationale is distinct from old.ai_rationale
    or new.ai_generated is distinct from old.ai_generated
    or new.manually_edited is distinct from old.manually_edited
    or new.internal_notes is distinct from old.internal_notes
  then
    raise exception 'solo un admin può modificare status, proposer o campi AI/note interne';
  end if;
  return new;
end;
$$;

create trigger proposals_lock_privileged_columns
  before insert or update on public.proposals
  for each row execute function public.enforce_proposal_privileged_columns();
