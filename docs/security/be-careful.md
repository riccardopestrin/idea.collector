**Last updated:** 2026-09-08

# Be Careful — issue note consapevolmente rinviate

Registro durevole delle NICE-TO-HAVE consapevolmente rinviate: problemi che **non** si verificano nell'attuale use case ma che possono "svegliarsi" se un'assunzione cambia. Vedi [`.claude/rules/nice-to-have-to-be-careful.md`](../../.claude/rules/nice-to-have-to-be-careful.md) per il flusso.

Ogni voce ha un ID stabile nel formato `YYYY-MM-DD-XXXX` (data del flag + 4 char di hash). **Gli ID non vengono mai riusati, rinumerati o riscritti**, nemmeno dopo la risoluzione.

---

## `2026-09-08-rtjn` `RealtimeRefresh` decide "sessione sì/no" una volta sola al mount del root layout

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/components/RealtimeRefresh.tsx](../../src/components/RealtimeRefresh.tsx) — `getSession()` → `realtime.setAuth(token)` → `subscribe()`; senza sessione **non** sottoscrive e l'effetto non si ri-esegue mai (montato una volta in `src/app/layout.tsx`)

### Il problema potenziale
Se un utente arriva nell'app senza sessione e poi fa login **senza un full document load** (soft navigation), il canale Realtime resta spento per tutta la sessione: nessun aggiornamento live cross-utente, sintomo identico al bug appena corretto (join anonimo scartato dalla RLS).

### Perché oggi non è un problema
L'unico percorso di login è `signInWithOtp` → email → `/auth/callback` (Route Handler) → `NextResponse.redirect` → **full page load**: il root layout si rimonta con la sessione già nei cookie. Il PKCE exchange è server-side, quindi il client browser non emette mai `SIGNED_IN` lato client.

### Quando diventa un problema
1. Un login che termina con `redirect()` di Server Action o `router.push` (password login, OAuth gestito client-side).
2. Un flusso che monta l'app anonima e autentica in-page.

### Cosa fare se devi toccare quest'area
Risottoscrivere su `supabase.auth.onAuthStateChange('SIGNED_IN')`, oppure sottoscrivere comunque e lasciare che `_handleTokenChanged` di supabase-js (che chiama `realtime.setAuth(token)` su `SIGNED_IN`) promuova il join. In entrambi i casi il join iniziale deve continuare a portare il JWT (vedi commento nel componente): è il fix del 2026-09-08.

### Cronologia
- 2026-09-08 — Flaggato durante review chain del fix "Realtime join anonimo" (Software Reviewer LOW → Review Reviewer NICE-TO-HAVE, solo documentazione).

## `2026-09-08-ca07` Revoca account differita a `jwt_expiry` con `getClaims()` nel proxy e nelle pagine

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/proxy.ts](../../src/proxy.ts) — `getClaims()` al posto di `getUser()`: verifica firma ed `exp` in locale (chiave ECC P-256), nessun round trip all'Auth server
- [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts) — `currentUser()`: identità dalle claims, usata da tutte le pagine
- [src/app/profile/actions.ts](../../src/app/profile/actions.ts) — `deleteAccount`: fa `signOut` solo sul dispositivo corrente

### Il problema potenziale
`getUser()` rifiutava subito un token il cui utente era stato cancellato o bannato server-side. `getClaims()` con chiave asimmetrica non contatta il server: un access token ancora valido passa proxy e pagine finché non scade (`jwt_expiry` = 3600 s in `supabase/config.toml`), poi il refresh fallisce. Caso concreto: dopo `deleteAccount` un secondo dispositivo continua a renderizzare pagine (la RLS restituisce vuoto, `loadProject` manda a `/onboarding`) per al massimo un'ora.

### Perché oggi non è un problema
Le pagine sono sola lettura e la RLS non restituisce nulla a un utente cancellato. Tutte le Server Action (mutazioni) usano ancora `getUser()`, quindi le scritture di un account revocato falliscono subito. Non esiste una feature di ban/disattivazione: l'unico percorso è `deleteAccount`, che è l'utente stesso a invocare.

### Quando diventa un problema
1. Se si aggiunge un ban/disattivazione admin e ci si aspetta effetto immediato lato UI.
2. Se una pagina inizia a mostrare dati non coperti da RLS (es. letture con client service-role) basandosi solo sull'identità dalle claims.
3. Se `jwt_expiry` viene alzato.

### Cosa fare se devi toccare quest'area
Abbassare `jwt_expiry` (config Supabase) per stringere la finestra; non reintrodurre `getUser()` nelle pagine (un round trip per navigazione, vedi `docs/guide/12-deploy.md` §12.6). Per un ban immediato: `auth.admin.signOut(userId, 'global')` invalida i refresh token, il resto lo fa la scadenza.

