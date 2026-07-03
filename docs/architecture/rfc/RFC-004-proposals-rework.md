# RFC-004 — Rework pagina proposte

**Stato:** proposta — decisioni tecniche fissate in [ADR-0005](../adr/0005-tiptap-editor-anchored-comments.md).
**Data:** 2026-07-03
**Autore:** Riccardo (con Claude)

## Context

La pagina proposte oggi è minimale: creazione su pagina separata (`/proposals/new`), corpo in plain text (`whitespace-pre-wrap`), commenti in fondo al pannello, nessuna possibilità di edit dopo la creazione. Obiettivi del rework:

1. Creazione proposta in overlay (come il dettaglio), non pagina separata.
2. Corpo rich-text stile Note iOS (heading, bold, italic, elenchi) **e** paste di markdown auto-formattato.
3. Commenti in colonna laterale invece che in fondo.
4. Commenti ancorati a selezioni di testo ("stile piani di Claude"): selezione evidenziata in grigio mantenendo la formattazione originale, commento a lato con la citazione.
5. Edit dell'autore, con ri-valutazione AI ad ogni save quando la proposta è "In Valutazione".

Decisioni già prese:

- Editor WYSIWYG **e** paste di markdown auto-formattato (entrambi).
- Commenti ancorati diventano orfani se il testo citato cambia (nessun re-anchoring; badge "testo modificato").
- Edit consentito in `nuova` (senza AI) e `in_valutazione` (AI riparte ad ogni save). **Da `approvata` in poi la proposta si cristallizza: niente edit e niente nuovi commenti.**
- Pannello più largo ovunque (modal e pagina piena) per ospitare i commenti a lato.

Le scelte di dipendenza/storage/anchoring sono nell'ADR: **Tiptap** (`@tiptap/react`, `@tiptap/starter-kit`, `tiptap-markdown`), **markdown come storage canonico** nelle colonne esistenti `description`/`problem`, **anchoring exact-quote + occurrence index**.

## Fasi (ciascuna shippabile; A/B/C indipendenti, D richiede B+C, E richiede B)

### Fase A — "Nuova proposta" in overlay

