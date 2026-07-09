# ADR-0007: Scan anti-duplicato con LLM-as-judge + ricerca competitor via web_search

- **Stato:** Proposed
- **Data:** 2026-07-08

## Context

Non esiste alcun controllo di duplicazione: due membri possono inserire la stessa idea senza che nulla lo segnali, e nessuno verifica se una feature esiste già in prodotti competitor. La richiesta (RFC-006) introduce due scansioni AI quando una proposta è in `nuova`: un confronto con le idee locali (hard flag ≥ 85%: la proposta non esce da `nuova` se non differenziata, rifiutata o eliminata) e una ricerca web informativa, con un report unico in fondo alla Proposal page. Questo estende l'uso del provider AI (trigger ADR: nuovo percorso di chiamata dietro la feature di scoring, ADR-0003) e aggiunge una capability nuova, la ricerca web — con una implicazione privacy da registrare.

## Decision

- **Similarità locale via LLM-as-judge** sul client Anthropic esistente (ADR-0003), non embeddings: le idee candidate (cap 100, titolo + descrizione troncata) vengono passate a Claude con structured output `{matchId, similarity 0–100, summary}`; la soglia 85 è business rule nel service TS. Niente pgvector né provider di embeddings (Anthropic non ne offre): a scala MVP sarebbe una nuova dipendenza, un nuovo secret e più macchinario senza beneficio. Follow-up se il volume supera il cap: pre-filtro `pg_trgm`/pgvector.
- **Ricerca competitor con il server tool `web_search`** (`web_search_20260209`, `max_uses: 3`) nella stessa API key Anthropic: nessuna nuova integrazione. I link delle fonti nel report provengono solo dalle citazioni reali di `web_search`; il link e l'autore dell'idea locale matchata sono resi dai dati (embed `dup_match`), mai dal testo del modello.
- **Nota privacy (accettata):** con lo scan web, titolo/descrizione/problema dell'idea escono verso l'indice di ricerca esterno usato da `web_search`. Le idee sono materiale interno; l'egress è limitato al testo della singola proposta, senza autori né dati del team.
- **Enforcement a due livelli** (layered-architecture): guard nel service (`updateProposalStatus`) + backstop nella RPC `move_proposal`; colonne `dup_*` privilegiate, scrivibili solo dalle RPC `SECURITY DEFINER` con GUC (pattern di `move_proposal`/eval, migration 0017).

## Consequences

**Positive:** riusa per intero il pattern eval esistente (begin/apply/fail, trigger non bloccante, cue di stato, "Rilancia"); zero nuove dipendenze, secret o env di produzione; il flag è enforced a DB anche per chiamate dirette; report con fonti reali, senza URL allucinati.

**Negative:** costo per scan (2 chiamate Claude + fino a 3 ricerche web, fatturate per ricerca); LLM-as-judge meno preciso e meno scalabile degli embeddings (mitigato dal cap candidati e dal re-scan su edit); egress del testo idea verso la ricerca web (accettato sopra); il trigger on-view lascia uno scan `in_corso` orfano se l'autore abbandona subito la pagina (recuperabile con "Rilancia", pattern 0011).

## Source

Richiesta dell'owner (2026-07-08): controllo duplicati locale con hard flag + verifica competitor sul web con report in fondo alla Proposal page. Scoping, alternative (pgvector) e architettura in [RFC-006](../rfc/RFC-006-duplicate-scan-and-competitor-scan.md). Dettagli `web_search` dalla reference API Claude.

## If we were starting today

Sì: a questa scala il judge LLM è la scelta giusta — gli embeddings diventano preferibili solo quando i candidati non stanno più in un prompt (centinaia+), e a quel punto il seam è già pronto (il service riceve la lista candidati, basta cambiarne la provenienza).
