-- Grant DML espliciti per authenticated. I progetti Supabase recenti non
-- concedono più privilegi di default ad anon/authenticated sulle tabelle nuove
-- di public: senza questi grant lo schema funziona solo su progetti legacy.
-- I privilegi dicono cosa il ruolo PUÒ toccare; le RLS restringono le righe.
-- NB: profiles resta senza update qui — 0003 concede update solo su (name).
grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.tags to authenticated;
grant select, insert, update, delete on table public.proposals to authenticated;
grant select, insert, update, delete on table public.proposal_tags to authenticated;
grant select, insert on table public.status_history to authenticated;
