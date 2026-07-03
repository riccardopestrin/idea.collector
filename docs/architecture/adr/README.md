# Architecture Decision Records

Decisioni architetturali vincolanti per **idea.collector**. Formato MADR-lite, scritte a mano (niente script, niente generazione automatica). Una decisione = un file `NNNN-titolo-kebab.md`.

Quando scriverne una: vedi [`.claude/rules/adr-when-to-write.md`](../../../.claude/rules/adr-when-to-write.md) (nuova dipendenza con lock-in, cambio del modello di auth/dati, cambio del modello di deploy). Le ADR sono autorizzate e accettate solo dall'owner (Riccardo).

Template: copia [`0000-template.md`](0000-template.md).

## Indice

| ADR | Titolo | Stato |
|---|---|---|
| [0001](0001-supabase-postgres-auth.md) | Supabase come database e autenticazione | Accepted |
| [0002](0002-main-board-layout.md) | Layout della Main Board (board a colonne per stato) | Proposed |
| [0003](0003-anthropic-ai-scoring-provider.md) | Anthropic (Claude) come provider di scoring AI | Proposed |
| [0004](0004-github-app-repo-context.md) | Integrazione GitHub via GitHub App per contesto progetto | Proposed |
| [0005](0005-tiptap-editor-anchored-comments.md) | Tiptap editor rich-text, storage markdown, anchoring commenti | Proposed |
