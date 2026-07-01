# RFC-002: Layout della Main Board (pannello principale a colonne)

- **Stato:** Ready — tutte le decisioni prese; pronto per conversione in ADR-0002 (autoria/accettazione ADR = owner, vedi [`adr-when-to-write.md`](../../../.claude/rules/adr-when-to-write.md))
- **Data:** 2026-07-01
- **Branch:** `RFC002_LayoutMainPageDefinition`

## Context

La pagina principale di idea.collector deve mostrare tutte le proposte come una board stile Trello/ClickUp: **una colonna per stato**, le nuove proposte entrano in `Nuovo`, e l'utente sposta le card da colonna a colonna trascinandole. Requisiti espliciti dell'owner:

- Una colonna per categoria/stato.
- Card trascinabili tra colonne.
- Spazio generoso tra le colonne, card ben leggibili.
- Overflow gestito con **scroll orizzontale** del pannello.
- Niente overengineering; scelta guidata da best practice 2026.

### Vincoli già esistenti (non sono decisioni di questo RFC)

Lo stato è già modellato nel DB (`supabase/migrations/0001_init.sql`), quindi le colonne sono **fisse e note**, non configurabili:

```
proposal_status = nuova | in_valutazione | approvata | in_sviluppo
                | rilasciata | parcheggiata | rifiutata
```

- `proposals.status` ha default `'nuova'` → le nuove proposte compaiono già in `Nuovo`.
- RLS `"owner or admin update" on proposals` → **un contributor può spostare solo le proprie proposte; un admin qualsiasi**. Questa regola vive già nel DB ed è il backstop; va ri-affermata come guard nella Server Action (vedi [`layered-architecture.md`](../../../.claude/rules/layered-architecture.md)).
- Esiste `status_history` con `"admin insert history"` → il cambio di stato può/deve loggare la transizione.

**Domanda aperta per l'owner:** `parcheggiata` e `rifiutata` sono stati "laterali". Mostrarle come colonne in fondo alla board, o nasconderle dietro un filtro? Il default proposto qui è **7 colonne, con `parcheggiata`/`rifiutata` in coda** (zero logica extra); si scorre orizzontalmente per raggiungerle.

## Best practice 2026 (sintesi ricerca)

- **`@dnd-kit`** è la scelta di default nel 2026 per DnD in React: core ~6KB, framework-agnostic, **accessibilità inclusa nel core** (annunci ARIA live su start/over/end, `KeyboardSensor`: Space per prendere, frecce per muovere, Space per rilasciare, Esc per annullare). ~2.8M download/settimana, mantenuto.
- **Pragmatic drag-and-drop** (Atlassian, quello dietro Jira/Trello): headless, <4KB, performance a scala Trello, nessun vincolo UI. Vale la pena **solo** con centinaia/migliaia di card o esigenze di perf estreme.
- **HTML5 nativo** (`draggable` + eventi drag/drop): zero dipendenze, ma accessibilità e mobile/touch vanno fatti a mano — nel 2026 sconsigliato per DnD di prodotto proprio per l'a11y.
- **React 19 `useOptimistic`** è lo strumento standard per l'UI ottimistica: la card si sposta subito, la Server Action conferma/riallinea.

Per la scala di un tool interno (decine, forse basse centinaia di proposte) **`@dnd-kit` copre tutto senza costi**; Pragmatic sarebbe overengineering finché la board non diventa Trello.

## Architettura comune a tutti i piani

Indipendente dalla libreria scelta, il layering è lo stesso:

- **Transport** — `src/app/page.tsx` (Server Component): autentica, legge le proposte via `supabase/server.ts`, le passa alla board.
- **Board** — un Client Component (`'use client'`) che raggruppa le proposte per `status` e gestisce il drag. È l'unico pezzo client.
- **Application service** — una Server Action `updateProposalStatus(id, toStatus)` che **autorizza** (ruolo + ownership), aggiorna `proposals.status` e logga in `status_history`. RLS resta il backstop.
- **Data** — query Supabase + RLS già esistenti.

Lo scroll orizzontale + spaziatura sono puro CSS (Tailwind 4), nessuna libreria: contenitore `flex gap-6 overflow-x-auto`, colonne `w-80 shrink-0`. Token di larghezza/gap in `src/lib/tokens.ts` (regola DRY), non inline.

## Piani proposti

### Piano A — `@dnd-kit` + `useOptimistic` (RACCOMANDATO)

Lo standard 2026, il minimo che soddisfa *tutti* i requisiti (incl. accessibilità e touch) senza machinery.

- `pnpm add @dnd-kit/core @dnd-kit/sortable`
- `<Board>`: `DndContext` con `PointerSensor` + `KeyboardSensor`; una `<Column>` droppable per stato; `<Card>` draggable.
- `onDragEnd` → `useOptimistic` sposta la card localmente e chiama `updateProposalStatus`.
- Server Action con guard `role/ownership` + insert in `status_history`.
- **Costo:** ~1 dipendenza (2 pacchetti stesso autore), 3 componenti, 1 action. **A11y e keyboard gratis.**
- **Contro:** una dipendenza in più rispetto al Piano C.

