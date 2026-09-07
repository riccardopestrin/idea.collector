**Last updated:** 2026-09-07

# Security Review

This is the actionable guide for the lightweight security flow. Every coding task that touches source under `src/` or `supabase/migrations/` runs:

1. **Software Reviewer** — first-pass code review, returns structured findings.
2. **Review Reviewer** — filters false positives, returns a filtered action list.
3. **Security Expert** — reviews the change against the vulnerability classes below and records findings in [`issues.md`](issues.md).

Open issues live in [`issues.md`](issues.md); consciously-deferred NICE-TO-HAVE items live in [`be-careful.md`](be-careful.md). Any open **HIGH** issue must be surfaced to the user (see [`.claude/rules/security-warning.md`](../../.claude/rules/security-warning.md)).

## Vulnerability classes to watch for (this stack)

This is a Next.js 16 + Supabase internal dashboard. The classes that matter here:

- **Supabase RLS gaps / BOLA** — a table or query reachable without a Row-Level-Security policy, or a policy that lets a member of one project read/write rows of another. Since migration 0021 the role is **per project** (`project_members.role`; helpers `is_project_member(project_id)` / `is_project_admin(project_id)`, `security definer`): every policy, trigger and RPC must gate on the membership of the row's project, and tables hanging off a proposal inherit visibility via `exists (select 1 from proposals p where p.id = proposal_id)`. A `security definer` RPC callable by `authenticated` that keys on identity (author/proposer) but not on membership is reachable by ex-members — add the membership gate (pattern: migration 0022 on `move_proposal`). Verify every new table has policies and every query is scoped to the actor.
- **Server Action authorization** — mutations are Server Actions. Each one must re-check the authenticated user and the actor's role *in the target project* server-side (`isProjectAdmin(supabase, projectId, userId)`); never trust client-passed identity, role or `projectId`. Since migration 0020 the scan/eval outcome RPCs and `auth.admin` calls run as `service_role` (no RLS backstop): the guard in the calling Server Action is the *only* gate, so every new caller of `runProposalScan`, `runEvaluation`, `inviteMember`-style invites or `supabaseAdmin()` must authorize (user + role/ownership + status) before the call.
- **Secret / key exposure** — service-role keys, Supabase secrets, and the Claude/AI API key must stay server-only. A secret leaked through a `NEXT_PUBLIC_*` env var, a client component, or a response body is a finding. `NEXT_PUBLIC_*` is shipped to the browser — only truly public values belong there. `SUPABASE_SERVICE_ROLE_KEY` is read only in `src/lib/supabase/admin.ts`; import `supabaseAdmin()` only from `"use server"` files, Server Components or `src/lib` services — never from a `"use client"` file (adding `import "server-only"` there turns the runtime guard into a build error).
- **AI prompt injection** — the Claude-powered RICE-scoring feature feeds user-submitted proposal text into a prompt. Treat that text as untrusted: it must not be able to exfiltrate data, override instructions, or trigger unintended actions. Validate/scope what the model can return and act on.
- **XSS** — any use of `dangerouslySetInnerHTML` (or equivalent raw-HTML rendering) with user/AI-derived content. Prefer escaped rendering; if raw HTML is unavoidable, sanitize.
- **SSRF** — if the AI feature (or any server code) fetches a user-supplied URL/link, an attacker can target internal addresses. Validate and allowlist outbound destinations.

## Findings

