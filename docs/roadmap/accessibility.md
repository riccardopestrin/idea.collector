**Last updated:** 2026-09-09

# Accessibility

Registro durevole delle issue di accessibilità rinviate. Le finding a11y sollevate da `Software Reviewer` / `Review Reviewer` vengono rinviate qui di default (non corrette nella stessa sessione) — vedi [`.claude/rules/accessibility-findings-to-roadmap.md`](../../.claude/rules/accessibility-findings-to-roadmap.md).

Ogni voce ha un ID stabile `[A11Y-NN]`. **Gli ID non vengono mai riusati**: quando una issue è risolta, la voce si sposta in "Issue risolti" mantenendo lo stesso ID.

## Issue aperti

### [A11Y-01] `<html lang="en">` ma tutta la UI è in italiano

**Status:** non fissato — flaggato il 2026-07-01 durante review dell'intero codebase (branch `Bugfixes001`).

#### Dove
- `src/app/layout.tsx:27`

#### Cosa c'è di sbagliato
Il root layout dichiara `lang="en"` mentre tutto il testo utente (titoli, label, messaggi `role="status"`/`role="alert"`) è in italiano.

#### Impatto user-visible
Gli screen reader pronunciano l'italiano con fonetica inglese: i messaggi di stato ed errore risultano quasi incomprensibili per gli utenti di AT. Impatto alto, fix banale.

#### Fix raccomandato
Cambiare in `lang="it"` in `src/app/layout.tsx`.

#### Cronologia
- 2026-07-01 — Flaggato durante review completa del codebase (`Bugfixes001`).

### [A11Y-02] Hit target del bottone "×" (cancella ricerca) sotto la soglia touch

**Status:** non fissato — flaggato il 2026-07-01 durante review dell'intero codebase (branch `Bugfixes001`).

#### Dove
- `src/components/filters/ProposalFilters.tsx:32-39`

#### Cosa c'è di sbagliato
Il bottone di cancellazione della ricerca è un glifo `×` `text-lg leading-none` senza padding né dimensione minima: target effettivo ~18×18 px, contro i 44 px raccomandati per il touch. L'`aria-label` è presente e corretto; il problema è solo dimensionale.

#### Impatto user-visible
Utenti touch e utenti con motricità ridotta faticano a centrare il bottone. Severità media.

#### Fix raccomandato
Portare l'area cliccabile ad almeno 44 px mantenendo il glifo centrato (es. `flex h-11 w-11 items-center justify-center` ricalibrando l'offset assoluto, oppure padding + margine negativo).

#### Cronologia
- 2026-07-01 — Flaggato durante review completa del codebase (`Bugfixes001`).

### [A11Y-03] Drag da tastiera della board impraticabile (25px per pressione)

**Status:** non fissato — flaggato il 2026-07-02 durante review della PR `mainBoardlayoutfromADR0002`.

#### Dove
- `src/components/board/Board.tsx:38` (`useSensor(KeyboardSensor)` senza `coordinateGetter`)
- `src/lib/tokens.ts` (`BOARD_COLUMN_WIDTH = "w-80"`, `BOARD_GAP = "gap-6"`)

#### Cosa c'è di sbagliato
Il `KeyboardSensor` usa il coordinate getter di default di dnd-kit: 25px per pressione di freccia. Con colonne da 320px + gap 24px servono ~14 pressioni per attraversare una colonna, senza snapping sui droppable. Il drag da tastiera esiste (le card sono focusabili, `role="button"`, Space per prendere/rilasciare) ma è di fatto inutilizzabile su una board a 7 colonne.

#### Impatto user-visible
Gli admin che usano solo la tastiera non riescono realisticamente a spostare le proposte — l'interazione principale della pagina. Severità alta per utenti keyboard-only.

#### Fix raccomandato
`coordinateGetter` custom che salta tra i centri delle colonne (supportato da `@dnd-kit/core`, non serve `@dnd-kit/sortable`), oppure fallback non-drag (menu/`<select>` "Sposta in →" che chiama la stessa `updateProposalStatus`).

