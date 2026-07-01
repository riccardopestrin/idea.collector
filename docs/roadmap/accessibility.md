**Last updated:** 2026-07-02

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

### [A11Y-03] Drag da tastiera della board impraticabile (25px per pressione)

**Status:** non fissato — flaggato il 2026-07-02 durante review della PR `mainBoardlayoutfromADR0002`.

#### Dove
- `src/components/board/Board.tsx:38` (`useSensor(KeyboardSensor)` senza `coordinateGetter`)
- `src/lib/tokens.ts` (`BOARD_COLUMN_WIDTH = "w-80"`, `BOARD_GAP = "gap-6"`)

#### Cosa c'è di sbagliato
Il `KeyboardSensor` usa il coordinate getter di default di dnd-kit: 25px per pressione di freccia. Con colonne da 320px + gap 24px servono ~14 pressioni per attraversare una colonna, senza snapping sui droppable. Il drag da tastiera esiste (le card sono focusabili, `role="button"`, Space per prendere/rilasciare) ma è di fatto inutilizzabile su una board a 7 colonne.

#### Impatto user-visible
Gli admin che usano solo la tastiera non riescono realisticamente a spostare le proposte — l'interazione principale della pagina. Severità alta per utenti keyboard-only.

#### Fix raccomandato
`coordinateGetter` custom che salta tra i centri delle colonne (supportato da `@dnd-kit/core`, non serve `@dnd-kit/sortable`), oppure fallback non-drag (menu/`<select>` "Sposta in →" che chiama la stessa `updateProposalStatus`).

#### Cronologia
- 2026-07-02 — Flaggato durante review chain della board (`mainBoardlayoutfromADR0002`), finding [4] confermato dal `Review Reviewer`.

## Issue risolti

_Nessuna issue risolta._
