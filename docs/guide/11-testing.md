# 11. Testing

La stabilità è vincolante per la V1. Lo stack è **Vitest + React Testing
Library** (unit/component) e **pgTAP** (RLS). Il **test E2E (Playwright) è
rimandato**: non è configurato, non scriverlo né dichiararlo eseguito.

## 11.1 Cosa lanciare

Dalla radice del repo:

```bash
pnpm test                 # unit + component (Vitest), one-shot
pnpm test:watch           # Vitest in watch
pnpm exec eslint src/     # lint
pnpm exec supabase test db     # test RLS pgTAP (richiede stack locale attivo)
pnpm test:integration     # scenario full-stack su RLS/RPC reali (stack locale)
```

**Regola: dopo ogni modifica sotto `src/` o `supabase/migrations/`** si lanciano
`pnpm test` e `pnpm exec eslint src/` prima di considerare finito il lavoro. Gli
unit/component devono essere **100% verdi**; ESLint senza errori sui file
toccati. Vedi [`.claude/rules/run-tests-after-changes.md`](../../.claude/rules/run-tests-after-changes.md).

Si può saltare solo per: modifiche a sola documentazione, a `.claude/`, o a file
di test che non toccano codice di produzione.

## 11.2 I livelli di test

**Unit** — logica pura: scoring RICE (`proposals.test.ts`), validazione voto/
proposta, board/transizioni (`board.test.ts`), ancoraggio
(`anchors.test.ts`, `anchoring.test.ts`, `anchorProjection.test.ts`), AI
(`evaluateProposal.test.ts`, `scanProposal.test.ts`, …), GitHub `gitRef`,
ClickUp `taskUrl`. Copertura richiesta ≥ 80% sulla logica di business.

**Component / flow** — React Testing Library: si asserisce su testo, ruoli e
*esiti* delle interazioni, non sul semplice "renderizza". Es. `Board.test.tsx`,
`ProposalCard.test.tsx`, i form, `CommentsSidebar.test.tsx`.

**Route/action** — es. `auth/callback/route.test.ts`, `profile/actions.test.ts`,
`projects/actions.test.ts`, `proposals/**/actions.test.ts`, `proxy.test.ts`.

**RLS (pgTAP)** — [`supabase/tests/`](../../supabase/tests/): la sicurezza
enforced dal DB, testata sul DB. Coprono policy base, colonne privilegiate,
move/delete, commenti, poteri admin/service-role, isolamento progetti/membership,
delete account, sync email.

**Integrazione** — [`tests/integration/`](../../tests/integration/): scenario
full-stack (proposta → contributo → voti) su RLS/RPC **reali**. Richiede lo stack
locale; se le chiavi non sono in `.env`, le legge da `supabase status`. **Rifiuta
URL non locali** perché crea e cancella utenti veri (`*@test.local`). Config in
[`vitest.integration.config.ts`](../../vitest.integration.config.ts).

## 11.3 Cosa NON è un test valido

Da [`.claude/rules/test-audit.md`](../../.claude/rules/test-audit.md): ogni `it()`
deve fallire se il componente ha un bug reale. Sono inutili (da eliminare o
riscrivere): assert banalmente veri, "renderizza senza crashare" senza
asserzioni, check su heading hardcoded di pagine stub, esistenza DOM senza
verificarne testo/ruolo/attributi, duplicati di un altro test.

**Nessun test è meglio di un test finto.** Un componente presentazionale
one-liner senza logica non va testato.

## 11.4 Non si saltano i test

Da [`.claude/rules/no-skipping-tests.md`](../../.claude/rules/no-skipping-tests.md):

- Mai `it.skip`/`xit`/commentare un test/`return` in cima per far passare la
  build. Un test flaky si rilancia isolato e si sistema o si mette in quarantena
  **con una traccia scritta**, mai con uno `.skip` muto.
- Mai `[skip ci]` su commit di una PR verso `main`.
- Il gate CI si bypassa **solo in emergenza produzione-down dichiarata**, e con
  una nota d'incidente scritta. Il bypass lo fa solo l'owner.

## 11.5 Convenzioni di naming dei test

Da [`.claude/rules/naming-consistency.md`](../../.claude/rules/naming-consistency.md):
un `describe()` nomina il simbolo sotto test (`describe("computeRiceScore")`); una
foglia `it()`/`test()` è una **frase leggibile** che completa "it …"
(`it("returns 0 when reach is zero")`), non un identificatore camelCase senza
spazi. Prima di nominare, guarda i test vicini e conforma.

## 11.6 Report atteso nel riepilogo

Chiudi un task riportando i conteggi esatti, es:

> Unit: 142/142 ✅ · ESLint: clean

---

Precedente: [← 10. Editor e commenti](10-editor-commenti.md) · Prossimo: [12. Deploy →](12-deploy.md)
