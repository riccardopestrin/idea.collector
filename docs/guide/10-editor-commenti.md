# 10. Editor e commenti

Il testo delle proposte è rich-text, ma salvato come markdown; i commenti possono
essere **ancorati** a una selezione esatta. La decisione è
[ADR-0005](../architecture/adr/0005-tiptap-editor-anchored-comments.md).

## 10.1 L'editor Tiptap

[`src/components/editor/`](../../src/components/editor/):

- [`extensions.ts`](../../src/components/editor/extensions.ts) definisce **un solo
  schema** per editor e viewer: `StarterKit` con heading 1–3, bold, italic,
  elenchi. Tutto il resto è **disattivato** (blockquote, code/codeBlock, hr,
  strike, underline, link). `Markdown.configure({ html: false })` → **niente raw
  HTML**: lo storage è markdown attraverso questo schema vincolato.
- `RichTextEditor` (editing), `RichTextField` (campo di form), `RichTextViewer`
  (sola lettura) condividono lo schema.

Perché uno schema così ristretto: meno superficie = meno ambiguità
nell'ancoraggio (vedi sotto) e meno rischi di injection nel testo passato all'AI.

## 10.2 Ancoraggio dei commenti

Un commento può essere legato a un punto preciso del `description` o del
`problem` (`ANCHOR_FIELDS`). L'ancora è una coppia:

> **(testo citato esatto, indice di occorrenza 1-based)**

Es: "la seconda occorrenza di *onboarding*". Niente offset fragili: se il testo
cambia intorno, l'ancora regge finché quella occorrenza della quote esiste.

Il meccanismo vive in due punti che **devono produrre la stessa proiezione
plain-text**:

- **Lato client** ([`anchoring.ts`](../../src/components/editor/anchoring.ts)):
  `projectDoc` proietta il documento ProseMirror in plain-text con una mappa
  offset→posizione PM; `captureSelection` cattura `{quote, occurrence}` dalla
  selezione; `plainRangeToPm` ricostruisce le posizioni PM per le decorazioni.
- **Lato server** ([`src/lib/anchors.ts`](../../src/lib/anchors.ts)):
  `markdownToPlainText` replica **la stessa proiezione** partendo dal markdown
  persistito (regex-based, non un parser completo: sintassi fuori schema degrada
  a commento non ancorato); `resolveAnchor` trova l'N-esima occorrenza della
  quote (`null` = ancora orfana).

**L'invariante chiave**: le due proiezioni (`markdownToPlainText` ↔ `projectDoc`)
devono combaciare, altrimenti un'ancora catturata sul client non si risolve sul
server. È coperta da test round-trip (`anchoring.test.ts`,
`anchorProjection.test.ts`, `anchors.test.ts`). L'ancora viene risolta
server-side dentro `addComment`.

## 10.3 Regole dei commenti

- Si commenta **in ogni stato** della proposta (migration 0031), su un
  passaggio non promosso.
- L'autore può **modificare il `body`** e **cancellare** il proprio commento
  (finché non è `accepted`); l'admin di progetto può cancellare i commenti altrui.
- Il limite è 1–4000 char (trim).

UI: [`CommentForm`](../../src/components/detail/CommentForm.tsx),
[`CommentsSidebar`](../../src/components/detail/CommentsSidebar.tsx),
[`ProposalDiscussion`](../../src/components/detail/ProposalDiscussion.tsx).

## 10.4 Promozione a contributo (co-autore)

Un commento può essere elevato a **contributo**: il commentatore diventa
co-autore della proposta. Ciclo (RPC con compare-and-set, migration 0016):

1. `request_comment_promotion` — l'**autore** del commento chiede la promozione
   (`none` → `pending`). Non si applica ai commenti del proposer.
2. `resolve_comment_promotion(accept)` — il **proposer o l'admin** accetta o
   rifiuta (`pending` → `accepted`/`none`).
3. `revoke_comment_promotion` — autore/proposer/admin revocano (`accepted` →
   `none`).

Conseguenze di un contributo `accepted`:

- L'autore compare tra i `contributors` della proposta.
- **Non può votare** quella proposta (parte in causa).
- I contributi accettati fanno parte dell'input della valutazione AI
  ([capitolo 9](09-ai-integrazioni.md)).

Server Action in [`proposals/actions.ts`](../../src/app/proposals/actions.ts).

---

Precedente: [← 9. AI e integrazioni](09-ai-integrazioni.md) · Prossimo: [11. Testing →](11-testing.md)
