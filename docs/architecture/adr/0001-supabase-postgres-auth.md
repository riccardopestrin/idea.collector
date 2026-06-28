# ADR-0001: Supabase come database e autenticazione

- **Stato:** Accepted
- **Data:** 2026-06-22

## Context
La dashboard ha bisogno di un database relazionale (proposte, valutazioni, storico stati, tag) e di un'autenticazione email vera per il team interno. È una nuova dipendenza con lock-in a lungo termine, quindi richiede una ADR ([`adr-when-to-write.md`](../../../.claude/rules/adr-when-to-write.md)).

## Decision
Usare **Supabase** (Postgres gestito + Auth) come unico backend dati.
- Persistenza: Postgres, schema in `supabase/migrations/`.
- Autenticazione: Supabase Auth con **magic link via email** (niente password).
- Autorizzazione: **Row Level Security** sulle tabelle + controllo di ruolo (`'admin' | 'contributor'`) sulla tabella `profiles`, ricontrollato nelle Server Action.
- Accesso da Next.js via `@supabase/ssr` (`src/lib/supabase/{server,client}.ts`) e refresh sessione nel `proxy.ts`.

## Consequences
**Positive:** zero infrastruttura da gestire; auth, DB e RLS in un solo servizio; magic link elimina la gestione password; le RLS danno una rete di sicurezza sull'autorizzazione indipendente dal codice applicativo.
**Negative:** lock-in su Supabase (le RLS e l'auth non sono portabili 1:1 su un altro provider); la chiave service-role va tenuta fuori dal client; serve un progetto Supadase con le sue env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Source
Decisione dell'owner in fase di setup, su domanda esplicita riguardo persistenza e auth dell'MVP.

## If we were starting today
Sì. Per un tool interno con team piccolo, Supabase è la scelta a minor sforzo che copre DB + auth + autorizzazione insieme. Rivedere solo se servisse multi-tenancy complessa o un modello di auth non supportato.

