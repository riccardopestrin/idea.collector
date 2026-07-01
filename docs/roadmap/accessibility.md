**Last updated:** 2026-07-01

# Accessibility

Registro durevole delle issue di accessibilità rinviate. Le finding a11y sollevate da `Software Reviewer` / `Review Reviewer` vengono rinviate qui di default (non corrette nella stessa sessione) — vedi [`.claude/rules/accessibility-findings-to-roadmap.md`](../../.claude/rules/accessibility-findings-to-roadmap.md).

Ogni voce ha un ID stabile `[A11Y-NN]`. **Gli ID non vengono mai riusati**: quando una issue è risolta, la voce si sposta in "Issue risolti" mantenendo lo stesso ID.

## Issue aperti

### [A11Y-01] `<html lang="en">` ma tutta la UI è in italiano

**Status:** non fissato — flaggato il 2026-07-01 durante review dell'intero codebase (branch `Bugfixes001`).

#### Dove
- `src/app/layout.tsx:27`

#### Cosa c'è di sbagliato
Il root layout dichiara `lang="en"` mentre tutto il testo utente (titoli, label, messaggi `role="status"`/`role="alert"`) è in italiano.

#### Impatto user-visible
Gli screen reader pronunciano l'italiano con fonetica inglese: i messaggi di stato ed errore risultano quasi incomprensibili per gli utenti di AT. Impatto alto, fix banale.

#### Fix raccomandato
Cambiare in `lang="it"` in `src/app/layout.tsx`.

#### Cronologia
- 2026-07-01 — Flaggato durante review completa del codebase (`Bugfixes001`).

### [A11Y-02] Hit target del bottone "×" (cancella ricerca) sotto la soglia touch

**Status:** non fissato — flaggato il 2026-07-01 durante review dell'intero codebase (branch `Bugfixes001`).

#### Dove
- `src/components/filters/ProposalFilters.tsx:32-39`

#### Cosa c'è di sbagliato
Il bottone di cancellazione della ricerca è un glifo `×` `text-lg leading-none` senza padding né dimensione minima: target effettivo ~18×18 px, contro i 44 px raccomandati per il touch. L'`aria-label` è presente e corretto; il problema è solo dimensionale.

#### Impatto user-visible
Utenti touch e utenti con motricità ridotta faticano a centrare il bottone. Severità media.

#### Fix raccomandato
Portare l'area cliccabile ad almeno 44 px mantenendo il glifo centrato (es. `flex h-11 w-11 items-center justify-center` ricalibrando l'offset assoluto, oppure padding + margine negativo).

#### Cronologia
- 2026-07-01 — Flaggato durante review completa del codebase (`Bugfixes001`).

## Issue risolti

_Nessuna issue risolta._
