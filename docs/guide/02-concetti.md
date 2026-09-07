# 2. Concetti e glossario

Questo capitolo definisce il vocabolario che ricorre in tutta la codebase e nel
resto della guida. Tienilo a portata di mano.

## Le entità

**Progetto (`project`)** — una bacheca. È l'unità di *tenancy*: proposte, membri
e ruoli appartengono a un progetto. Un utente vede solo i progetti di cui è
membro. Introdotto in [ADR-0009](../architecture/adr/0009-projects-per-project-roles.md).

**Membership e ruolo (`project_members`)** — la riga che lega un utente a un
progetto con un `role`: `admin` o `contributor`. **Non esiste un ruolo globale**:
lo stesso utente può essere admin di un progetto e contributor di un altro.

- **Admin di progetto**: gestisce membri e repo GitHub, può spostare/eliminare
  qualsiasi proposta, lancia la valutazione AI, cancella il progetto.
- **Contributor**: propone idee, commenta, vota, sposta le proprie proposte
  entro i limiti della macchina a stati.

**Proposta (`proposal`)** — un'idea. Ha `title`, `description`, `problem`, dei
`links`, uno `status`, i punteggi RICE e i campi degli esiti AI. È l'oggetto
centrale dell'app.

**Commento (`comment`)** — un'osservazione su una proposta, opzionalmente
**ancorata** a una selezione esatta di testo del `description` o del `problem`.

**Contributo / co-autore** — un commento può essere *promosso a contributo*:
l'autore del commento diventa co-autore della proposta. Un co-autore accettato
non può votare quella proposta (è parte in causa).

**Voto RICE (`rice_votes`)** — il punteggio 1–10 sui quattro fattori dato da un
membro. Un voto per utente, **immutabile**.

## La board e gli stati

Una proposta vive in una colonna della board a seconda del suo `status`. Gli
stati (enum `proposal_status`) sono, nell'ordine di flusso:

| Stato | Significato |
|---|---|
| `nuova` | Appena creata. Qui gira lo scan anti-duplicato. |
| `in_valutazione` | In discussione e scoring; qui votano i membri e l'AI. |
| `approvata` | Accettata, in attesa di sviluppo. |
| `in_sviluppo` | In lavorazione. |
| `rilasciata` | Consegnata. |
| `rifiutata` | Scartata. **Stato terminale**: da qui si può solo eliminare. |
| `archiviata` | Messa da parte; può rientrare in gioco. |

Le transizioni consentite sono una **macchina a stati** esplicita, non un
qualunque-verso-qualunque — la trovi in [`src/lib/board.ts`](../../src/lib/board.ts)
e la spieghiamo nel [capitolo 7](07-proposte-e-board.md). L'eliminazione non è
una colonna: è l'azione cestino disponibile su ogni card, con conferma.

> Nota storica: lo stato `archiviata` si chiamava `parcheggiata` fino alla
> migration 0007.

## Lo scoring: RICE-10

**RICE** = Reach, Impact, Confidence, Effort. In questo progetto usiamo una
variante, **RICE-10** ([ADR-0006](../architecture/adr/0006-rice10-geometric-scoring.md)):

- I quattro fattori sono **interi 1–10** sulla stessa scala, ognuno con una
  rubrica. Non ci sono unità eterogenee (persone/mese, %…): tutto è 1–10.
- **`effort` è espresso come *Ease*** (facilità): 10 = molto facile. Così tutti i
  fattori "vanno nella stessa direzione" — più alto è meglio.
- Il punteggio complessivo è una **media geometrica** dei fattori, non il prodotto
  grezzo della RICE classica. Dettagli e formula nel [capitolo 8](08-scoring-rice10.md).

Lo stesso schema di punteggio è usato sia dal **voto dei membri** sia dalla
**valutazione dell'AI**.

## Gli esiti AI

Ogni proposta porta con sé due "stati AI" (enum `ai_eval_status`: `assente`,
`in_corso`, `completata`, `fallita`):

- **Valutazione AI (`ai_eval_*`)** — Claude assegna i punteggi RICE-10 e una
  motivazione (`ai_rationale`), usando come contesto il *digest* della repo
  GitHub collegata. Vedi [capitolo 9](09-ai-integrazioni.md).
- **Scan duplicati/competitor (`dup_scan_*`)** — due controlli: un *judge* di
  similarità contro le altre idee della board (`dup_similarity`, `dup_match`) e
  una ricerca competitor sul web. Se la similarità supera la soglia (85), la
  proposta è **`dup_flagged`** e resta bloccata in `nuova`.

## Concetti tecnici ricorrenti

**RLS (Row Level Security)** — le policy Postgres che decidono, riga per riga,
chi può leggere/scrivere. Sono la rete di sicurezza *enforced dal database*:
reggono anche se una guardia applicativa viene dimenticata.

**Service role** — una chiave Supabase che **bypassa le RLS**. Usata solo lato
server per scritture che l'utente non deve poter forgiare: esiti AI, inviti,
rimozione utenti. Mai esposta al client. Vedi [ADR-0008](../architecture/adr/0008-service-role-writes-for-ai-verdicts.md).

**Server Action** — una funzione `"use server"` di Next: il punto dove si
*autorizza e si muta*. È il layer di applicazione.

**Ancora (di un commento)** — la coppia *(testo citato esatto, indice di
occorrenza)* che lega un commento a un punto del testo. Vedi [capitolo 10](10-editor-commenti.md).

---

Precedente: [← 1. Introduzione](01-introduzione.md) · Prossimo: [3. Avvio in locale →](03-avvio-locale.md)
