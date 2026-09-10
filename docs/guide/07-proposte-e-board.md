# 7. Proposte e board

## 7.1 Il ciclo di vita di una proposta

1. **Creazione** — un membro apre "nuova proposta" in un progetto
   (`createProposal`, [`src/app/proposals/new/actions.ts`](../../src/app/proposals/new/actions.ts)).
   Nasce in stato `nuova`. All'atterraggio sul dettaglio parte lo **scan
   anti-duplicato**.
2. **Triage in `nuova`** — se lo scan la marca `dup_flagged` (similarità ≥ 85 con
   un'idea esistente), **non si muove** finché non viene modificata (e la
   similarità scende) o eliminata. In `nuova` non si vota.
3. **`in_valutazione`** — l'unica uscita da `nuova`. Al passaggio parte la
   **prima valutazione AI**; da qui in avanti si discute, si vota (RICE-10) e si
   modifica liberamente, in ogni stato.
4. **`approvata` → `in_sviluppo` → `rilasciata`**, **`archiviata`**, **`rifiutata`**
   — caselle libere: si passa da ciascuna a ciascun'altra, mai indietro in `nuova`.
   Da `rifiutata` si può anche **eliminare** (safeguard prima della cancellazione
   irreversibile).

## 7.2 La macchina a stati "ibrida"

Una sola casella è vincolata (`canMoveTo` in
[`src/lib/board.ts`](../../src/lib/board.ts)):

```
nuova          → in_valutazione (soltanto)
ogni altro     → ogni altro stato ≠ nuova
```

La stessa regola è **applicata anche a DB** dentro `move_proposal` (0031): la UI
propone, il database dispone. Non esiste più la "cristallizzazione": contenuto,
commenti, promozioni e voti restano modificabili in ogni stato; la valutazione
AI viene rilanciata quando cambia il testo dell'idea o un contributo accettato.

> L'ordine delle colonne diverge dall'enum: `archiviata` è mostrata **dopo**
> `rifiutata` (`BOARD_COLUMNS`), perché nel flusso di lettura ha senso lì.

L'**eliminazione** non è una colonna: è l'azione cestino su ogni card
(autore/admin), con dialog di conferma
([`DeleteProposalDialog`](../../src/components/board/DeleteProposalDialog.tsx)).

## 7.3 La board

- **Home di un progetto** — [`projects/[projectId]/page.tsx`](../../src/app/projects/[projectId]/page.tsx):
  una colonna per stato, card raggruppate da `groupByStatus` (ordine di arrivo,
  ogni colonna esiste sempre anche se vuota). Ricerca via `?q`.
- **Drag-and-drop** con `@dnd-kit` ([`Board.tsx`](../../src/components/board/Board.tsx)):
  al drop chiama `updateProposalStatus`, che passa da `move_proposal` (CAS su
  `fromStatus`). Durante il drag le colonne vietate mostrano un piccolo divieto
  arancione accanto al titolo (i bordi non cambiano mai) e il drop lì è un no-op;
  se comunque la transizione non è ammessa o c'è un flag duplicato, il DB rifiuta
  e la card torna al suo posto.
- **Card** ([`ProposalCard.tsx`](../../src/components/cards/ProposalCard.tsx)):
  titolo, punteggio composito, stato AI/scan, autori, azioni rapide.

## 7.4 Il dettaglio: modal e pagina piena

Lo stesso `ProposalPanel` è mostrato in due modi (parallel + intercepting routes,
[capitolo 4](04-architettura.md)):

- **Overlay** quando clicchi una card dalla board: la route
  `@modal/(.)proposals/[id]` intercetta e lo mette dentro `DetailModal`.
- **Pagina piena** su link diretto/refresh: `proposals/[id]/page.tsx`.

L'URL del dettaglio è **globale** (`/proposals/[id]`, l'id è univoco): il progetto
si ricava dalla proposta. Entrambi caricano `getProposalDetail`.

## 7.5 La classifica (ranking)

[`projects/[projectId]/ranking/page.tsx`](../../src/app/projects/[projectId]/ranking/page.tsx)
ordina le proposte per punteggio composito e permette di filtrare per più stati
insieme (`?status=a,b`). Il punteggio è quello descritto nel
[capitolo 8](08-scoring-rice10.md).

## 7.6 Le Server Action delle proposte

Tutte seguono il pattern *authorize-then-mutate*: validano l'input, risolvono
l'utente, applicano una guardia per messaggi puntuali, poi mutano (spesso via RPC
transazionale), con le RLS come backstop.

- [`proposals/actions.ts`](../../src/app/proposals/actions.ts): `updateProposalStatus`
  (move), `evaluateProposal` (admin), `runProposalScanAction`, `addComment`,
  `editComment`/`deleteComment`, promozione commenti, `deleteProposal`.
- [`proposals/[id]/actions.ts`](../../src/app/proposals/[id]/actions.ts):
  `updateProposal` (in ogni stato; se il testo cambia ri-lancia lo scan in
  `nuova`, l'eval altrove), `submitRiceVote`, `setGitRef`, `setTaskUrl`.

---

Precedente: [← 6. Autenticazione](06-autenticazione.md) · Prossimo: [8. Scoring RICE-10 →](08-scoring-rice10.md)