#### Cronologia
- 2026-07-02 — Flaggato durante review chain della board (`mainBoardlayoutfromADR0002`), finding [4] confermato dal `Review Reviewer`.

### [A11Y-04] Bottone elimina "×" sulla card: hit target sottodimensionato e contrasto basso a riposo

**Status:** non fissato — flaggato il 2026-07-02 durante review della PR `ideaAndEliminationArchitecture`.

#### Dove
- `src/components/cards/ProposalCard.tsx:16-26`

#### Cosa c'è di sbagliato
Il bottone di eliminazione è un glifo `×` con `p-1.5` (~6px di padding): target effettivo ben sotto i 44px touch. Lo stato a riposo `text-foreground/40` (40% di opacità) è plausibilmente sotto il contrasto WCAG AA per un controllo interattivo. Il resto della semantica è corretto (`aria-label` col titolo, `<button>` reale, `stopPropagation` evita che Enter/Space attivino il drag, `<dialog>` nativo con focus trap/Esc).

#### Impatto user-visible
Utenti touch rischiano di mancare il bottone e avviare un drag; utenti ipovedenti possono non percepire il controllo. Severità media.

#### Fix raccomandato
Area interattiva ≥40–44px (padding + margine negativo per non alterare il layout della card, stesso approccio raccomandato per [A11Y-02]); resting `text-foreground/60` e stile `focus-visible` marcato.

#### Cronologia
- 2026-07-02 — Flaggato durante review chain di `ideaAndEliminationArchitecture`, confermato dal `Review Reviewer`.

### [A11Y-05] Controlli interattivi annidati dentro la card draggable (`role="button"`)

**Status:** non fissato — flaggato il 2026-07-02 durante review della PR `step4ideaPanels`.

#### Dove
- `src/components/cards/ProposalCard.tsx` (Link del titolo + bottone "×")
- `src/components/board/Board.tsx` (`DraggableCard`: spread di `{...attributes}` dnd-kit sulla `<li>`)

#### Cosa c'è di sbagliato
dnd-kit assegna `role="button"` e `tabIndex=0` alla `<li>` draggable; al suo interno ora vivono un `<a>` (apre il dettaglio) e un `<button>` (elimina). Controlli interattivi annidati dentro un altro controllo sono invalidi per gli screen reader, e gli `stopPropagation` su `onKeyDown` rendono ambiguo il comportamento da tastiera ("Enter qui apre o trascina?").

#### Impatto user-visible
Utenti screen-reader/tastiera non distinguono in modo affidabile "apri dettaglio" da "inizia drag" sulla card. Si somma a [A11Y-03]/[A11Y-04].

#### Fix raccomandato
Spostare listener/attributi dnd-kit su una **drag handle dedicata** dentro la card, lasciando la `<li>` non interattiva: titolo-link, bottone elimina e handle diventano tre controlli fratelli, non annidati. Risolve alla radice anche l'ambiguità tastiera di [A11Y-03].

#### Cronologia
- 2026-07-02 — Flaggato durante review chain di `step4ideaPanels`, confermato dal `Review Reviewer`.

### [A11Y-06] `<dialog>` del pannello dettaglio senza nome accessibile

**Status:** non fissato — flaggato il 2026-07-02 durante review della PR `step4ideaPanels`.

#### Dove
- `src/components/detail/DetailModal.tsx`
- `src/components/form/ConfirmDialog.tsx` — dialog di conferma condiviso da `DeleteSection`, `DeleteProposalDialog` e `RiceVoteForm` (stesso gap: nessun `aria-labelledby`)

#### Cosa c'è di sbagliato
Il `<dialog>` del dettaglio proposta non ha `aria-labelledby`/`aria-label`: all'apertura lo screen reader annuncia un dialogo senza nome. Il resto è corretto (nativo `showModal()` → focus trap ed Esc gratis).

#### Impatto user-visible
Utenti screen-reader non sanno quale proposta si è aperta finché non esplorano il contenuto. Severità bassa/media.

