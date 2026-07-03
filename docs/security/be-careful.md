**Last updated:** 2026-07-03

# Be Careful — issue note consapevolmente rinviate

Registro durevole delle NICE-TO-HAVE consapevolmente rinviate: problemi che **non** si verificano nell'attuale use case ma che possono "svegliarsi" se un'assunzione cambia. Vedi [`.claude/rules/nice-to-have-to-be-careful.md`](../../.claude/rules/nice-to-have-to-be-careful.md) per il flusso.

Ogni voce ha un ID stabile nel formato `YYYY-MM-DD-XXXX` (data del flag + 4 char di hash). **Gli ID non vengono mai riusati, rinumerati o riscritti**, nemmeno dopo la risoluzione.

---

## `2026-07-03-adm1` Guard admin duplicato in azioni e route

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/app/profile/actions.ts](../../src/app/profile/actions.ts) — helper `requireAdmin()` privato del modulo
- [src/app/proposals/actions.ts](../../src/app/proposals/actions.ts) — `evaluateProposal`: stesso guard inline (getUser + getProfile role)
- [src/app/auth/github/callback/route.ts](../../src/app/auth/github/callback/route.ts) — terza variante inline

### Il problema potenziale
La forma auth-resolve + role-check è ripetuta in 3+ punti: una futura modifica all'autorizzazione va applicata ovunque, e un punto dimenticato è un bug di sicurezza (mitigato dal backstop RLS/RPC a DB).

### Perché oggi non è un problema
Ogni call site fa il guard correttamente e il DB (RPC admin-only + RLS) rifiuta comunque le scritture non autorizzate.

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

## `2026-07-01-pgnl` `listProposals` senza limite/paginazione

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/lib/proposals.ts:30-33](../../src/lib/proposals.ts) — query sull'intera tabella senza `.limit()`/`.range()`
- [src/lib/proposals.ts](../../src/lib/proposals.ts) — `getProposalDetail`: embed `comments` e `status_history` senza `.limit()` (flaggato 2026-07-02, review `step4ideaPanels`)

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

**Status:** non fissato — non si verifica nell'attuale use case (solo spreco di byte).

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

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/app/proposals/new/actions.ts:40](../../src/app/proposals/new/actions.ts)

### Il problema potenziale / fix
Il messaggio generico all'utente è giusto (niente leak), ma l'errore reale scompare: un fallimento RLS/schema in produzione è indiagnosticabile. Fix da una riga: `console.error("createProposal:", error);` prima del return.

### Cronologia
- 2026-07-01 — Flaggato NICE-TO-HAVE durante review completa (`Bugfixes001`).

---

## Risolti recenti

_Nessuna voce risolta._
