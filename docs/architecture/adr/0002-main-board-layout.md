# ADR-0002: Layout della Main Board (board a colonne per stato)

- **Stato:** Proposed
- **Data:** 2026-07-01

## Context
La pagina principale di idea.collector deve mostrare le proposte come una board stile Trello/ClickUp: una colonna per stato, con drag-and-drop delle card tra colonne. Gli stati sono già fissati nel data model (`proposal_status` in `supabase/migrations/0001_init.sql`), quindi le colonne sono note e non configurabili. La scelta della libreria DnD è una dipendenza runtime con un minimo di lock-in e va registrata. Dettaglio completo e piani alternativi in [RFC-002](../rfc/RFC-002-main-board-layout.md).

## Decision
Costruire la board con **`@dnd-kit`**, standard 2026 per il drag-and-drop React (core leggero, accessibilità e navigazione da tastiera incluse), isolando la libreria in un unico Client Component.

- **Colonne:** una per valore di `proposal_status`, nell'ordine del flusso — `Nuovo → In Valutazione → Approvata → In Sviluppo → Rilasciata`, con `Parcheggiata` e `Rifiutata` in coda. Tutte visibili sulla stessa board; l'overflow si gestisce con **scroll orizzontale** (Opzione A del RFC — niente filtro/archivio).
- **Ordine card dentro la colonna:** per `created_at` (`ORDER BY created_at`), nessuna colonna `position`, nessun riordino manuale persistito.
- **Modularità / DRY:** `@dnd-kit` importato **solo** in `src/components/board/Board.tsx`. `<Column>` è un solo componente reso 7 volte via `.map()`; ordine colonne, label IT degli stati e `groupByStatus` vivono in un unico SSOT `src/lib/board.ts`; dimensioni/gap come token in `src/lib/tokens.ts`. Card e colonne restano presentazionali (props in, callback out).
- **Layering:** `page.tsx` (Server Component) autentica e legge le proposte; `<Board>` gestisce solo il drag con `useOptimistic`; la Server Action `updateProposalStatus` autorizza (ruolo + ownership, backstop RLS `"owner or admin update"`) e logga in `status_history`. Lo spostamento riusa la regola di autorizzazione già esistente — nessun permesso nuovo.

Fuori scope (rinviato a branch dedicati): rename dell'enum `parcheggiata → archiviata` (tocca `supabase/migrations/`, owner-locked) e l'implementazione vera e propria della board.

## Consequences
**Positive:** libreria standard, accessibile e con supporto tastiera/touch out-of-the-box; il DnD è confinato in un solo componente, quindi la libreria è sostituibile senza toccare il resto (es. migrazione a Pragmatic drag-and-drop solo se serve la scala Trello); colonne per composizione → aggiungere/rinominare uno stato è una riga in `board.ts`; autorizzazione già coperta da RLS + guard; layout in puro CSS.
**Negative:** una dipendenza runtime in più (`@dnd-kit`); l'ordinamento è vincolato a `created_at` — un futuro riordino manuale richiederebbe una colonna `position` e una migration; le colonne `Parcheggiata`/`Rifiutata` restano sempre visibili e occupano spazio orizzontale.

## Source
Decisione dell'owner (2026-07-01) in [RFC-002](../rfc/RFC-002-main-board-layout.md), con scelta esplicita di Piano A (`@dnd-kit`), Opzione A per gli stati laterali e ordinamento per data. Best practice DnD 2026 dalla ricerca citata nell'RFC.

## If we were starting today
Sì. Per un tool interno a scala medio-piccola, `@dnd-kit` è il minimo che soddisfa tutti i requisiti (drag reale + accessibilità) senza machinery. Rivedere solo se la board dovesse gestire centinaia+ di card visibili insieme (allora Pragmatic drag-and-drop) o se servisse un ordinamento manuale persistito.