#### Fix raccomandato
`aria-labelledby` sul `<dialog>` puntato all'`<h1>` del `ProposalPanel` (dare un id stabile al titolo, es. `proposal-title`). Per i dialog di conferma: `useId()` + `aria-labelledby` sull'`<h2>` dentro `ConfirmDialog`, una volta per tutti e tre.

#### Cronologia
- 2026-07-02 — Flaggato durante review chain di `step4ideaPanels`, confermato dal `Review Reviewer`.
- 2026-09-08 — Esteso ai dialog di conferma durante la review chain della sessione latenza/getClaims: il nuovo dialog del voto RICE ha lo stesso gap; con l'estrazione di `ConfirmDialog` il fix è in un punto solo.

### [A11Y-07] Highlight del testo citato attivabile solo col mouse (hover) sui commenti altrui

**Status:** non fissato — flaggato il 2026-07-03 durante review della PR `commentPartImprovements`.

#### Dove
- `src/components/detail/CommentsSidebar.tsx` (`CommentItem`: `onMouseEnter`/`onMouseLeave` + `onFocus`/`onBlur` sulla `<li>` non interattiva)
- `src/components/detail/ProposalDiscussion.tsx` (`hoveredId` → `anchorsFor` → highlight nel `RichTextViewer`)

#### Cosa c'è di sbagliato
L'evidenziazione del passaggio citato è pilotata dall'hover del mouse su una `<li>` non interattiva. `onFocus`/`onBlur` scattano solo quando un discendente focusabile riceve il focus, e gli unici discendenti focusabili (bottoni Modifica/Elimina) esistono soltanto sui commenti del proprio utente (`mine`). Per i commenti scritti da altri — il caso comune in una discussione — non c'è nulla di focusabile, quindi un utente da tastiera o screen-reader non può mai attivare l'highlight che il mouse ottiene.

#### Impatto user-visible
Una feature centrale del pannello (vedere quale passaggio cita un commento) è di fatto inaccessibile da tastiera/AT per la maggioranza dei commenti. Severità media.

#### Fix raccomandato
Quando `comment.anchor_text` è presente, rendere focusabile la `<li>` (o la `<blockquote>` della citazione) con `tabIndex={0}` + `role`/`aria-label` appropriati (es. "Evidenzia il passaggio citato"), così il focus raggiunge un elemento che emette `onFocus`/`onBlur` anche sui commenti altrui.

#### Cronologia
- 2026-07-03 — Flaggato durante review chain di `commentPartImprovements`, confermato dal `Review Reviewer` (finding [2]).

### [A11Y-08] Slider di voto RICE senza nome accessibile né valore annunciato

**Status:** non fissato — flaggato il 2026-07-05 durante review della PR `riceForAllUsers`.

#### Dove
- `src/components/detail/RiceVoteForm.tsx:32-41` (`Slider`)

#### Cosa c'è di sbagliato
Ogni `<input type="range">` è avvolto da una `<label>` che contiene sia il testo del parametro sia il valore corrente in una `<span>` separata. L'associazione nome è implicita ma il valore numerico live non è legato al controllo: non c'è `aria-valuetext` (né un `aria-label` che includa il valore), quindi uno screen reader annuncia solo la posizione grezza dello slider senza il contesto del parametro/valore mostrato visivamente.

#### Impatto user-visible
Utenti screen-reader che compilano il voto non sentono in modo affidabile quale parametro stanno regolando e a quale valore; i range input sono inoltre faticosi da operare con alcune AT. Severità media (percorso di input, non solo lettura).

#### Fix raccomandato
Dare a ogni `<input type="range">` un `aria-label` esplicito col nome del parametro e aggiornare `aria-valuetext` col valore corrente (es. `aria-label="Impact"`, `aria-valuetext={String(value)}`). Valutare anche input numerici alternativi per chi non usa il mouse.

#### Cronologia
- 2026-07-05 — Flaggato durante review chain di `riceForAllUsers` (Software Reviewer).

