# ADR-0008: Esiti AI (scan duplicati, valutazione) scritti solo dal service role

- **Stato:** Proposed (bozza preparata su richiesta dell'owner, 2026-09-05 — da accettare)
- **Data:** 2026-09-05
- **Supersede parzialmente:** [ADR-0005](0005-tiptap-editor-anchored-comments.md) (paragrafo "RPC eval rilassate via `can_run_ai_evaluation`") e il punto "Enforcement a due livelli" di [ADR-0007](0007-duplicate-scan-llm-judge-web-search.md) per le colonne `dup_*`

## Context

Gli esiti delle due pipeline AI — punteggi RICE (`apply_ai_evaluation`) e verdetto anti-duplicato (`apply_dup_scan`) — venivano persistiti da RPC `SECURITY DEFINER` chiamate **con la sessione dell'utente**, autorizzate a DB da `can_run_ai_evaluation` / `can_run_dup_scan` (admin, oppure proposer/contributore nello stato giusto). Il gate era coerente per chi *avvia* lo scan, ma sbagliato per chi ne *scrive l'esito*: il proposer in `nuova` è esattamente l'attore che il blocco anti-duplicato deve vincolare, e poteva chiamare `apply_dup_scan(p_flagged=false)` via PostgREST con l'anon key sbloccandosi da solo, o forgiare match/report "firmati Claude" (SEC-9, elevata a HIGH dall'owner il 2026-07-09; stessa classe SEC-8 per i punteggi). Il difetto è strutturale: il DB non può distinguere un esito reale da uno forgiato se il principal che scrive è il soggetto vincolato. La remediation scelta a luglio ("opzione service-role") cambia il modello di scrittura privilegiata stabilito da ADR-0005, quindi richiede questa ADR.

## Decision

- Le sei RPC `begin/apply/fail_ai_evaluation` e `begin/apply/fail_dup_scan` sono eseguibili **solo dal ruolo `service_role`** (`revoke execute … from authenticated`, `grant … to service_role`, migration 0020). I check interni `can_run_*` sono eliminati: il grant è l'unico gate a DB, e sotto `service_role` `auth.uid()` è comunque null.
- Il server scrive con un client dedicato, **`supabaseAdmin()` in `src/lib/supabase/admin.ts`** (chiave `SUPABASE_SERVICE_ROLE_KEY`, solo lato server, mai `NEXT_PUBLIC_`). `runProposalScan` e `runEvaluation` usano il client utente per le letture e il client admin per le sole RPC di esito.
- **L'autorizzazione vive nella Server Action chiamante**, come già prescritto da `layered-architecture.md`: `evaluateProposal` (admin), `runProposalScanAction`/`updateProposal` (proposer o admin), `editComment` (autore del contributo accepted), `resolve/revokeCommentPromotion` (proposer o admin). Nessuna RPC di esito è più raggiungibile da un client utente.
- Lo stesso client service-role è il seam per le API `auth.admin` (inviti, disabilitazione utenti). Il **cambio ruolo** resta invece una RPC user-called (`set_profile_role`, `is_admin()` a DB): lì l'utente autenticato è l'admin e il backstop DB è corretto — il pattern ADR-0005 non è abolito, è confinato ai casi in cui il principal che scrive non è il soggetto vincolato.
- Il trigger `enforce_proposal_privileged_columns` e le GUC transaction-local (`idea.ai_eval`, `idea.dup_scan`) restano invariati: continuano a impedire scritture dirette alle colonne AI da qualsiasi utente.

## Consequences

**Positive:** la superficie di forging sparisce per costruzione (verificato da `tests/integration/promotion-and-votes.test.ts` e `supabase/tests/rls_admin_powers_test.sql`: `apply_dup_scan` da utente autenticato → `42501`); chiude anche `be-careful 2026-07-08-strd` (il marker di fallimento viene scritto anche se la proposta è uscita da `nuova` a metà scan); zero impatto UX.

**Negative / vincoli:** per scan ed eval **il DB non è più backstop dell'autorizzazione** — un guard dimenticato in una Server Action che chiama `runEvaluation`/`runProposalScan` non viene fermato a valle (registrato in `be-careful 2026-07-03-adm1`; il Software Reviewer deve verificare il guard su ogni nuovo call site). Nuovo secret di produzione (`SUPABASE_SERVICE_ROLE_KEY`), con la regola: `supabaseAdmin()` si importa solo da `"use server"` / Server Component, mai da un Client Component. `grant DML on all tables to service_role` non copre le tabelle future (aggiungere il grant nella migration che le crea).

## Source

Finding SEC-9 (HIGH) e SEC-8 in `docs/security/issues.md`; decisione dell'owner del 2026-07-09 ("remediation service-role, implementazione deferita, richiede ADR"); implementazione nel branch `newFeatures` (migration `0020_admin_powers_service_role.sql`), review chain del 2026-09-05.

## If we were starting today

Sì, e da subito: il principio "chi è vincolato da un gate non ne scrive mai l'esito" avrebbe evitato di aprire le RPC ai proposer in 0013/0016/0017. Terremmo il pattern RPC user-called (ADR-0005) solo per le scritture in cui l'utente agisce su ciò che gli appartiene (voti, commenti, promozioni, ruoli da admin), e il service role per tutto ciò che rappresenta un verdetto esterno (AI, integrazioni).
