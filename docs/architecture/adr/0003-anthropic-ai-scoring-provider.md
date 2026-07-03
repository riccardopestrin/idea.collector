# ADR-0003: Anthropic (Claude) come provider di scoring AI

- **Stato:** Proposed
- **Data:** 2026-07-03

## Context

Vogliamo che una proposta venga valutata automaticamente con il metodo RICE confrontando il testo dell'idea con il contesto del repository del progetto (vedi [RFC-003](../rfc/RFC-003-ai-rice-evaluation-github.md)). Serve un LLM: è un provider AI esterno con lock-in a lungo termine, quindi richiede una ADR ([`adr-when-to-write.md`](../../../.claude/rules/adr-when-to-write.md)). Le domande da fissare: quale provider, quale superficie API, dove vive la chiamata, come si gestiscono output non validi e rifiuti, come si contengono i costi.

## Decision

Usare **Anthropic Claude** come provider di scoring AI.

- **Superficie:** una singola **Messages API** call (`@anthropic-ai/sdk`), **non** Managed Agents — il compito è una valutazione one-shot, non un agente che esplora. Modello `claude-opus-4-8`, `thinking: {type:"adaptive"}`.
- **Output vincolato:** structured outputs (`output_config.format`, `json_schema`) via `client.messages.parse()` → `{reach, impact, confidence, effort, rationale}`. Il service clampa/valida i range in base a `method` (RICE: `confidence`∈0..1, `effort`>0; ICE: 1..10) prima di persistere.
- **Layer:** la chiamata vive nel **service** `src/lib/ai/evaluateProposal.ts` (application layer), orchestrata da una Server Action admin-only; il client Anthropic è isolato in `src/lib/ai/anthropic.ts` che legge `ANTHROPIC_API_KEY` da env (mai da un componente). Nessuna business logic al transport.
- **Rifiuti/errori:** si gestisce `stop_reason === "refusal"`, rate-limit, timeout (~30s) e JSON invalido come **fallimento non bloccante** (stato `fallita`, ri-lanciabile), senza mai bloccare il cambio di stato della proposta.
- **Costi:** prompt caching del digest del repo (prefisso stabile, TTL 1h) + cache server-side del digest; `max_tokens` contenuto (output = JSON piccolo).

## Consequences

**Positive:** modello capace e adatto a valutazione con contesto lungo; structured outputs elimina il parsing fragile; la chiamata isolata nel service è testabile con mock e sostituibile; caching contiene costo e latenza.
**Negative:** lock-in sull'API Anthropic (SDK, structured outputs, formato dei blocchi) e costo per valutazione; nuova env `ANTHROPIC_API_KEY` da custodire; dipendenza da disponibilità/rate-limit del provider (mitigata dal fallimento non bloccante + rilancio).

## Source

Richiesta dell'owner (2026-07-03) di valutazione RICE automatica; scoping in [RFC-003](../rfc/RFC-003-ai-rice-evaluation-github.md). Dettagli API dalla reference dello skill `claude-api`.

## If we were starting today

Sì: per una valutazione one-shot con contesto, una singola Messages API call con structured outputs è la scelta a minor complessità. Rivedere solo se servisse un agente che naviga davvero il repo (allora Managed Agents) o un secondo provider come fallback.
