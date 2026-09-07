# 7. Proposte e board

## 7.1 Il ciclo di vita di una proposta

1. **Creazione** — un membro apre "nuova proposta" in un progetto
   (`createProposal`, [`src/app/proposals/new/actions.ts`](../../src/app/proposals/new/actions.ts)).
   Nasce in stato `nuova`. All'atterraggio sul dettaglio parte lo **scan
   anti-duplicato**.
2. **Triage in `nuova`** — se lo scan la marca `dup_flagged` (similarità ≥ 85 con
   un'idea esistente), **non può avanzare** finché non viene sbloccata o rifiutata.
3. **`in_valutazione`** — qui si discute con i commenti, votano i membri
   (RICE-10) e l'admin può lanciare la **valutazione AI**. È l'unica finestra in
   cui i membri votano e in cui il contenuto è ancora modificabile.
4. **`approvata` → `in_sviluppo` → `rilasciata`** — l'avanzamento operativo.
5. **`archiviata`** — messa da parte; può rientrare in `in_valutazione`/
   `approvata`/`in_sviluppo`.
6. **`rifiutata`** — stato terminale: da qui si può solo **eliminare** (safeguard
   prima della cancellazione irreversibile).

## 7.2 La macchina a stati

Le transizioni consentite sono esplicite in
[`src/lib/board.ts`](../../src/lib/board.ts) — non è un grafo completo:

```
nuova          → in_valutazione, rifiutata
in_valutazione → approvata, rifiutata, archiviata
approvata      → in_sviluppo, rifiutata
in_sviluppo    → rilasciata, archiviata, rifiutata
rilasciata     → rifiutata
rifiutata      → (nessuna — terminale)
archiviata     → in_valutazione, approvata, in_sviluppo, rifiutata
```

`canMoveTo(from, to)` è la funzione che la board e la Server Action consultano.
La stessa regola è **applicata anche a DB** dentro `move_proposal` (0018): la UI
propone, il database dispone.

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
  `fromStatus`). Se la transizione non è ammessa o c'è un flag duplicato, il DB
  rifiuta e la card torna al suo posto.
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
  `updateProposal` (solo `nuova`/`in_valutazione`; se il testo cambia, ri-lancia
  eval+scan), `submitRiceVote`, `setGitRef`, `setTaskUrl`.

---

Precedente: [← 6. Autenticazione](06-autenticazione.md) · Prossimo: [8. Scoring RICE-10 →](08-scoring-rice10.md)