### Piano B — Pragmatic drag-and-drop (headless, scala Trello)

Uguale al Piano A ma con `@atlaskit/pragmatic-drag-and-drop`. Bundle più piccolo, perf superiore a grandi numeri, ma headless = **più codice di wiring** (auto-scroll, drop-indicator, a11y da comporre). 

- **Quando sceglierlo:** solo se prevediamo centinaia+ di card visibili insieme o serve perf da Jira. **Oggi è overengineering.**

### Piano C — Zero-dipendenze: cambio stato senza drag (il più lazy)

Nessuna libreria DnD. Le colonne restano (stesso layout CSS), ma la card si sposta via un piccolo menu "Sposta in →" (un `<select>`/bottoni) che chiama la stessa `updateProposalStatus`.

- **Pro:** zero dipendenze, a11y nativa del `<select>`, il 90% del valore (vedere e riorganizzare per stato) con il 30% del codice.
- **Contro:** non è il "trascinamento" chiesto esplicitamente. Utile come **fallback/MVP** o come step 1 prima del DnD.

## Struttura modulare & DRY (Piano A scelto)

Ogni pezzo ha un solo compito e i concetti condivisi esistono in un solo posto. La libreria (`@dnd-kit`) è isolata dentro `<Board>`: nessun altro file la importa, quindi è sostituibile senza toccare il resto.

```
src/app/page.tsx            # Server Component: auth + fetch, passa le proposte
src/components/board/
  Board.tsx                 # 'use client' — unico punto che conosce @dnd-kit
  Column.tsx                # droppable, riusata 7 volte (1 per stato) via props
  ProposalCard.tsx          # draggable, presentazione della singola proposta
src/app/proposals/actions.ts
  updateProposalStatus()    # Server Action: guard role/ownership + status_history
src/lib/board.ts            # SSOT: ordine colonne + label IT degli stati (da enum)
src/lib/tokens.ts           # larghezza colonna, gap, min-height card
```

Punti DRY non negoziabili (regola [`dry-beyond-sx.md`](../../../.claude/rules/dry-beyond-sx.md)):

- **Colonne per composizione, non copia-incolla:** `<Column>` è una sola, resa 7 volte in un `.map()` sull'ordine definito in `src/lib/board.ts`. Aggiungere/rinominare uno stato = una riga lì (allineata all'enum DB), zero modifiche ai componenti.
- **Label degli stati in un solo posto** (`board.ts`): mapping `proposal_status → "Nuovo" | "In Valutazione" | …`. Riusato da board, card e history.
- **Raggruppamento per stato = una util pura** (`groupByStatus` in `src/lib/board.ts`), testabile in isolamento, non logica sparsa nel componente.
- **Dimensioni/gap come token** (`tokens.ts`), mai valori inline.
- **`useOptimistic` una volta sola** dentro `<Board>`; card e colonne restano presentazionali (props in, callback out) → riutilizzabili anche fuori dal DnD (es. Piano C, viste future).

## Raccomandazione

**Piano A.** È la baseline 2026, soddisfa il requisito di drag reale, e regala accessibilità/keyboard/touch che altrimenti andrebbero scritti a mano (Piano C) o composti (Piano B). Pragmatic (B) si adotta solo quando la scala lo impone; è una migrazione localizzata al solo `<Board>` se mai servisse.

Se l'owner vuole il minor codice possibile per l'MVP e accetta di rimandare il drag, **Piano C ora → Piano A poi** è una progressione pulita (la Server Action non cambia).

## Decisioni che servono dall'owner (per chiudere l'ADR)

1. **Piano A / B / C?** (default: A)
2. **`parcheggiata`/`rifiutata`:** ✅ **deciso — Opzione A: 7 colonne, le due laterali in coda.** Si raggiungono con lo scroll orizzontale; nessuna UI di filtro/archivio (YAGNI).
   Nota: l'owner ha deciso di rinominare l'enum `parcheggiata → archiviata`, ma **in un branch dedicato** (tocca `supabase/migrations/`, owner-locked). In questo branch l'enum resta `parcheggiata`.
3. **Ordinamento card dentro la colonna:** ✅ **deciso — per `created_at` (data di creazione)**. Zero stato extra, `ORDER BY created_at` nella query. Niente colonna `position`, niente riordino manuale (YAGNI).

## Consequences (per il Piano A raccomandato)

**Positive:** libreria standard e accessibile out-of-the-box; un solo Client Component; regola di autorizzazione già coperta da RLS + guard; layout in puro CSS.
**Negative:** una dipendenza runtime (`@dnd-kit`); lo stato di ordinamento intra-colonna, se richiesto in futuro, impone una migration.

## Source

Richiesta dell'owner (2026-07-01) di definire il layout della main board. Best practice DnD da ricerca 2026 (vedi sotto).
