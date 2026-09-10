# 1. Introduzione

**idea.collector** è uno strumento per raccogliere, discutere e dare una priorità
alle idee di prodotto di un team. Un'idea entra come *proposta*, viene discussa
con commenti ancorati al testo, valutata con un punteggio RICE-10 (sia dai membri
sia da un'AI), e avanza attraverso una board a colonne dal momento in cui nasce
fino a quando viene rilasciata, archiviata o rifiutata.

Non è un clone di un tool di ticketing. La sua ragione d'essere è **la
prioritizzazione onesta**: forzare ogni idea attraverso le stesse rubriche di
scoring, affiancare il giudizio umano a quello di un modello, e segnalare presto
i duplicati e i competitor già esistenti — prima di investirci sopra.

## A chi serve

- **Team di prodotto piccoli** che vogliono un posto unico dove le idee non si
  perdono e vengono confrontate con lo stesso metro.
- **Ogni progetto è una bacheca (tenant) a sé**: membri e ruoli sono per-progetto.
  Un utente può stare in più progetti con ruoli diversi.

## Cosa sa fare (V1)

- **Board a colonne per stato** con drag-and-drop e una macchina a stati
  "ibrida": vincolata solo in uscita da `Nuova`, libera altrove.
- **Scoring RICE-10**: quattro fattori su scala 1–10 a rubriche, combinati con
  media geometrica. Sia i membri che l'AI votano sulla stessa scala.
- **Valutazione AI** della proposta (Claude), arricchita dal contesto della repo
  GitHub collegata.
- **Scan anti-duplicato** (LLM-as-judge sulle idee della stessa board) e **scan
  competitor** (ricerca sul web). Un duplicato sopra soglia blocca l'avanzamento.
- **Discussione con commenti ancorati** a una selezione esatta del testo, e
  **promozione di un commento a contributo** (il commentatore diventa co-autore).
- **Integrazioni**: GitHub App per il contesto repo; link a un task ClickUp.
- **Accesso solo su invito**, magic link, ruoli admin/contributor per progetto.

## La filosofia del progetto

Tre principi guidano ogni scelta di codice qui, e li ritroverai citati nelle
regole del repo:

1. **Semplicità, mai overengineering.** Si scrive il codice più semplice che
   soddisfa il requisito *reale e presente*. Niente astrazioni speculative,
   niente flessibilità "per dopo". Vedi
   [`.claude/rules/simplicity-no-overengineering.md`](../../.claude/rules/simplicity-no-overengineering.md).
2. **Architettura a livelli, concern separati.** Transport autentica, il service
   autorizza e applica le regole di business, il data layer legge/scrive e le RLS
   sono la rete di sicurezza *a livello di database*. L'autorizzazione non vive
   mai solo nella UI. Vedi
   [`.claude/rules/layered-architecture.md`](../../.claude/rules/layered-architecture.md).
3. **La sicurezza è enforced dal database.** Ogni scrittura privilegiata è
   protetta da una policy RLS o da un trigger, non solo da un `if` in TypeScript.

Se una di queste frasi non ti è chiara, è normale: i capitoli successivi le
srotolano una per una.

## Stato del progetto

Siamo al rilascio della **V1**. Il codice è pensato come la struttura
dell'applicazione finale, non come un MVP usa-e-getta. Il test E2E (Playwright)
è **rimandato**: la copertura è unit + component (Vitest) e test RLS (pgTAP).

---

Precedente: [← Indice](README.md) · Prossimo: [2. Concetti e glossario →](02-concetti.md)