_SEC-2 e SEC-3 (RLS su `profiles`/`proposals`) risolte il 2026-07-01 da `0003_lock_privileged_columns.sql`; SEC-8 e SEC-9 (esiti scan/eval scrivibili dall'utente) risolte il 2026-09-07 con la migration 0020 applicata sul remoto; SEC-10 (ban GoTrue) risolta il 2026-09-07 per rimozione della feature (0021) — vedi [`issues.md`](issues.md)._

### SEC-1 — User enumeration via verbatim OTP error (LOW)

**Where:** [`src/app/login/page.tsx`](../../src/app/login/page.tsx) — `sendCode()` shows `error.message` verbatim in the `role="alert"`.

**Issue:** With `shouldCreateUser: false`, Supabase returns a distinguishable error when the email is not a registered user. Rendering that message verbatim lets an unauthenticated visitor tell registered emails apart from unregistered ones (account enumeration).

**Impact:** Low. Access is invite-only and internal; enumeration only reveals which addresses are members, not credentials. No account takeover.

**Fix when touched:** Show a generic, non-distinguishing confirmation after `sendCode()` (e.g. "Se l'indirizzo è abilitato, riceverai un codice") regardless of the Supabase result, and only surface real errors for the verify step. Supabase's server-side rate limiting already throttles brute-force probing.

### SEC-5 — No DB length constraint on `profiles.name` (LOW)

**Where:** [`src/app/profile/actions.ts`](../../src/app/profile/actions.ts) (app-side 80-char cap) vs. `supabase/migrations/0003_lock_privileged_columns.sql` (column grant on `name` with no `CHECK`).

**Issue:** The 80-character limit is enforced only in the `updateName` Server Action. The column grant that fixed SEC-2 intentionally allows authenticated users to update `name` on their own row via direct PostgREST, so the app-side cap can be bypassed with an arbitrarily long string.

**Impact:** Low. RLS keeps the write self-scoped and the name is rendered via JSX (auto-escaped), so the worst case is a user storing an oversized name that degrades their own header/proposal-card display and wastes storage. No cross-user or privilege impact.

**Fix:** migration ready in [`supabase/migrations/0008_profiles_name_length_check.sql`](../../supabase/migrations/0008_profiles_name_length_check.sql) (`CHECK (char_length(name) <= 80)`; a NULL name passes the check). Awaiting owner apply to the database.

### SEC-6 — `ai_eval_error` grezzo esposto a tutti gli autenticati (LOW)

**Where:** `supabase/migrations/0010_ai_evaluation.sql` (`fail_ai_evaluation` salva `p_error` verbatim, troncato a 500), [`src/app/proposals/actions.ts`](../../src/app/proposals/actions.ts) (`evaluateProposal` passa `err.message` grezzo), [`src/components/detail/ProposalPanel.tsx`](../../src/components/detail/ProposalPanel.tsx) (render a ogni utente autenticato). Stesso pattern replicato dallo scan duplicati (RFC-006): `supabase/migrations/0017_duplicate_scan.sql` (`fail_dup_scan`, `left(..., 500)`), [`src/lib/ai/runProposalScan.ts`](../../src/lib/ai/runProposalScan.ts) (passa `err.message` grezzo), `ProposalPanel` (render di `dup_scan_error` su stato `fallita`).

**Issue:** Il messaggio d'errore della valutazione AI (errori Anthropic SDK, status GitHub API, messaggi PostgREST, hint di configurazione tipo "repo non collegata al progetto") viene persistito in `proposals.ai_eval_error` e mostrato nel pannello a chiunque, contributor inclusi — non solo agli admin che possono agire sul retry. Dal branch `ideaChecker` lo stesso vale per `proposals.dup_scan_error` (errori Anthropic/web_search/PostgREST dello scan duplicati), reso a ogni viewer autenticato mentre il retry è del solo proposer/admin.

**Impact:** Low. Tool interno, utenti fidati; il contenuto è JSX-escaped (no XSS) e troncato a 500 char. Il rischio residuo è disclosure di dettagli interni (endpoint, request-id, stato config) a ruoli che non ne hanno bisogno.

**Fix when touched:** In `evaluateProposal`, mappare gli errori a categorie stabili user-safe (es. "errore GitHub", "errore modello", "configurazione mancante") prima di chiamare `fail_ai_evaluation`, e/o mostrare `ai_eval_error` nel pannello solo quando `isAdmin`. Stesso trattamento per `runProposalScan`/`fail_dup_scan` e per il render di `dup_scan_error` (mostrarlo solo a `canScan`).

### SEC-7 — Voter email exposed via `rice_votes` voter embed (LOW)

**Where:** [`src/lib/proposals.ts`](../../src/lib/proposals.ts) `getProposalDetail` (`votes:rice_votes(... voter:profiles(name, email))`), [`src/components/detail/ProposalPanel.tsx`](../../src/components/detail/ProposalPanel.tsx) (`personLabel(vote.voter)` in the "Voti utenti" list), migration [`0015_rice_votes.sql`](../../supabase/migrations/0015_rice_votes.sql) (`"auth read" ... using (true)`).

**Issue:** The user-vote list embeds each voter's `profiles(name, email)` and renders `personLabel`, which falls back to the raw **email** when `name` is null. Combined with the per-voter score, this makes voting **non-anonymous**: any authenticated member sees who voted and their individual RICE score. The email fallback is the same `name ?? email` pattern already used across the app for `proposer`, comment `author`, and `status_history.author`, so this is not a new exposure *class* — it applies the existing pattern to a new relation.

**Impact:** Low. Invite-only internal tool where members already see each other's proposer/author emails on every card and comment; the RLS `select` is intentionally open to all authenticated members ("la lista votanti è visibile nel pannello"). Non-anonymous voting is a deliberate product decision, not a leak. Residual risk is only that individual voters and their scores are attributable — which could bias voting or be undesirable if votes are ever meant to be private.

**Fix when touched:** If votes should be anonymous, stop embedding `voter:profiles` in `getProposalDetail` and render aggregate/anonymous rows only (the composite average already needs no per-voter identity). If attribution stays but email should not, embed `name` only and label unnamed voters generically. No change needed while non-anonymous voting is intended.

### SEC-11 — `git_ref`: check DB più lasso di `parseGitRef` (path traversal same-origin su github.com) (LOW)

**Where:** [`supabase/migrations/0020_admin_powers_service_role.sql`](../../supabase/migrations/0020_admin_powers_service_role.sql) (`check (git_ref !~ '\s' and length(git_ref) between 1 and 200)`), [`src/lib/github/gitRef.ts`](../../src/lib/github/gitRef.ts) (`parseGitRef` rifiuta segmenti vuoti/`.`/`..`; `gitRefUrl` codifica segmento per segmento), [`src/components/detail/GitRefSection.tsx`](../../src/components/detail/GitRefSection.tsx) (`<a href={gitRefUrl(...)} target="_blank" rel="noopener noreferrer">`).

**Issue:** la Server Action `setGitRef` normalizza con `parseGitRef`, ma la policy "owner or admin update" permette a proposer/admin di scrivere `git_ref` anche via PostgREST diretto, dove vale solo il `CHECK` (niente spazi, cap 200). Un ref come `../../<org>/<repo>` supera il check; `encodeURIComponent` non codifica `.`, quindi l'href diventa `https://github.com/<owner>/<name>/tree/../../<org>/<repo>` e il browser lo normalizza su un path arbitrario di github.com. La label mostra il ref grezzo (JSX-escaped), quindi il link è riconoscibile.

**Impact:** Low. L'origine resta github.com (prefisso fisso, nessun `javascript:`/host esterno), `noopener noreferrer`, attori già fidati (proposer/admin sulla propria proposta). Al massimo un link "branch" che porta a un'altra pagina di GitHub.

**Fix when touched:** allineare il backstop DB a `parseGitRef` nel `CHECK` (migration owner-locked): `git_ref ~ '^(#\d+|[^/\s]+(/[^/\s]+)*)$' and git_ref !~ '(^|/)\.\.?(/|$)'`. In alternativa (o in più) far scartare a `gitRefUrl` i segmenti `.`/`..`/vuoti prima di costruire l'URL.

### SEC-12 — Re-homing di una proposta in un altro progetto via `project_id` (MEDIUM)

**Where:** [`supabase/migrations/0021_projects.sql`](../../supabase/migrations/0021_projects.sql) — `enforce_proposal_privileged_columns` (`if public.is_project_admin(new.project_id) then return new;` valutato sul progetto di **destinazione**; il lock `new.project_id is distinct from old.project_id` sta sotto lo short-circuit) e policy `"owner or admin update"` su `proposals` (`using (proposer_id = auth.uid() or is_project_admin(project_id))`, nessun `with check` distinto → la stessa espressione vale per la riga nuova). Stessa forma in `enforce_proposal_crystallization`.

**Issue:** L'header della 0021 dichiara "una proposta non cambia progetto", ma il trigger lo garantisce solo per chi non è admin del progetto **di arrivo**. Chiunque può creare un progetto (`create_project`) e diventarne admin: un contributor X di A, proposer di una propria idea in A, esegue `PATCH /rest/v1/proposals?id=eq.<own> {"project_id":"<B>"}` con anon key + propria sessione. La policy passa (`proposer_id = auth.uid()` sulla riga vecchia e nuova), il trigger fa `return new` perché X è admin di B, la cristallizzazione idem. Riprodotto in locale il 2026-09-07 (transazione rollbackata). Con la proposta si spostano, per FK, i commenti, i voti RICE e la status_history scritti dagli altri membri di A: spariscono dalla board di A e diventano leggibili in B a chiunque X inviti (gli autori risultano "sconosciuto" perché `profiles` resta co-member-only, ma il testo sì). Le Server Action non sono un vettore (`updateProposal` scrive solo `parseProposalFields`); è solo PostgREST diretto.

**Impact:** MEDIUM. Rompe l'isolamento per progetto che è l'invariante centrale di RFC-007 (OWASP A01 Broken Access Control / API3 Broken Object Property Level Authorization), ma il perimetro è limitato: solo proposte di cui X è proposer (che X può già cancellare), e i contenuti trasportati erano già leggibili da X. Il danno marginale è la disclosure a terzi (membri di B) di commenti/voti di membri di A e la scomparsa dell'idea dalla bacheca di A senza traccia.

**Fix (migration owner-locked):** spostare il lock di `project_id` **prima** dello short-circuit admin, incondizionato per tutti: `if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then raise exception 'una proposta non cambia progetto'; end if;` come prima istruzione del trigger (in alternativa `revoke update (project_id)` non è praticabile: la grant update su `proposals` è table-wide). pgTAP: contributor/admin che tenta il cambio di `project_id` → `throws_ok`. **Stato:** ✅ risolto 2026-09-07 — `0022_move_proposal_membership.sql` [3] + `rls_projects_test.sql`, applicata sul remoto.

### SEC-13 — Binding di un progetto a un'installazione GitHub arbitraria della nostra App (MEDIUM)

**Where:** [`supabase/migrations/0021_projects.sql`](../../supabase/migrations/0021_projects.sql) (`grant update (name, github_installation_id, github_owner, github_repo) on projects to authenticated`, policy `"admin update"`), [`src/app/projects/actions.ts`](../../src/app/projects/actions.ts) (`selectRepo` — allowlist repo ∈ `listInstallationRepos`, solo in TS), [`src/app/auth/github/callback/route.ts`](../../src/app/auth/github/callback/route.ts) (`installation_id` dalla query string, verificato solo con `installationToken(installationId)`), [`src/lib/github/app.ts`](../../src/lib/github/app.ts) / [`src/lib/github/repoDigest.ts`](../../src/lib/github/repoDigest.ts) (token e digest con la private key dell'App).

**Issue:** Due percorsi, stesso difetto — l'installazione non è legata all'identità di chi la collega. (a) **PostgREST diretto:** l'admin di un progetto (oggi qualunque utente, via `create_project`) può scrivere `github_installation_id`, `github_owner`, `github_repo` a piacere: la grant di colonna è table-wide e la validazione "repo coperta dall'installazione" vive solo in `selectRepo`. Riprodotto in locale il 2026-09-07. (b) **Callback:** il nonce anti-CSRF lega il flusso all'admin e al progetto, ma `installation_id` è un parametro URL che l'utente può riscrivere prima di atterrare sul callback; `installationToken` dimostra solo che è un'installazione della *nostra* App (GitHub emette il token per qualunque installazione dell'App), non che sia quella appena creata da quell'utente. Gli id installazione sono interi globali GitHub, leggibili da ogni co-membro di un progetto già collegato (`select github_installation_id from projects` — oggi tutti gli utenti, membri del progetto "test" per backfill) o enumerabili. Effetto: la pagina impostazioni elenca tutte le repo private coperte dall'installazione (`listInstallationRepos`) e la valutazione AI (`buildRepoDigest`: descrizione, linguaggi, README, albero file, ultimi commit, package.json) le passa a Claude, la cui rationale è resa nel pannello. Pre-0021 la stessa grant esisteva su `app_settings` ma solo per l'admin globale, che era il proprietario dell'installazione.

**Impact:** MEDIUM. Disclosure cross-tenant di metadati e contenuto (README, struttura, commit) di repo private coperte dall'installazione di un altro team, per un utente autenticato qualsiasi che conosca o indovini l'id; nessuna scrittura su GitHub (token installazione con i permessi read dell'App). Oggi l'unica installazione è quella dell'owner, già usata dal progetto "test" a cui tutti appartengono: il danno marginale è limitato alle altre repo eventualmente coperte dall'installazione. Cresce con il secondo team.

**Fix:** (1) migration owner-locked: `revoke update (github_installation_id, github_owner, github_repo) on projects from authenticated` (resta `name`) e `create unique index on projects (github_installation_id)` — un'installazione appartiene a un solo progetto; (2) le tre scritture (`callback`, `selectRepo`, `disconnectGithub`) passano da `supabaseAdmin()` dopo il guard `requireProjectAdmin` già presente (stesso pattern di 0020: autorizzazione nella Server Action, scrittura service-role) — oppure una RPC `security definer` `set_project_github(project, installation, owner, repo)` che ricontrolla `is_project_admin` e l'allowlist; (3) per chiudere anche il percorso (b) serve legare l'installazione all'installatore: attivare "Request user authorization (OAuth) during installation" sulla GitHub App e nel callback verificare con il token user-to-server (`GET /user/installations`) che `installation_id` sia fra quelle dell'utente che ha appena autorizzato. pgTAP: admin che scrive `github_installation_id` via update diretto → `throws_ok` 42501. **Stato:** (1) senza unique index e (2) via `updateGithubSettings` service-role implementati in `0022` [5] + `src/lib/github/settings.ts`, applicati sul remoto il 2026-09-07; (3) percorso callback ancora aperto (azione owner sulla GitHub App).

### SEC-14 — RPC di promozione commento autorizzate per identità, non per appartenenza (LOW)

**Where:** `supabase/migrations/0016_comment_promotion.sql` (`promotion_target`, `request_comment_promotion`), [`supabase/migrations/0021_projects.sql`](../../supabase/migrations/0021_projects.sql) (`resolve_comment_promotion`, `revoke_comment_promotion` riscritte con `is_project_admin(proposal_project(...))` ma senza gate di membership per autore/proposer) — tutte `security definer`, execute ad `authenticated`.

**Issue:** `promotion_target` legge commento e proposta bypassando la RLS e controlla solo che la proposta sia aperta; le tre RPC poi autorizzano per identità: autore del commento (request/revoke), proposer (resolve/revoke), admin del progetto (resolve/revoke). Un membro rimosso dal progetto, o un autore/proposer di una proposta spostata altrove (SEC-12), conserva quindi i poteri legati ai propri commenti e alle proprie proposte — candidare/ritirare un contributo, accettare o rifiutare le candidature altrui — su righe che la RLS non gli mostra più. Riprodotto in locale il 2026-09-07 (`request_comment_promotion` da un outsider autore → `pending`). È la stessa classe del finding [1] della review chain, chiuso dalla 0022 per `move_proposal`; le RPC di promozione sono rimaste fuori.

**Impact:** Low. Solo cambi di `promotion_status` su commenti già propri (o già in `pending` sulla propria ex-proposta): nessuna lettura, nessuna escalation, nessun effetto sui punteggi (l'accettazione richiede comunque un proposer/admin, e l'ex-proposer accetta solo su una proposta che continua a firmare come autore). Il testo di un contributo `accepted` entra nel prompt di valutazione, ma è testo già presente e già visibile.

**Fix (migration owner-locked):** un gate solo, nel seam comune: in `promotion_target` dopo il check "proposta aperta" aggiungere `if not public.is_project_member(c.proposal_id → project) then raise exception 'non membro del progetto'` (via `public.proposal_project(c.proposal_id)` o join diretta, la funzione è definer). pgTAP: outsider autore → `throws_ok 'non membro del progetto'` su request e revoke. **Stato:** ✅ risolto 2026-09-07 — `0022` [4] + `rls_projects_test.sql`, applicata sul remoto.

### SEC-15 — `proposal_project(uuid)` come oracle di esistenza/appartenenza (LOW)

**Where:** [`supabase/migrations/0021_projects.sql`](../../supabase/migrations/0021_projects.sql) — `create function public.proposal_project(p_proposal uuid) ... security definer` con `grant execute ... to authenticated`, usata nelle policy `"admin delete open"` (`comments`) e `"admin insert history"` (`status_history`) e nelle RPC di promozione.

**Issue:** Le policy girano con i privilegi dell'utente che esegue la query, quindi la funzione deve essere eseguibile da `authenticated`; essendo `security definer` legge `proposals` senza RLS e risponde per qualsiasi uuid: `select proposal_project('<uuid>')` restituisce il `project_id` di una proposta che il chiamante non vede (null se non esiste). Riprodotto in locale il 2026-09-07.

**Impact:** Low. Serve conoscere l'uuid (v4, non enumerabile) e si ottiene solo un altro uuid più il bit di esistenza; niente contenuti. Utile a un attaccante solo in combinazione con altro (es. per sapere se una proposta è stata spostata, SEC-12).

**Fix when touched (migration owner-locked):** far dipendere le due policy da una sub-query RLS-filtrata invece che dalla funzione — `exists (select 1 from public.proposals p where p.id = proposal_id and public.is_project_admin(p.project_id))` (equivalente: l'admin è membro, quindi vede la riga) — e poi `revoke execute on function public.proposal_project from authenticated`: le RPC `security definer` che la usano non hanno bisogno della grant.

### SEC-4 — Vulnerable transitive `postcss` via `next` (LOW)

**Where:** `pnpm-lock.yaml` — dependency path `.>next>postcss` (`postcss < 8.5.10`).

**Issue:** GHSA-qx2v-qp2m-jg93 (moderate): PostCSS's CSS stringifier does not escape `</style>`, enabling XSS when untrusted CSS is stringified into HTML.

**Impact:** Low. In this app PostCSS runs only at build time on our own Tailwind CSS — no untrusted CSS ever reaches the stringifier. The residual cost is a permanently red `pnpm audit --prod`, which masks future real advisories.

**Fix when touched:** Bump `next` once it ships with `postcss >= 8.5.10`, or add a pnpm override (`"pnpm": { "overrides": { "postcss": ">=8.5.10" } }`) and verify the build.
