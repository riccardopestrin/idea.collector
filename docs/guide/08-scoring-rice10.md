# 8. Scoring RICE-10

La prioritizzazione è il cuore di idea.collector. Questo capitolo spiega come si
calcola il punteggio di una proposta. La decisione di design è
[ADR-0006](../architecture/adr/0006-rice10-geometric-scoring.md); il codice è in
[`src/lib/proposals.ts`](../../src/lib/proposals.ts).

## 8.1 I quattro fattori

Ogni valutatore (un membro **o** l'AI) dà quattro voti **interi 1–10**, ognuno
ancorato a una rubrica:

- **Reach** — quanti utenti/casi tocca.
- **Impact** — quanto conta per chi tocca.
- **Confidence** — quanto siamo sicuri delle stime.
- **Effort → espresso come *Ease*** — facilità di realizzazione. **10 = molto
  facile.**

La scelta di esprimere lo sforzo come *facilità* è deliberata: così **tutti i
fattori vanno nella stessa direzione** (più alto = meglio), e la formula non deve
invertire nulla.

## 8.2 Il punteggio individuale: media geometrica

Il punteggio di un singolo valutatore è la **media geometrica** dei quattro
fattori:

```
individualScore = (reach · impact · confidence · effort) ^ (1/4)   ∈ [1, 10]
```

Perché geometrica e non il prodotto della RICE classica:

- **Non compensativa**: un fattore debole (es. confidence = 2) *affossa* il
  totale — non può essere mascherato da un altro fattore alto. È la proprietà che
  vogliamo per la prioritizzazione onesta.
- **Scala leggibile**: il risultato resta in `[1, 10]`, come i fattori. Un
  prodotto grezzo (fino a 10000) sarebbe illeggibile.

Se manca anche un solo fattore, il punteggio individuale è `null` (non valutato).

## 8.3 Il punteggio composito

Una proposta ha di norma **più valutatori**: la valutazione di Claude *più* i voti
dei membri. Il composito
([`computeCompositeScore`](../../src/lib/proposals.ts)) è:

- **`total`** — la **media aritmetica** dei punteggi individuali (Claude + tutti i
  membri che hanno votato). È il numero che ordina la classifica.
- **`claudeTotal`** — il solo punteggio individuale dell'AI, mostrato a parte.
- **`components`** — per ogni fattore, la **media aritmetica** dei voti su quel
  fattore tra tutti i valutatori (per mostrare "quanto in media pesa Reach", ecc.).

In sintesi: **geometrica dentro un valutatore** (per non compensare tra fattori),
**aritmetica tra valutatori** (per aggregare i pareri).

## 8.4 I voti dei membri

- Un voto per `(proposta, membro)`, **immutabile** (nessun update/delete a DB).
- Si vota **solo quando la proposta è `in_valutazione`**.
- **Non si vota la propria proposta**, né una in cui si è co-autore `accepted`
  (parte in causa).
- Validazione input in [`src/lib/validation/vote.ts`](../../src/lib/validation/vote.ts):
  quattro interi 1–10 obbligatori. Il DB rifiuta un voto duplicato (unique
  constraint → il codice gestisce l'errore 23505).

La UI del voto è [`RiceVoteForm`](../../src/components/detail/RiceVoteForm.tsx)
(slider 1–10 per fattore).

## 8.5 Il voto dell'AI

La valutazione di Claude produce gli stessi quattro fattori 1–10 più una
motivazione (`ai_rationale`). Occupa lo "slot" del valutatore-AI nel composito.
Come viene prodotta e persistita è il tema del [capitolo 9](09-ai-integrazioni.md).

## 8.6 La classifica

[`rankProposalsByScore`](../../src/lib/proposals.ts) ordina per `total`
decrescente; le proposte senza alcun voto valido finiscono in coda. Il sort è
stabile: a parità di punteggio resta l'ordine d'arrivo. La formattazione dei
numeri è centralizzata in `formatScore` (una cifra decimale, locale `it-IT`).

> Nota su ICE vs RICE: l'enum `scoring_method` prevede anche `ice` (senza Reach).
> Il default operativo è `rice`; per un voto ICE il `reach` è ammesso nullo a
> DB, ma il percorso principale della UI usa tutti e quattro i fattori.

---

Precedente: [← 7. Proposte e board](07-proposte-e-board.md) · Prossimo: [9. AI e integrazioni →](09-ai-integrazioni.md)
