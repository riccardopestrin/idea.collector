# 9. AI e integrazioni

Tutto il codice AI vive in [`src/lib/ai/`](../../src/lib/ai/); le integrazioni
esterne in [`src/lib/github/`](../../src/lib/github/). Le decisioni sono
[ADR-0003](../architecture/adr/0003-anthropic-ai-scoring-provider.md) (provider),
[ADR-0004](../architecture/adr/0004-github-app-repo-context.md) (GitHub),
[ADR-0007](../architecture/adr/0007-duplicate-scan-llm-judge-web-search.md) (scan)
e [ADR-0008](../architecture/adr/0008-service-role-writes-for-ai-verdicts.md)
(scritture service-role).

## 9.1 Il client Anthropic

[`anthropic.ts`](../../src/lib/ai/anthropic.ts) è l'**unico** punto che legge
`ANTHROPIC_API_KEY` (solo server). Modello: `claude-opus-4-8` (`AI_MODEL`).
Helper `assertCompleted` (gestisce `refusal`/`max_tokens`) e `completedText`.

## 9.2 Valutazione RICE-10 di una proposta

[`evaluateProposal.ts`](../../src/lib/ai/evaluateProposal.ts) chiede a Claude i
quattro fattori 1–10 + `rationale` in **una** chiamata Messages API:

- **Structured output** (`output_config` json_schema), `thinking: adaptive`,
  `max_tokens 16k`.
- **Prompt caching**: il *digest* della repo è il prefisso stabile con
  `cache_control ephemeral ttl 1h`; la proposta è il suffisso volatile → le
  valutazioni successive sulla stessa repo pagano meno.
- **`validateScores`** clampa/arrotonda (lo schema non esprime range/interezza) e
  tronca il rationale a 2000 char.
- **Anti prompt-injection**: il contenuto in `<contesto_repository>` e
  `<proposta>` è marcato come non fidato.
- I **contributi** (commenti promossi, `promotion_status='accepted'`) fanno parte
  dell'input.

## 9.3 Orchestrazione della valutazione

[`runEvaluation.ts`](../../src/lib/ai/runEvaluation.ts) gira **dopo**
l'autorizzazione della Server Action (admin):

- **Idempotenza**: salta se `ai_generated && !manually_edited`, salvo `force`.
- **Guard in-flight** via RPC `begin/apply/fail_ai_evaluation` (una sola
  valutazione concorrente per proposta; `p_force` recupera scan orfani da crash).
- Costruisce il digest con `buildRepoDigest`.
- **Fallimento mai bloccante**: in errore marca la riga `fallita`, l'app continua.
- **Persistenza col client service-role** ([`admin.ts`](../../src/lib/supabase/admin.ts)):
  nessun utente può forgiare gli esiti via PostgREST.

## 9.4 Scan anti-duplicato e competitor

[`scanProposal.ts`](../../src/lib/ai/scanProposal.ts) fa **due** chiamate Claude
separate, eseguite in parallelo da
[`runProposalScan.ts`](../../src/lib/ai/runProposalScan.ts):

1. **Judge di similarità locale** — structured output sulle idee candidate della
   stessa board (cap 100). Restituisce `similarity` 0–100 e un `matchId` validato
   contro l'insieme reale. Soglia **`DUP_SIMILARITY_THRESHOLD = 85`**: sopra, la
   proposta è `dup_flagged` e **non esce da `nuova`**.
2. **Ricerca competitor sul web** — server tool `web_search` (gestione
   `pause_turn`, max 2 continuazioni), estrae prosa + fonti citate reali.

`buildScanReport` unisce i due paragrafi in `dup_report`. Lo scan parte quando la
proposta è `nuova`, è idempotente, e persiste col service-role via
`begin/apply/fail_dup_scan`. Il link e l'autore del match sono resi **dai dati**,
mai dal testo di Claude (anti-injection).

## 9.5 Gli stub FAKE (demo senza crediti)

Per far girare l'app senza chiave/crediti Anthropic:

- `AI_EVAL_FAKE=1` → `stubScores()`: punteggi fissi. (Il digest GitHub viene
  comunque costruito, così la pipeline reale è esercitata.)
- `AI_SCAN_FAKE=1` → `stubScan()`: report fittizio, nessun match.

Sono marcati `// ponytail:` come temporanei: si tolgono quando l'API è operativa.

## 9.6 Integrazione GitHub (contesto repo)

[`app.ts`](../../src/lib/github/app.ts) implementa la GitHub App con solo
`node:crypto`:

- `appJwt()` firma un JWT RS256 (`GITHUB_APP_ID` + private key, validità 9 min,
  `iat -60s` per il clock drift).
- `installationToken()` scambia il JWT per un installation token (~1h, **cache
  in-memory**). Nessun token longevo persistito.
- `listInstallationRepos()` elenca le repo autorizzate (picker).

[`repoDigest.ts`](../../src/lib/github/repoDigest.ts) → `buildRepoDigest` produce
un **digest deterministico** (meta, languages, README troncato, tree ≤ 400 path,
ultimi 20 commit, package.json) con cache server-side 10 min. Essendo stabile, è
il prefisso cacheabile lato Claude (§9.2).

[`settings.ts`](../../src/lib/github/settings.ts) è il data layer delle colonne
`github_*` di `projects`: lettura via RLS, **scrittura solo service-role**
(autorizzazione a carico del chiamante). Il collegamento della repo passa dal
callback OAuth ([capitolo 6](06-autenticazione.md)).

## 9.7 Integrazione ClickUp

Più leggera: una proposta può portare un `task_url` che punta a un task ClickUp
(`setTaskUrl`, [`proposals/[id]/actions.ts`](../../src/app/proposals/[id]/actions.ts)).
Il DB accetta solo URL `https://app.clickup.com/…` (≤ 500 char, migration 0026).
Helper in [`src/lib/clickup/taskUrl.ts`](../../src/lib/clickup/taskUrl.ts).

---

Precedente: [← 8. Scoring RICE-10](08-scoring-rice10.md) · Prossimo: [10. Editor e commenti →](10-editor-commenti.md)