### [A11Y-09] Bottoni azione dei commenti senza nome accessibile per-commento

**Status:** non fissato — flaggato il 2026-07-08 durante review della PR `commentPromotion`.

#### Dove
- `src/components/detail/CommentsSidebar.tsx` — bottoni "Proponi come contributo", "Accetta", "Rifiuta", "Revoca partecipazione" (`PromotionButton`) e i preesistenti "Modifica"/"Elimina" in `CommentItem`

#### Cosa c'è di sbagliato
Con più commenti pending/accepted nella sidebar, ogni bottone espone solo il testo nudo ("Accetta", "Rifiuta", …) senza indicare su quale commento agisce: uno screen reader che tabba tra i controlli sente etichette ripetute identiche.

#### Impatto user-visible
Proposer/admin che usano screen reader non possono distinguere in modo affidabile quale candidatura stanno accettando o rifiutando quando c'è più di un commento candidato. Severità media (percorso decisionale, non solo lettura). Nota: la PR mitiga parzialmente [A11Y-07] aggiungendo discendenti focusabili anche ai commenti non-`mine`, senza risolverla.

#### Fix raccomandato
`aria-label` contestualizzato su ogni bottone per-commento, es. `aria-label={"Accetta il contributo di " + personLabel(comment.author)}` — applicarlo anche ai preesistenti Modifica/Elimina.

#### Cronologia
- 2026-07-08 — Flaggato durante review chain di `commentPromotion` (Software Reviewer [5], confermato da Review Reviewer).

### [A11Y-10] `EvalStatusCue` annuncia "Valutazione AI" anche accanto a "Scansione duplicati"

**Status:** non fissato — flaggato il 2026-07-08 durante review della PR `ideaChecker`.

#### Dove
- `src/components/evaluation/EvalStatusCue.tsx:11,20` — `aria-label` hardcoded "Valutazione AI in corso/completata/fallita"
- `src/components/detail/ProposalPanel.tsx` — il cue è riusato accanto al titolo "Scansione duplicati" (RFC-006)

#### Cosa c'è di sbagliato
Il cue di stato (rotella/pallino) espone etichette accessibili fisse sulla valutazione AI, ma nella sezione dello scan duplicati descrive lo stato dello scan: uno screen reader annuncia la feature sbagliata.

#### Impatto user-visible
Utenti screen reader sentono "Valutazione AI in corso" mentre visivamente il contesto è la scansione duplicati — informazione fuorviante ma solo di lettura (nessun percorso decisionale bloccato). Severità bassa.

#### Fix raccomandato
Prop opzionale su `EvalStatusCue` per la label (es. `kind: "eval" | "scan"` o `labelPrefix`), passata dal call site dello scan in `ProposalPanel` ("Scansione duplicati in corso/completata/fallita").

#### Cronologia
- 2026-07-08 — Flaggato durante review chain di `ideaChecker` (Software Reviewer, confermato da Review Reviewer).

### [A11Y-11] Feedback spunta/divieto del drag solo visivo (colore + icone `aria-hidden`)

**Status:** non fissato — flaggato il 2026-07-09 durante review della PR `cardDirections`.

#### Dove
- `src/components/board/Column.tsx` — ring verde/rosso + `CheckIcon`/`NoEntryIcon`, entrambe `aria-hidden="true"`, nessun testo alternativo
- `src/components/board/Board.tsx` — `columnDropHint` calcola valido/invalido; `DndContext` senza `announcements`, nessuna regione `aria-live`; drop invalido torna indietro in silenzio (`handleDragEnd`)

#### Cosa c'è di sbagliato
La macchina a stati (branch `cardDirections`) segnala le colonne target valide/vietate durante il drag solo con colore (ring verde/rosso) e due icone `aria-hidden`. Con il `KeyboardSensor` abilitato, un utente da tastiera può iniziare un drag ma non percepisce quali colonne siano target leciti; uno screen reader non riceve nulla e il drop vietato torna indietro senza feedback non-visivo.

