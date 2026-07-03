# ADR-0005: Tiptap come editor rich-text, markdown come storage, anchoring commenti exact-quote

- **Stato:** Proposed
- **Data:** 2026-07-03

## Context

Il rework delle proposte ([RFC-004](../rfc/RFC-004-proposals-rework.md)) richiede: editor WYSIWYG stile Note iOS (heading, bold, italic, elenchi) con auto-formattazione del markdown incollato; commenti ancorati a selezioni di testo con highlight grigio che preserva la formattazione originale; edit dell'autore con ri-valutazione AI. Oggi `description`/`problem` sono plain text senza dipendenze editor. Aggiungere una libreria editor è una dipendenza con lock-in a lungo termine → trigger ADR. Vincolo chiave: il testo delle proposte viene inviato a Claude per lo scoring (ADR-0003), quindi il formato di storage deve restare LLM-friendly.

## Decision

### 1. Editor: Tiptap

`@tiptap/react` + `@tiptap/starter-kit` + `tiptap-markdown` (un solo ecosistema, ProseMirror). Copre WYSIWYG e markdown-paste out of the box; le *decorations* ProseMirror sono il meccanismo naturale per l'highlight cross-blocco dei commenti ancorati — fattore decisivo rispetto a un renderer markdown-AST. Scartati: Lexical (peso comparabile, paste markdown più debole, più boilerplate), `contentEditable` a mano (troppa logica custom su selezione/paste), textarea + preview (non è WYSIWYG).

**Come:**
- `src/components/editor/RichTextEditor.tsx` (client) — StarterKit vincolato a heading 1–3, bold, italic, bulletList, orderedList (tutto il resto disattivato, minimalismo Note iOS); toolbar minimale; `tiptap-markdown` con `html: false`. Serializza markdown in un `<input hidden name=...>` a ogni update, così i Server Action a `formData` restano invariati.
- `src/components/editor/RichTextViewer.tsx` (client) — istanza read-only (`editable: false`), stesse estensioni; usato in `ProposalPanel`.
- Entrambi client-only: `next/dynamic` `ssr: false` + `immediatelyRender: false` (evita hydration mismatch in Next 16); fallback primo paint: plain text `whitespace-pre-wrap`.
- Sanitizzazione: si persiste solo la stringa markdown attraverso lo schema vincolato; nessun raw HTML, nessun `dangerouslySetInnerHTML`.

### 2. Storage canonico: markdown nelle colonne esistenti

`description`/`problem` restano `text` e contengono markdown. Il plain text esistente è già markdown valido → zero migrazione dati. La pipeline AI (ADR-0003) invia la stringa a Claude invariata. Scartato Tiptap JSON in colonna nuova: migrazione + backfill, serializer dedicato per Claude, schema DB legato alla libreria.

**Come:** nessuna modifica DB per il rich text. `createProposal`/`updateProposal` validano lunghezza (~20k chars cap). Test round-trip obbligatorio in Fase B: load→save senza modifiche deve essere no-op sulla stringa (altrimenti le ancore si orfanizzano spuriamente); se tiptap-markdown normalizza (es. `*`→`-`), si accetta una normalizzazione one-time al primo save rich-text.

### 3. Anchoring commenti: exact-quote + occurrence index

Colonne nullable su `comments` (migration `0012_comment_anchors.sql`, owner-locked):

```sql
alter table public.comments
  add column anchor_field text check (anchor_field in ('description','problem')),
  add column anchor_text text check (char_length(anchor_text) between 1 and 2000),
  add column anchor_occurrence integer check (anchor_occurrence >= 1),
  add constraint comments_anchor_all_or_none check (
    (anchor_field is null) = (anchor_text is null)
    and (anchor_field is null) = (anchor_occurrence is null));
```

Risoluzione a render-time: N-esima occorrenza di `anchor_text` nel valore corrente del campo; quote assente → commento **orfano** (resta in sidebar con la citazione e badge "testo modificato", nessun re-anchoring — decisione owner). Scartati: offset a caratteri (si rompono a ogni edit), posizioni ProseMirror (legate alla versione del doc), re-anchoring diff-based (fuori scope).

**Come:**
- `src/lib/anchors.ts` — funzioni pure: `findOccurrences`, `resolveAnchor`, mapper quote→range ProseMirror (match sulla proiezione plain-text del doc; la quote è salvata come markdown per il display). Unit test pesanti: quote duplicate, selezioni a cavallo paragrafo/lista, orfani, unicode.
- Highlight: plugin ProseMirror di inline decorations nel `RichTextViewer` (tinta `bg-neutral-200/70`); le decorations non alterano il doc → formattazione originale intatta e range cross-blocco gratis.
- Creazione: su selezione, BubbleMenu "Commenta" cattura `{field, quote, occurrence}` e mette il form della sidebar in modalità ancorata.
- Server: `addComment` valida che la quote risolva nella proposta corrente (business rule nel service, RLS backstop).

### 4. Autorizzazione edit + ri-valutazione AI (migration 0013, owner-locked, security-sensitive)

Le RPC `begin/apply/fail_ai_evaluation` (oggi `is_admin()`-only, 0010/0011) vengono rilassate a `is_admin() OR (proposer AND status = 'in_valutazione')` via helper `can_run_ai_evaluation(p_id)`. Cristallizzazione: da `approvata` in poi niente edit né nuovi commenti — guard nel Server Action + backstop RLS/trigger nella stessa migration. Il corpo post-auth di `evaluateProposal` viene estratto in `src/lib/ai/runEvaluation.ts`, chiamato sia dall'action admin sia da `updateProposal` (solo se status = `in_valutazione` e i campi testuali sono effettivamente cambiati — confronto stringhe, evita chiamate Claude inutili). Fallimento eval non bloccante come oggi.

## Consequences

**Positive**
- Zero migrazione dati per il rich text; pipeline AI intatta; fallback leggibile ovunque.
- Una sola libreria per editing, rendering di lettura e highlight; ancore robuste a edit non correlati.
- Sanitizzazione semplice: markdown come unico formato persistito, schema editor vincolato.

**Negative / a cosa ci leghiamo**
- ~150–250 KB gz di JS client sulla pagina dettaglio (mitigato: dynamic import, solo detail).
- Lock-in all'ecosistema ProseMirror/Tiptap per editor, viewer e highlight.
- Il mapper quote→range (`src/lib/anchors.ts`) è il pezzo più delicato e va coperto a test.
- Stabilità di serializzazione tiptap-markdown da verificare (round-trip test) prima della Fase D.
- Modificare un testo ancorato orfana i commenti relativi — by design, accettato.
- 0013 allarga la superficie: l'autore può muovere `ai_eval_status` sulla propria proposta mentre è `in_valutazione`; la condizione proposer+status la tiene stretta.

## Source

[RFC-004](../rfc/RFC-004-proposals-rework.md); decisioni owner del 2026-07-03 (WYSIWYG + markdown paste entrambi, orfani senza re-anchoring, edit in `nuova`/`in_valutazione` con re-eval solo in `in_valutazione`, cristallizzazione da `approvata`, pannello largo ovunque).

## If we were starting today

Sceglieremmo comunque markdown come formato canonico (LLM-friendly, portabile). Sull'editor, l'alternativa reale era Lexical: la bilancia pende su Tiptap per il paste markdown pronto e le decorations; se il bundle diventasse un problema si può valutare il code-splitting più aggressivo prima di cambiare libreria.