### Cronologia
- 2026-09-08 — Flaggato durante review chain della sessione latenza/getClaims (Software Reviewer LOW → Review Reviewer NICE-TO-HAVE, solo documentazione). Sezione §6.3 della guida aggiornata nello stesso giro.
- 2026-09-08 — Cross-ref (review chain fix Realtime): il sign-out è una Server Action con `redirect("/login")` (soft navigation), quindi il canale `RealtimeRefresh` resta montato con il JWT dell'utente uscito e continua a ricevere i suoi eventi (→ `router.refresh()` innocui su `/login`) finché Realtime non lo chiude a `exp`. Stessa finestra `jwt_expiry`. Rimedio futuro: `supabase.auth.signOut({ scope: "local" })` client-side (o `realtime.setAuth()` reset) prima della redirect.

## `2026-09-07-inv1` Inviti service-role raggiungibili da ogni utente autenticato via `create_project` — oracle di esistenza account

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/app/projects/actions.ts](../../src/app/projects/actions.ts) — `inviteMember`: `auth.admin.inviteUserByEmail` (service-role) per qualsiasi email; se GoTrue rifiuta ("già registrato") lookup `profiles` per email e sola membership; esito `invited` vs `added`
- [supabase/migrations/0021_projects.sql](../../supabase/migrations/0021_projects.sql) — `create_project` con execute a `authenticated`: chiunque crea un progetto e ne è admin, quindi invita

### Il problema potenziale
Prima della 0021 l'invito era riservato all'admin globale. Ora ogni account può (a) far creare account e inviare email dall'identità SMTP del prodotto verso indirizzi arbitrari, (b) dedurre dall'esito se un'email è già registrata e, aggiungendola a un proprio progetto, leggerne nome ed email (policy co-membri su `profiles`) senza consenso dell'invitato.

### Perché oggi non è un problema
È la feature decisa dall'owner (RFC-007: "chi crea il progetto è admin e invita"). L'app è invite-only end-to-end: ogni account esistente è stato invitato da un admin, il team è piccolo e fidato. L'oracle esisteva già per gli admin (`inviteFailed` vs successo) e collassare `invited`/`added` sarebbe teatro: l'invitato compare comunque subito nella lista membri.

### Quando diventa un problema
1. Se l'app apre la self-registration o accoglie utenti non fidati.
2. Se serve un tetto agli inviti GoTrue (rate limit SMTP, abuso).
3. Se la visibilità di nome/email tra co-membri diventa sensibile (GDPR con utenti esterni).

### Cosa fare se devi toccare quest'area
Gate su `create_project` (es. solo membri di almeno un progetto, o flag su `profiles`) e/o rate limit per utente sugli inviti in `inviteMember`; eventualmente messaggio neutro unico. Consequence registrata in ADR-0009.

### Cronologia
- 2026-09-07 — Flaggato durante review chain `projectList` (Software Reviewer MEDIUM → Review Reviewer NICE-TO-HAVE: è la decisione owner, serve solo il record).

## `2026-07-03-adm1` Guard admin duplicato in azioni e route

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/app/profile/actions.ts](../../src/app/profile/actions.ts) — helper `requireAdmin()` privato del modulo
- [src/app/proposals/actions.ts](../../src/app/proposals/actions.ts) — `evaluateProposal`: stesso guard inline (getUser + getProfile role)
- [src/app/auth/github/callback/route.ts](../../src/app/auth/github/callback/route.ts) — terza variante inline
- [src/app/proposals/actions.ts](../../src/app/proposals/actions.ts) — `resolveCommentPromotion` e `revokeCommentPromotion` (branch `commentPromotion`, 2026-07-08): variante **proposer-or-admin** — un'estrazione di un semplice `requireAdmin` non coprirebbe questa forma; l'eventuale helper deve accettare anche la condizione di ownership
- [src/app/proposals/actions.ts](../../src/app/proposals/actions.ts) — `runProposalScanAction` (branch `ideaChecker`, 2026-07-08): quarta istanza della variante proposer-or-admin (dal 2026-09-05 SENZA backstop DB: `can_run_dup_scan` droppata dalla 0020)
- [src/app/profile/actions.ts](../../src/app/profile/actions.ts) — `inviteUser`/`setUserRole`/`removeUser` (branch `newFeatures`, 2026-09-05): riusano `requireAdmin()` del modulo; `deleteComment` e `setGitRef` aggiungono due istanze inline della variante owner-or-admin
- [src/app/projects/actions.ts](../../src/app/projects/actions.ts) — `requireProjectAdmin(projectId)` (branch `projectList`, 2026-09-07): il guard è ora **per progetto** (`isProjectAdmin(supabase, projectId, userId)` in `src/lib/projects.ts`, migration 0021). Le 9 istanze inline in `src/app/proposals/actions.ts` e `src/app/proposals/[id]/actions.ts` sono state riscritte 1:1 nella forma `proposer_id !== user.id && !(await isProjectAdmin(supabase, proposal.project_id, user.id))` — stessa duplicazione, nuovo seam. Il `project_id` va sempre selezionato insieme al `proposer_id`: dimenticarlo passa `undefined` a `isProjectAdmin` → false → l'admin viene rifiutato (fail-closed, ma è un bug funzionale).