- Nuovo intercepting route `src/app/@modal/(.)proposals/new/page.tsx` che riusa `DetailModal` (pattern identico a `@modal/(.)proposals/[id]`).
- Estrarre il form da `src/app/proposals/new/page.tsx` in `src/components/proposals/NewProposalForm.tsx` (client, `useActionState` + `createProposal` invariati); la pagina piena resta come fallback per navigazione diretta.
- Il bottone "Nuova proposta" passa da `<a href>` (hard-nav, messo apposta per *evitare* l'interception) a `<Link>` per attivarla.
- `createProposal` mantiene `redirect("/")`; se dal modal si comporta male, ritornare successo e fare `router.back()` client-side.
- Test RTL: form nel dialog, submit, stato errore.

### Fase B — Editor Tiptap + storage markdown + rendering lettura

- Dipendenze (dopo accettazione ADR): `pnpm add @tiptap/react @tiptap/starter-kit tiptap-markdown`.
- `src/components/editor/RichTextEditor.tsx` — StarterKit minimale (heading 1–3, bold, italic, bulletList, orderedList; il resto disattivato), toolbar minimale, `tiptap-markdown` con `html: false`. Scrive il markdown serializzato in un `<input hidden name=...>` così i server action a `formData` restano invariati.
- `src/components/editor/RichTextViewer.tsx` — istanza Tiptap read-only, stesse estensioni; usato in `ProposalPanel` per description/problem.
- Entrambi client-only: `next/dynamic` `ssr: false` + `immediatelyRender: false`; fallback plain text `whitespace-pre-wrap`.
- `NewProposalForm`: textarea → `RichTextEditor`. Cap lunghezza server-side (~20k chars) in `createProposal` se assente.
- Sanitizzazione: si persiste solo la stringa markdown; schema vincolato; nessun `dangerouslySetInnerHTML`.
- Test RTL: digitazione → hidden input contiene markdown; paste markdown → formattato; viewer renderizza heading/liste/bold. Test round-trip load→save no-op (vedi Rischi).

### Fase C — Pannello largo + commenti a lato

- `src/components/detail/DetailModal.tsx`: `max-w-2xl` → `max-w-6xl` con guardia viewport (`calc(100vw-2rem)`).
- `src/components/detail/ProposalPanel.tsx`: grid `lg:grid-cols-[1fr_20rem]` (contenuto | commenti), colonna singola sotto `lg`. Estrarre lista commenti + `CommentForm` in `src/components/detail/CommentsSidebar.tsx`.
- `src/app/proposals/[id]/page.tsx`: allargare il container.

### Fase D — Commenti ancorati + highlight

- **Migrazione 0012 (OWNER-LOCKED, richiede review Riccardo)** `supabase/migrations/0012_comment_anchors.sql`:

  ```sql
  alter table public.comments
    add column anchor_field text check (anchor_field in ('description','problem')),
    add column anchor_text text check (char_length(anchor_text) between 1 and 2000),
    add column anchor_occurrence integer check (anchor_occurrence >= 1),
    add constraint comments_anchor_all_or_none check (
      (anchor_field is null) = (anchor_text is null)
      and (anchor_field is null) = (anchor_occurrence is null));
  ```

- `src/lib/anchors.ts` — funzioni pure: `findOccurrences`, `resolveAnchor`, e il mapper quote→range ProseMirror (match sulla proiezione plain-text del doc; quote salvata come markdown per il display). È il pezzo più delicato → unit test pesanti (quote duplicate, selezione che attraversa paragrafo+lista, orfani, unicode).
- `RichTextViewer`: plugin ProseMirror con **inline decorations** sui range risolti (tinta grigia `bg-neutral-200/70`; le decorations non alterano il doc, quindi la formattazione originale — bold, elenchi — resta intatta e i range attraversano i blocchi naturalmente). Su selezione: affordance flottante "Commenta" (BubbleMenu) che cattura `{field, quote, occurrence}` e mette la sidebar in modalità "ancorato".
- `CommentsSidebar`/`CommentForm`: modalità ancorata con la citazione renderizzata (mini viewer read-only) sopra la textarea + Annulla; i commenti ancorati mostrano il blocco citato; ancora non risolta → badge "testo modificato".
- `addComment` (`src/app/proposals/actions.ts`): campi anchor opzionali dal formData; validazione server: field ∈ enum, occurrence ≥ 1, e la quote deve risolversi nella proposta corrente (`resolveAnchor`).
- `src/lib/proposals.ts`: select commenti esteso; `getProposalDetail` calcola `resolved: boolean` per commento ancorato server-side.

### Fase E — Edit autore + ri-valutazione AI + cristallizzazione

- **Migrazione 0013 (OWNER-LOCKED, security-sensitive)**: le RPC `begin/apply/fail_ai_evaluation` oggi hard-checkano `is_admin()` (verificato in 0010/0011) → rilassare a `is_admin() OR (proposer AND status = 'in_valutazione')` via helper `can_run_ai_evaluation(p_id)`. Inoltre (cristallizzazione): backstop RLS/trigger che blocca insert di commenti e update dell'autore quando lo status è oltre `in_valutazione`.
- Nuovo `src/app/proposals/[id]/actions.ts` → `updateProposal(proposalId, _prev, formData)`: autorizzazione nel service (proposer o admin; status ∈ {`nuova`,`in_valutazione`}, il trigger `enforce_proposal_privileged_columns` resta backstop per le colonne privilegiate); validazione condivisa con `createProposal` (estratta in `src/lib/validation/proposal.ts`); update, poi **se status = `in_valutazione` e i campi testuali sono effettivamente cambiati** (confronto stringhe, evita chiamate Claude inutili) rilancia la valutazione.
- Refactor: il corpo post-auth di `evaluateProposal` → `src/lib/ai/runEvaluation.ts` (`runEvaluation(supabase, proposalId, force?)`); l'action admin resta wrapper sottile; `updateProposal` chiama `runEvaluation`. Il guard `in_corso` della RPC serializza i run concorrenti; il fallimento eval NON fa fallire il save (semantica non-bloccante esistente).
- `addComment`: guard di status — commenti consentiti solo in `nuova`/`in_valutazione`; `CommentsSidebar` nasconde il form negli stati cristallizzati.
- `ProposalPanel`: bottone "Modifica" (proposer/admin, solo status editabili); edit mode con `RichTextEditor` + input titolo/link, `useActionState(updateProposal)`, Salva/Annulla. Riusare `Field`/`SubmitButton`.
- Test action (mock supabase come `actions.test.ts` esistente): non-autore rifiutato, status sbagliato rifiutato, save in `in_valutazione` triggera eval una volta, eval fallita non fa fallire il save, commento rifiutato su proposta cristallizzata. RTL: toggle edit mode, campi precompilati.

## Rischi

- **Tiptap SSR (Next 16)**: hydration mismatch → client-only + `immediatelyRender: false`, fallback plain text al primo paint.
- **Stabilità serializzazione markdown**: load→save senza modifiche deve essere no-op, altrimenti le ancore si orfanizzano spuriamente → test round-trip in Fase B.
- **Modal largo su mobile**: cap al viewport, colonne che collassano sotto `lg`, verificare scroll del `<dialog>` nativo.
- **Costo eval su save ripetuti**: nessun debounce (lean); skip se i campi non sono cambiati; guard `in_corso` serializza.
- **Migrazioni 0012/0013 owner-locked**: 0013 è security-sensitive (autore può muovere `ai_eval_status` sulla propria proposta in `in_valutazione`) — condizione proposer+status la tiene stretta; da rivedere con l'owner prima del merge.

## Verifica end-to-end

- `pnpm test` verde e ESLint pulito a ogni fase.
- Dev server: creare proposta dal modal, incollare markdown nell'editor e verificarne la formattazione, selezionare testo (anche a cavallo di paragrafo+elenco) e commentare, verificare highlight grigio e badge "testo modificato" dopo un edit, verificare che il save in `in_valutazione` rilanci l'eval (spinner `EvalStatusCue`) e che da `approvata` in poi edit e commenti siano bloccati.

## Fuori scope (YAGNI)

Threading/edit/delete commenti, versioning proposte, re-anchoring, editing collaborativo, upload immagini nell'editor.
