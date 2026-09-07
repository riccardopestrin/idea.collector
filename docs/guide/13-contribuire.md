# 13. Contribuire

Questo repo ha un set di **regole esplicite** in
[`.claude/rules/`](../../.claude/rules/) che valgono sia per gli umani sia per gli
agenti. Non sono decorative: la review le applica. Questo capitolo le riassume e
le mette in sequenza.

## 13.1 I principi

- **Semplicità, no overengineering** — il codice più semplice che soddisfa il
  requisito *reale e presente*. Niente astrazioni/parametri/branch speculativi.
  Prima di aggiungere qualcosa: "esiste un chiamante reale che ne ha bisogno
  *adesso*?". Se no, non si aggiunge.
  [`simplicity-no-overengineering.md`](../../.claude/rules/simplicity-no-overengineering.md).
- **DRY oltre lo styling** — niente JSX/logica/class-string duplicati; si estrae
  in `src/components`, `src/lib/hooks`, `src/lib/utils`, o token in
  `src/lib/tokens.ts`. [`dry-beyond-sx.md`](../../.claude/rules/dry-beyond-sx.md).
- **Architettura a livelli** — ogni concern nel suo layer, autorizzazione nel
  service **e** in RLS ([capitolo 4](04-architettura.md)).
  [`layered-architecture.md`](../../.claude/rules/layered-architecture.md),
  [`defend-separation-of-concerns.md`](../../.claude/rules/defend-separation-of-concerns.md).
- **Naming coerente coi vicini** — un nuovo file/simbolo/test segue la convenzione
  dei fratelli. [`naming-consistency.md`](../../.claude/rules/naming-consistency.md).
- **Next 16 non è quella che ricordi** — leggi
  `node_modules/next/dist/docs/` prima di scrivere ([`AGENTS.md`](../../AGENTS.md)).
- **`pnpm`, mai `npm`** ([`package-manager.md`](../../.claude/rules/package-manager.md)).
- **Sicurezza dell'host** — non modificare nulla fuori dal progetto, non leggere
  `.env.local`. [`host-machine-safety.md`](../../.claude/rules/host-machine-safety.md).

## 13.2 Chi può cambiare cosa (change-control)

Da [`change-control.md`](../../.claude/rules/change-control.md). Owner: Riccardo
(`@riccardopestrin`).

- `main` è protetto: **niente push diretto, niente force-push**, ogni cambiamento
  via PR, merge con review dell'owner e CI verde.
- **Path owner-only** (PR ok, merge solo con review owner): tutta `/.claude/`,
  `/docs/architecture/adr/`, `/supabase/migrations/`.
- **Aperto a tutti**: aprire PR/branch, scrivere codice e test, dichiarare
  incidenti.
- **Deploy: solo owner** ([capitolo 12](12-deploy.md)).
- **Mai fare il commit al posto dell'owner**: il commit lo fa Riccardo.

## 13.3 Quando serve una ADR o una RFC

Da [`adr-when-to-write.md`](../../.claude/rules/adr-when-to-write.md): serve una
**ADR** *prima* di implementare un cambiamento che attraversa un confine
architetturale (nuova dipendenza con lock-in, cambio del modello auth/dati, cambio
del provider AI, cambio del modello di deploy). Le ADR sono **autorate e accettate
solo dall'owner**: se non sei owner, non aprire una ADR — proponi la decisione
all'owner. Le [RFC](../architecture/rfc/) sono le proposte di design da cui nascono
le ADR.

## 13.4 La sequenza di fine task

Questa è la pipeline canonica dopo aver scritto/modificato codice sotto `src/` o
`supabase/migrations/` (regole [`code-review.md`](../../.claude/rules/code-review.md)
e correlate):

1. **Scrivi/modifica** il codice.
2. **Test** — `pnpm test` + `pnpm exec eslint src/` ([capitolo 11](11-testing.md)).
3. **Leggi** [`docs/security/be-careful.md`](../security/be-careful.md) e segnala
   se la modifica tocca un issue deferito (potrebbe risvegliarlo).
4. **Review chain** — `Software Reviewer` → `Review Reviewer` → correggi i
   BLOCKER/IMPORTANT confermati → ri-lancia i test. (Scorciatoia: lo skill
   `/review-chain`.)
5. **Auto-defer NICE-TO-HAVE** → nuova voce in
   [`docs/security/be-careful.md`](../security/be-careful.md) con id
   `YYYY-MM-DD-XXXX` ([`nice-to-have-to-be-careful.md`](../../.claude/rules/nice-to-have-to-be-careful.md)).
   Non si chiede all'utente: si deferisce di default.
6. **Auto-defer accessibilità** → voce `[A11Y-NN]` in
   [`docs/roadmap/accessibility.md`](../roadmap/accessibility.md)
   ([`accessibility-findings-to-roadmap.md`](../../.claude/rules/accessibility-findings-to-roadmap.md)).
7. **Security Expert** — aggiorna [`docs/security/`](../security/README.md) se
   trova/risolve issue; avvisa in chat se c'è un HIGH
   ([`security-review.md`](../../.claude/rules/security-review.md)).
8. **Riepilogo finale** all'utente con i conteggi test e le voci deferite.

Anche il **dead-code check** (pre e post feature) fa parte del flusso
([`dead-code-check.md`](../../.claude/rules/dead-code-check.md)).

## 13.5 I registri di sicurezza

- [`docs/security/README.md`](../security/README.md) — classi di vulnerabilità +
  finding aperti (solo azionabile).
- [`docs/security/issues.md`](../security/issues.md) — issue per severità; gli
  HIGH aperti bloccano la produzione e vengono segnalati a inizio conversazione.
- [`docs/security/be-careful.md`](../security/be-careful.md) — il registro
  durevole dei problemi noti e consciamente deferiti.

L'header `**Last updated:**` di questi file è **una riga sola** (una data), gli id
degli issue **non si rinumerano mai**.

## 13.6 Riferimenti rapidi

- Architettura → [capitolo 4](04-architettura.md)
- Modello dati e RLS → [capitolo 5](05-modello-dati.md)
- ADR → [`docs/architecture/adr/`](../architecture/adr/README.md)
- RFC → [`docs/architecture/rfc/`](../architecture/rfc/)
- Design language → [`docs/design/design-language.html`](../design/design-language.html)

---

Precedente: [← 12. Deploy](12-deploy.md) · Prossimo: [14. Design language →](14-design-language.md)