#### Impatto user-visible
Utenti tastiera/screen reader non distinguono i target consentiti da quelli vietati: l'interazione primaria della board resta inaccessibile via AT. Si somma a [A11Y-03] (drag da tastiera già impraticabile). Severità media.

#### Fix raccomandato
Aggiungere `announcements` al `DndContext` di dnd-kit (onDragOver → "consentito/non consentito" per il target) e/o una regione `aria-live` che rifletta `dropHint`, più un segnale testuale/`aria` non affidato al solo colore sulle colonne. Considerare insieme a [A11Y-03] (drag handle dedicata).

#### Cronologia
- 2026-07-09 — Flaggato durante review chain di `cardDirections` (Software Reviewer, confermato da Review Reviewer).

### [A11Y-12] `aria-pressed` sui chip-link del filtro stati (attributo non valido su `link`)

**Status:** non fissato — flaggato il 2026-09-07 durante review della PR `graphicDesign`.

#### Dove
- `src/components/filters/ProposalFilters.tsx` — i chip "Tutti gli stati" e uno per stato sono `<Link>` (`<a href>`) con `aria-pressed={active}`
- `src/components/filters/ProposalFilters.test.tsx` — quattro asserzioni su `aria-pressed` da spostare insieme al fix

#### Cosa c'è di sbagliato
`aria-pressed` è ammesso solo sul ruolo `button`; su un `link` è un attributo proibito (ARIA in HTML), quindi gli screen reader lo ignorano o lo annunciano in modo incoerente. Lo stato "selezionato / non selezionato" dei chip cumulabili in OR non arriva agli utenti AT, che vedono solo una lista di link.

#### Impatto user-visible
Utenti screen reader non sanno quali stati siano attivi nel filtro della classifica; gli audit automatici (axe) segnalano ARIA non valida. Severità media.

#### Fix raccomandato
O `aria-current="true"` sui chip attivi (valido sui link, annuncia "corrente"), oppure trasformare i chip in `<button type="submit" name="status" value="…">` dentro il form GET, dove `aria-pressed` diventa legittimo (attenzione al submit di default con Invio nel campo di ricerca). Aggiornare le asserzioni del test di conseguenza.

#### Cronologia
- 2026-09-07 — Flaggato durante review chain di `graphicDesign` (Software Reviewer, confermato da Review Reviewer).

### [A11Y-13] Regioni di scroll interno (home, classifica) senza nome accessibile né focus da tastiera

**Status:** non fissato — flaggato il 2026-09-09 durante review dello scroll interno di home/classifica (`main`).

#### Dove
- `src/app/page.tsx` — `<div className={scrollRegionClass}>` attorno a `ProjectList`
- `src/app/projects/[projectId]/ranking/page.tsx` — stesso wrapper attorno alla `<ol>` della classifica
- `src/lib/tokens.ts` — `scrollRegionClass`

#### Cosa c'è di sbagliato
I wrapper `overflow-y-auto` sono `<div>` anonimi. Contengono link focalizzabili, quindi Chrome non li rende scroller focalizzabili in modo implicito; in Firefox da tastiera si scorre solo tabulando fra le card. Gli screen reader non annunciano l'inizio di una regione scorrevole. Il `KeyboardSensor` di dnd-kit non è impattato.

#### Impatto user-visible
Utenti tastiera e screen reader: nessun contenuto irraggiungibile (il tab porta ogni card in vista), ma scroll libero impossibile e nessun annuncio della regione. Severità bassa.

#### Fix raccomandato
`role="region"` + `aria-label` da `STRINGS` (e `tabIndex={0}` se conta lo scroll da tastiera in Firefox) sul wrapper, oppure rendere il wrapper la stessa `<ul>`/`<ol>` della lista.

#### Cronologia
- 2026-09-09 — Flaggato durante review chain dello scroll interno di home/classifica (Software Reviewer, confermato da Review Reviewer).

## Issue risolti

_Nessuna issue risolta._