### Il problema potenziale
La forma auth-resolve + role-check è ripetuta in 3+ punti: una futura modifica all'autorizzazione va applicata ovunque, e un punto dimenticato è un bug di sicurezza (mitigato dal backstop RLS/RPC a DB).

### Perché oggi non è un problema
Ogni call site fa il guard correttamente e il DB (RPC admin-only + RLS) rifiuta comunque le scritture non autorizzate.
**Attenzione (2026-09-05, migration 0020 / SEC-9):** per le scritture di scan ed eval il backstop DB non c'è più — le RPC sono eseguibili solo da `service_role` e `runProposalScan`/`runEvaluation` scrivono col client admin. L'autorizzazione di quei percorsi vive SOLO nei guard delle Server Action (`runProposalScanAction`, `evaluateProposal`, `updateProposal`, `editComment`, `resolve/revokeCommentPromotion`): un guard dimenticato lì non viene più fermato a DB. Scelta owner (remediation SEC-9), ma alza il peso di questa entry.

### Quando diventa un problema
1. Quando cambia il modello dei ruoli (es. nuovi ruoli oltre admin/contributor).
2. Quando si aggiungono nuove azioni admin-gated copiando il pattern.

### Cosa fare se devi toccare quest'area
Estrarre `requireAdmin` in `src/lib` (es. accanto a `getProfile` in `profiles.ts`) e usarlo da entrambe le action e dalla route callback.

### Cronologia
- 2026-07-03 — Flaggato durante review chain di `integrationLLM` (finding [6], DRY). Deferito: duplicazione piccola, backstop DB presente.

## `2026-07-03-jwt1` JWT GitHub App e digest repo senza test

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/lib/github/app.ts](../../src/lib/github/app.ts) — `appJwt` (RS256 hand-rolled su node:crypto), token cache
- [src/lib/github/repoDigest.ts](../../src/lib/github/repoDigest.ts) — assemblaggio digest (troncamenti, base64, sezioni null-tolleranti)

### Il problema potenziale
Una regressione sottile nel JWT (claim window, base64url, firma) o nel digest emerge solo a runtime contro GitHub, come errore opaco tipo "GitHub: token installazione fallito (401)".

### Perché oggi non è un problema
Il seam è appena scritto e verificato a mano; la logica di scoring vera (`validateScores`, `computeRiceScore`) è coperta da unit test.

### Quando diventa un problema
1. Al primo refactor di `app.ts`/`repoDigest.ts` senza rete di sicurezza.
2. Se GitHub cambia i requisiti dei claim e serve toccare `appJwt`.

### Cosa fare se devi toccare quest'area
Esportare/testare `appJwt` (keypair RSA generata nel test, verifica firma con `crypto.verify`, assert su iat/exp/iss) e un test del formato digest con fetch mockata (troncamenti, README/package.json assenti).

### Cronologia
- 2026-07-03 — Flaggato durante review chain di `integrationLLM` (finding [7], testing). Deferito: plumbing di integrazione, non business logic.

## `2026-06-28-pr0x` Il matcher del proxy non esclude `/api`

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/proxy.ts:45-47](../../src/proxy.ts) — `matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]`

### Il problema potenziale
Il matcher non esclude `/api`. Se in futuro si aggiunge un Route Handler (`src/app/**/route.ts`), una richiesta non autenticata verso quell'endpoint riceve un redirect HTML 307 verso `/login` invece di un 401 JSON — contratto API sbagliato per un consumer programmatico.

### Perché oggi non è un problema
Esiste un solo Route Handler, `src/app/auth/callback/route.ts`, ma è un endpoint di redirect per browser sotto `/auth/callback` (non `/api`) ed è esplicitamente pubblico nel proxy: una GET non autenticata deve passare, e passa. Non esiste ancora nessun endpoint `/api` pensato per client programmatici, quindi il caso "redirect HTML invece di 401 JSON" non si verifica.

### Quando diventa un problema
1. Quando si aggiunge il primo `route.ts` sotto `src/app/api` (o comunque pensato per client non-browser) che, senza sessione, deve rispondere 401/403 JSON invece di un redirect.

### Cosa fare se devi toccare quest'area
Aggiungere `api|` al negative-lookahead, come da doc Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`):
```ts
matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
```
oppure escludere `/api` e autenticare dentro il handler restituendo un 401 JSON.

### Cronologia
- 2026-06-28 — Flaggato durante review Step 1 (auth OTP). Downgrade a NICE-TO-HAVE perché non esistono Route Handler oggi.
- 2026-06-28 — Revisione: arrivato il primo Route Handler (`/auth/callback`, magic link). Resta benigno perché è un redirect pubblico per browser, non un endpoint `/api`. Trigger aggiornato a "primo endpoint `/api` per client programmatici".

## `2026-06-28-lnk1` Link delle proposte salvati senza validazione URL

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/app/proposals/new/actions.ts](../../src/app/proposals/new/actions.ts) — parsing del campo `links`
- colonna `proposals.links` (`text[]`)

### Il problema potenziale
I link inseriti nel form vengono salvati verbatim (split per riga, trim, filter), senza validare schema o host. Diventano input non fidato persistito.

### Perché oggi non è un problema
I link vengono solo salvati: non sono ancora né renderizzati come `<a>` né fetchati. Nessuna superficie d'attacco attiva.

### Quando diventa un problema
1. Quando la valutazione AI (RICE, spec §4.3/§5) scarica il contenuto dei link e lo passa al prompt di Claude → SSRF (fetch verso URL interni/arbitrari) + prompt injection (contenuto malevolo iniettato nel prompt).
2. Quando i link vengono mostrati come `<a href>` cliccabili → rischio `javascript:`/`data:` URI se non sanificati.

### Cosa fare se devi toccare quest'area
Validare lo schema (solo `http`/`https`) e applicare un allow/deny sull'host prima del fetch; sanificare l'href in UI; per il fetch server-side usare timeout e blocco degli IP privati/loopback.

### Cronologia
- 2026-06-28 — Flaggato durante review Step 2 (form nuova proposta). Deferito: campo inerte finché non arriva la feature AI.
- 2026-07-02 — Trigger 2 (render come `<a href>`) mitigato in `step4ideaPanels`: `ProposalPanel` linka solo `http/https`, il resto è testo inerte (+ test di regressione). Resta aperto il trigger 1 (fetch lato AI: SSRF/prompt injection).
- 2026-07-08 — Superficie analoga in `ideaChecker` (RFC-006): il report dello scan duplicati (`dup_report`, prosa di Claude + URL delle fonti web) è reso da `ReportText` con la stessa mitigazione — linkifica solo `http/https`, il resto testo inerte (+ test di regressione). Lo scan NON fetcha i `links` della proposta: trigger 1 resta invariato.

## `2026-07-01-pgnl` `listProposals` senza limite/paginazione

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/lib/proposals.ts:30-33](../../src/lib/proposals.ts) — query sull'intera tabella senza `.limit()`/`.range()`
- [src/lib/proposals.ts](../../src/lib/proposals.ts) — `getProposalDetail`: embed `comments` e `status_history` senza `.limit()` (flaggato 2026-07-02, review `step4ideaPanels`)
- [src/lib/proposals.ts](../../src/lib/proposals.ts) — `listProposals` e `getProposalDetail`: nuovo embed `votes:rice_votes(...)` senza `.limit()` (flaggato 2026-07-05, review `riceForAllUsers`). Se i voti per proposta superassero il default limit di PostgREST, il voto composito (media Claude + utenti) e il ranking verrebbero calcolati su un sottoinsieme troncato — punteggio sbagliato, non solo lento.

### Il problema potenziale
La query è unbounded, ma PostgREST tronca di default a 1000 righe: superata quella soglia, le proposte oltre il limite spariscono silenziosamente dalla board — un bug di completezza mascherato, prima ancora che un problema di performance.

### Perché oggi non è un problema
Tool interno con dataset minuscolo (decine di proposte attese), lontano ordini di grandezza dal default limit.

### Quando diventa un problema
1. Quando il numero di proposte si avvicina al default limit di PostgREST (1000 righe).
2. Quando nasce la board con ordinamento per score / viste che richiedono il dataset completo.

### Cosa fare se devi toccare quest'area
Aggiungere paginazione esplicita (`.range()`) o un `.limit()` consapevole con indicatore "altre N proposte"; non implementarla prima (violerebbe `simplicity-no-overengineering.md`).

### Cronologia
- 2026-07-01 — Flaggato durante review completa del codebase (`Bugfixes001`). Deferito: dataset attuale minuscolo.

## `2026-07-05-58f8` `rice_votes` accetta componenti non interi (backstop DB più debole del service)

**Status:** non fissato — migration owner-locked, in attesa di review dell'owner.

### Dove
- [supabase/migrations/0015_rice_votes.sql:14-17](../../supabase/migrations/0015_rice_votes.sql) — colonne `numeric check (… between 1 and 10)`
- [src/lib/validation/vote.ts](../../src/lib/validation/vote.ts) — `parseVoteFields` impone `Number.isInteger`

### Il problema potenziale
Il service e lo slider trattano i componenti del voto come interi 1–10, ma il vincolo DB è `numeric between 1 and 10`: un insert diretto di `7.5` (bypassando la Server Action, es. client anon sotto RLS) supera il check. Non rompe la matematica di normalizzazione (tollera qualunque reale nel range), ma il DB accetta dati che l'app considera invalidi — service e backstop non concordano sul dominio.

### Perché oggi non è un problema
L'unico writer è `submitRiceVote`, che valida gli interi prima dell'insert; lo slider emette solo step interi. Nessun altro percorso scrive `rice_votes`.

### Quando diventa un problema
1. Se nasce un secondo writer (script di import, seed, altra action) che non passa da `parseVoteFields`.
2. Se si inizia a fare affidamento sull'integer-ness dei componenti a valle (es. istogrammi per valore discreto).

### Cosa fare se devi toccare quest'area
Stringere il dominio nella migration a `smallint not null check (… between 1 and 10)` per reach/impact/confidence/effort, così il vincolo DB rispecchia l'invariante del service. Owner-locked: proporlo a Riccardo, non modificare la migration già applicata (semmai una nuova migration).

### Cronologia
- 2026-07-05 — Flaggato durante review `riceForAllUsers` (Software Reviewer). Downgrade a NICE-TO-HAVE: unico writer valida gli interi, migration owner-locked.

## `2026-07-01-dber` `listProposals` inghiotte gli errori DB

**Status:** non fissato — rinviato dall'owner (review 2026-07-01, era IMPORTANT).

### Dove
- [src/lib/proposals.ts:45-46](../../src/lib/proposals.ts) — destruttura solo `data`, `error` mai letto
- [src/lib/proposals.ts](../../src/lib/proposals.ts) — `getProposalDetail`: stesso pattern, un errore DB transiente diventa `notFound()` nei due caller del dettaglio (flaggato 2026-07-02, review `step4ideaPanels`; risolvere insieme a `listProposals`)

### Il problema potenziale
Un errore di query (RLS, rete, migrazione mancante) restituisce `[]`: la home mostra "Nessuna proposta ancora" — un outage mascherato da empty state, senza log.

### Perché oggi non è un problema
Schema e RLS stabili, un solo ambiente, dataset piccolo: un errore di query oggi è improbabile e verrebbe notato subito a mano.

### Quando diventa un problema
1. Al primo deploy in produzione o alla prima modifica di schema/RLS: ogni regressione DB diventa silenziosa.

### Cosa fare se devi toccare quest'area
Destrutturare `error` e lanciarlo (`if (error) throw error;`), aggiungere `src/app/error.tsx`, estendere `fakeBuilder` in `proposals.test.ts` a risolvere `{ data, error }` + test del caso errore.

### Cronologia
- 2026-07-01 — Flaggato IMPORTANT durante review completa (`Bugfixes001`); l'owner ha scelto di rinviare il fix.

## `2026-07-01-ctrl` Class string dei controlli form duplicata in 4 punti

**Status:** ✅ risolto 2026-07-02 — branch `ideaAndEliminationArchitecture`: `controlClass` esportata da `Field.tsx` e riusata in login, `ProposalFilters` (2 punti) e nei bottoni di `DeleteProposalDialog`; la stringa letterale ora vive in un punto solo. Nessun form-kit, come prescritto.

### Dove
- [src/components/form/Field.tsx:10](../../src/components/form/Field.tsx) (`controlClass` privata) · `src/app/login/page.tsx:59` · `src/components/filters/ProposalFilters.tsx:29,45`

### Il problema potenziale
`rounded-md border border-border px-3 py-2` copiata in 4 punti su 3 file: ogni ritocco allo stile dei controlli va cacciato a mano, contro `dry-beyond-sx.md`.

### Perché oggi non è un problema
Solo un rischio di manutenzione, nessun impatto runtime.

### Quando diventa un problema
1. Al primo restyling dei controlli form (i 4 punti divergono silenziosamente).

### Cosa fare se devi toccare quest'area
`export const controlClass` da `Field.tsx` e riusarla nei 4 punti (in `ProposalFilters.tsx:29` concatenata con `w-full pr-9`). NON estendere `Field` per il login (è controlled di proposito) e non costruire un form-kit.

### Cronologia
- 2026-07-01 — Flaggato IMPORTANT durante review completa (`Bugfixes001`); l'owner ha scelto di rinviare il fix.

## `2026-07-01-font` Font Geist caricati ma mai renderizzati

**Status:** ✅ risolto 2026-09-07 — branch `graphicDesign`: redesign brutalista, `body { font-family: var(--font-sans) }` e font sostituiti (Archivo variabile / IBM Plex Sans / IBM Plex Mono via `next/font/google`); Geist rimosso.

### Dove
- [src/app/globals.css:29-33](../../src/app/globals.css) — `body { font-family: Arial, ... }` scavalca `--font-sans`
- [src/app/layout.tsx:5-13](../../src/app/layout.tsx) — caricamento Geist/Geist Mono via `next/font`

### Il problema potenziale / fix
Residuo del template: Geist viene scaricato a ogni visita e mai usato. Fix da una riga: `body { font-family: var(--font-sans); }` — oppure rimuovere il caricamento se Arial è voluto.

### Cronologia
- 2026-07-01 — Flaggato NICE-TO-HAVE durante review completa (`Bugfixes001`).

## `2026-07-01-lbls` Valori enum grezzi mostrati in UI + `status` tipizzato `string`

**Status:** ✅ risolto 2026-07-02 — branch `mainBoardlayoutfromADR0002`: introdotta `STATUS_LABELS` in `src/lib/board.ts` (usata da board e `ProposalFilters`), `ProposalListItem.status` tipizzato `ProposalStatus`; il badge grezzo in `ProposalCard` è stato rimosso (lo stato è la colonna).

### Dove
- [src/components/cards/ProposalCard.tsx:10](../../src/components/cards/ProposalCard.tsx) e `src/components/filters/ProposalFilters.tsx:48-52` — stampano il valore DB verbatim ("in_valutazione")
- [src/lib/proposals.ts:15](../../src/lib/proposals.ts) — `status: string` invece di `ProposalStatus`

### Il problema potenziale
UI accoppiata al nome fisico dell'enum e narrowing perso. La rinomina pianificata `parcheggiata→archiviata` (owner-locked) oggi cambierebbe migration e testo utente in un colpo solo, senza seam.

### Quando diventa un problema
1. Alla rinomina `parcheggiata→archiviata` — conviene introdurre prima la label map, che diventa il seam.

### Cosa fare se devi toccare quest'area
`Record<ProposalStatus, string>` con etichette leggibili accanto a `PROPOSAL_STATUSES` in `src/lib/proposals.ts`, usata nei due punti; `status: ProposalStatus;` nel tipo di riga. Niente componente Badge finché non serve altrove.

### Cronologia
- 2026-07-01 — Flaggato NICE-TO-HAVE durante review completa (`Bugfixes001`).

## `2026-07-02-1d20` `updateProposalStatus`: update + history non atomici, `from_status` da lettura stale

**Status:** ✅ risolto 2026-07-02 — branch `ideaAndEliminationArchitecture`: la RPC `move_proposal` (migration `0005`) esegue update + insert history in un'unica transazione, con compare-and-set su `from_status` (la mossa stale fallisce e la UI invita a ricaricare). Vedi rettifica ADR-0002.

### Dove
- [src/app/proposals/actions.ts](../../src/app/proposals/actions.ts) — lettura di `status`, poi `update`, poi insert in `status_history` (commento `ponytail:` in loco)

### Il problema potenziale
Due problemi della stessa famiglia: (1) se l'insert in `status_history` fallisce dopo l'update riuscito, lo stato è cambiato ma la transizione non è registrata (oggi: `console.error` e si prosegue); (2) due admin che spostano la stessa card in concorrenza possono leggere lo stesso `from_status` e registrare una catena di transizioni incoerente.

### Perché oggi non è un problema
Un solo admin attivo: né history-failure sistematica né mosse concorrenti. La history non alimenta ancora nessuna feature.

### Quando diventa un problema
1. Quando ci saranno più admin che triagiano insieme la board.
2. Quando `status_history` alimenterà audit/analytics/vista cronologia (Step 4, spec §4.4/§4.5).

### Cosa fare se devi toccare quest'area
Due fix candidati: compare-and-set senza migration (`.update({status: toStatus}).eq("id", id).eq("status", from)` + gestire zero righe aggiornate) per il caso stale-read; oppure una RPC Postgres che fa update+insert in transazione (migration → owner-locked) che risolve entrambi.

### Cronologia
- 2026-07-02 — Flaggato durante review chain della board (`mainBoardlayoutfromADR0002`), finding [3]; il `Review Reviewer` ha confermato la race e indicato il CAS come mitigazione senza migration.

## `2026-07-01-alog` Errore Supabase non loggato in `createProposal`

**Status:** ✅ risolto 2026-07-08 — branch `ideaChecker`: aggiunto `console.error("createProposal:", error)` prima del return generico (il refactor per il redirect al dettaglio, RFC-006, toccava la stessa riga).

### Dove
- [src/app/proposals/new/actions.ts:40](../../src/app/proposals/new/actions.ts)

### Il problema potenziale / fix
Il messaggio generico all'utente è giusto (niente leak), ma l'errore reale scompare: un fallimento RLS/schema in produzione è indiagnosticabile. Fix da una riga: `console.error("createProposal:", error);` prima del return.

### Cronologia
- 2026-07-01 — Flaggato NICE-TO-HAVE durante review completa (`Bugfixes001`).

## `2026-07-08-strd` Scan duplicati strandabile `in_corso` se la proposta esce da 'nuova' a metà scan

**Status:** ✅ risolto 2026-09-05 — migration 0020: `fail_dup_scan`/`apply_dup_scan` girano come `service_role` senza condizione di stato (SEC-9), quindi il marker di fallimento viene sempre scritto anche se la proposta è uscita da 'nuova' a metà scan.

### Dove
- [src/lib/ai/runProposalScan.ts](../../src/lib/ai/runProposalScan.ts) — catch: l'errore di `fail_dup_scan` è solo loggato
- `supabase/migrations/0017_duplicate_scan.sql` — `can_run_dup_scan` richiede `status = 'nuova'` per i non-admin

### Il problema potenziale
Mentre uno scan lanciato dal proposer è in volo, un altro membro può spostare la proposta (non flaggata) fuori da 'nuova'. A quel punto `apply_dup_scan`/`fail_dup_scan` falliscono l'autorizzazione per il proposer e `dup_scan_status` resta `in_corso` per sempre; fuori da 'nuova' il pannello non mostra il Rilancia (`canScan` è false) e `runProposalScan` è comunque no-op.

### Perché oggi non è un problema
Race a bassissima probabilità (finestra di secondi, team piccolo) e con recovery in-app: si riporta la proposta in 'nuova' (le mosse sono libere) e si usa "Rilancia scansione" con force — pattern degli scan orfani (0011). L'errore è loggato (`runProposalScan fail_dup_scan:`).

### Quando diventa un problema
1. Se il volume di proposte/membri rende la race frequente.
2. Se il rientro in 'nuova' viene mai vincolato (il recovery path sparirebbe).

### Cosa fare se devi toccare quest'area
Allargare l'autorizzazione di `fail_dup_scan` a proposer-or-admin senza la condizione di stato (scrive solo un marker di fallimento) — nuova migration, owner-locked.

### Cronologia
- 2026-07-08 — Flaggato durante review chain di `ideaChecker` (finding [6]; il Review Reviewer ha corretto il recovery path: move back + Rilancia, non il Rilancia diretto).

## `2026-07-08-scnl` Tetto di latenza dello scan duplicati nella Server Action

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/lib/ai/runProposalScan.ts](../../src/lib/ai/runProposalScan.ts) — `Promise.all(judge locale 60s, ricerca web 120s × fino a 3 chiamate)`
- [src/lib/ai/scanProposal.ts](../../src/lib/ai/scanProposal.ts) — `MAX_CONTINUATIONS = 2`, `max_uses: 3`, retry SDK ×2 su 429/5xx
- [src/app/proposals/[id]/actions.ts](../../src/app/proposals/[id]/actions.ts) — `updateProposal` in 'nuova' attende l'intero re-scan nel round-trip del save

### Il problema potenziale
Il tetto teorico (timeout × continuazioni × retry) supera il `maxDuration` tipico delle piattaforme serverless: una function uccisa a metà lascia lo scan `in_corso` (recuperabile col Rilancia force, pattern 0011) e il save di un edit in 'nuova' può restare bloccato minuti. NON convertire il re-scan in fire-and-forget dentro la Server Action: il lavoro non atteso viene congelato/killato dopo la risposta su serverless e CAUSEREBBE lo stranding (vedi `2026-07-08-strd`), non lo eviterebbe.

### Perché oggi non è un problema
Nessun deploy in produzione; in locale non c'è `maxDuration`. Il caso realistico (1–2 ricerche web) chiude in decine di secondi; `MAX_CONTINUATIONS` è già stato abbassato a 2 in review.

### Quando diventa un problema
1. Al primo deploy su piattaforma serverless: verificare `maxDuration` della route rispetto al tetto realistico dello scan.

### Cosa fare se devi toccare quest'area
Impostare `maxDuration` adeguato sulla route (o un deadline complessivo ~90s che rotta su `fail_dup_scan`); solo se il blocco del save diventa un problema reale, spostare lo scan su un canale che sopravvive alla risposta (queue/cron), non un fire-and-forget in-action.

### Cronologia
- 2026-07-08 — Flaggato durante review chain di `ideaChecker` (finding [7]). Downgrade a NICE-TO-HAVE: nessun deploy, tetto realistico contenuto.

## `2026-07-10-6623` Messaggi d'errore GitHub user-visible fuori dal catalogo stringhe

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/lib/github/app.ts](../../src/lib/github/app.ts) — `throw new Error("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY non configurate")`, `"GitHub: token installazione fallito (…)"`, `"GitHub: lista repo fallita (…)"`
- [src/lib/github/repoDigest.ts](../../src/lib/github/repoDigest.ts) — `"GitHub: repo … non raggiungibile"`
- [src/lib/ai/runEvaluation.ts](../../src/lib/ai/runEvaluation.ts) — fallback `"errore sconosciuto"` nel catch

### Il problema potenziale
Questi messaggi non sono solo log: `runEvaluation` li cattura, li persiste via `fail_ai_evaluation` e `ProposalPanel` li rende all'utente tramite `ai_eval_error`. Sono copy user-facing in italiano fuori da `src/lib/strings.ts`, incoerenti con `STRINGS.github.notConnected` che vive nel catalogo sullo stesso code path.

### Perché oggi non è un problema
Esiste una sola lingua (IT): il testo mostrato è comunque corretto. Nessun impatto runtime.

### Quando diventa un problema
1. Al primo catalogo di una seconda lingua: i banner di fallimento eval mostrerebbero testo misto (catalogo tradotto + errori GitHub in italiano).

### Cosa fare se devi toccare quest'area
Spostare i quattro messaggi (+ `"errore sconosciuto"`) in `STRINGS.github` / `STRINGS.errors`, come già fatto per `notConnected`. Micro follow-up, nessuna nuova astrazione.

### Cronologia
- 2026-07-10 — Flaggato durante review chain di `stringsRefactor` (finding [3], confermato dal Review Reviewer come NICE-TO-HAVE da deferire: i file non erano nel changed set della PR).

---

## `2026-09-07-98a4` Progetto senza admin per race su `delete_account` (e su demote incrociato)

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [supabase/migrations/0024_delete_account.sql](../../supabase/migrations/0024_delete_account.sql) — il check "unico admin di un progetto con altri membri" e il `delete from project_members` sono statement separati, READ COMMITTED, senza `for update`
- [src/app/projects/actions.ts](../../src/app/projects/actions.ts) — `setMemberRole`/`removeMember` vietano solo l'auto-demote/auto-rimozione (policy `admin update others` / `admin delete others`, 0021): due admin possono demotarsi a vicenda in parallelo

### Il problema potenziale
Due co-admin dello stesso progetto che eliminano l'account nello stesso istante passano entrambi il check e il progetto resta con membri ma senza admin: nessuno può più invitare, promuovere, collegare GitHub o eliminarlo. Stessa finestra se un admin viene demotato mentre l'altro si elimina. Il demote incrociato concorrente produce oggi lo stesso stato anche senza `delete_account`.

### Perché oggi non è un problema
Team piccolo, finestra di pochi millisecondi, operazioni rare. Recovery solo via SQL manuale (promuovere un membro in `project_members`).

### Quando diventa un problema
1. Progetti con molti admin e churn di account.
2. Un'automazione che elimina account o cambia ruoli in batch.

### Cosa fare se devi toccare quest'area
In testa a `delete_account`, prima del check, bloccare le membership dei progetti coinvolti: `perform 1 from public.project_members where project_id in (select project_id from public.project_members where user_id = uid) for update;` — lock di riga mirati, niente lock di tabella. Per il demote incrociato: stesso `for update` in una RPC `set_member_role` con check "resta almeno un admin", o accettare lo stato e aggiungere un recovery in-app. Path owner-locked (`supabase/migrations/`).

### Cronologia
- 2026-09-07 — Flaggato durante review chain di `lastFixes` (finding [3], Software Reviewer). Downgrade a NICE-TO-HAVE dal Review Reviewer: race a probabilità trascurabile, coerente con lo stile dei guard esistenti (che già ammettono il demote incrociato), migration owner-locked.

---

## Risolti recenti

_Nessuna voce risolta._
