# 14. Design language

**Brutalista, industriale, minimale.** Questo capitolo è il riferimento visivo per
chiunque tocchi la UI. La fonte di verità è il **codice**: la palette e le regole
globali in [`src/app/globals.css`](../../src/app/globals.css), le class-string
condivise in [`src/lib/tokens.ts`](../../src/lib/tokens.ts), le icone in
[`src/components/icons.tsx`](../../src/components/icons.tsx). Esiste anche una
pagina di riferimento navigabile,
[`docs/design/design-language.html`](../design/design-language.html) (aprila nel
browser): se cambi un valore nel codice, aggiorna anche quella.

## 14.1 I principi

1. **Quattro colori, niente gradienti.** Nessuna sfumatura, nessuna ombra
   sfocata, nessuna opacità decorativa. La trasparenza serve solo al testo
   secondario (ink al 50–70%).
2. **Angoli vivi.** Mai `border-radius`. Bordi pieni 1px ink separano tutto.
3. **Rilievo duro.** L'unica ombra ammessa è un offset pieno: `4px` per le card al
   hover (`--shadow-hard`), `8px` per modali e dialog (`--shadow-hard-lg`).
4. **Niente emoji, niente caratteri decorativi.** Le icone sono SVG inline con
   stroke 2px e cap quadrati.
5. **La regola dell'hover.** Trasparente → ink; ink → paprika; i link testuali →
   paprika. Il bottone paprika (distruttivo) fa l'opposto e vira all'ink.
   Transizione 150ms, disattivata sotto `prefers-reduced-motion`.
6. **Etichette in mono maiuscolo.** Titoli di sezione, meta, bottoni e tag usano
   IBM Plex Mono maiuscolo con letter-spacing. Il testo corrente usa IBM Plex Sans.
7. **Overlay, non breadcrumb.** Dettaglio proposta, nuova proposta e profilo si
   aprono in una finestra sopra la pagina corrente; chiudendola resti dov'eri
   (le intercepting routes del [capitolo 7](07-proposte-e-board.md)).

## 14.2 La palette

Quattro colori fissi, definiti come CSS custom property in `globals.css`.
**Nessuna variante dark** (scelta deliberata).

| Nome | Hex | Uso |
|---|---|---|
| **Ink** | `#050609` | Testo, bordi, bottone primario, thumb della scrollbar. |
| **Paprika** | `#E3571B` | Accento, hover, errori/warning, focus ring, selezione del testo, "Idea" nel wordmark. |
| **Paper** | `#FFFCF4` | Sfondo di tutto: pagina, card, modali, controlli. |
| **Dust** | `#D1D1D1` | Divisori secondari, evidenziazione dei passaggi citati nei commenti, placeholder di caricamento. |

In Tailwind: `ink`, `paprika`, `paper`, `dust`. Gli alias semantici
`foreground`, `background`, `border`, `danger` risolvono rispettivamente a ink,
paper, ink, paprika.

## 14.3 La tipografia

Tre famiglie, iniettate su `<html>` da `next/font` ([`layout.tsx`](../../src/app/layout.tsx))
e mappate ai token `--font-*`:

- **Archivo** — *display* (`font-display`). Wordmark, nomi progetto, titolo
  proposta, intestazioni form (peso 900); titoli di pagina (peso 500). Variabile
  300–900, maiuscolo, `tracking-tight`, `leading-none`.
- **IBM Plex Sans** — *testo* (`font-sans`). Titoli di card/commenti (500); body,
  descrizioni, commenti, messaggi d'errore (400). L'unica face pensata per
  leggere paragrafi: 14px, line-height 1.5, righe ~65 caratteri.
- **IBM Plex Mono** — *etichette* (`font-mono`). Titoli di sezione, meta, bottoni,
  tag (12px, maiuscolo, tracking 0.1em); e numeri, date, git ref, punteggi —
  tutto ciò che deve leggersi come una targhetta.

> Il peso del titolo di pagina è "in prova": per cambiarlo si scambia la classe in
> `pageTitleClass` dentro [`src/lib/tokens.ts`](../../src/lib/tokens.ts). La pagina
> HTML di riferimento mostra i pesi 400–900 a confronto.

## 14.4 I componenti (token condivisi)

Le class-string vivono in [`src/lib/tokens.ts`](../../src/lib/tokens.ts) — **mai
inline** (regola [`dry-beyond-sx.md`](../../.claude/rules/dry-beyond-sx.md)):

- **Bottoni**: `primaryButtonClass` (ink pieno → paprika al hover),
  `buttonClass` (secondario, outline che si inverte al hover),
  `smallButtonClass` (variante compatta), `dangerButtonClass` (paprika → ink).
  Disabilitato al 50% di opacità.
- **Link**: `linkClass` (underline, → paprika), `dangerLinkClass` (paprika → ink).
- **Testo**: `displayClass`, `pageTitleClass`, `labelClass` (mono maiuscolo),
  `tagClass` (badge quadrato).
- **Controlli**: `controlClass` (input/select/textarea con bordo ink).
- **Card**: `liftClass` — la card si "solleva" al hover con l'ombra dura, senza
  blur.
- **Layout board**: `BOARD_COLUMN_WIDTH`, `BOARD_GAP`.

> ⚠️ Tailwind risolve i conflitti per **ordine di emissione del CSS**, non per
> ordine nel `className`. Non appendere a un token una utility che tocca la stessa
> proprietà: aggiungi in `tokens.ts` una variante esplicita. È scritto in cima al
> file.

## 14.5 Dettagli globali

Da [`globals.css`](../../src/app/globals.css):

- **Selezione testo**: sfondo paprika, testo paper.
- **Focus visibile**: outline paprika 2px, offset 2px (accessibilità).
- **Scrollbar**: thumb nera rettangolare e sottile (8px), **invisibile finché
  l'elemento non scorre** (`data-scrolling`, gestito da
  [`ScrollbarReveal.tsx`](../../src/components/ScrollbarReveal.tsx)); vira a paprika
  al hover.
- **Cue di stato** (valutazione/scan): un quadratino 10px — ink = ok, paprika =
  errore, spinner per "in corso" (fermo sotto `prefers-reduced-motion`). Vedi
  [`EvalStatusCue.tsx`](../../src/components/evaluation/EvalStatusCue.tsx).
- **Transizione uniforme** su ogni `button`/`a`/`.lift`: 150ms ease-out; il *cosa*
  cambia lo decidono le classi hover dei token.
- **Tipografia del contenuto Tiptap** (`.rich-text`): heading/liste/spaziatura
  minimali, senza plugin typography (coerente con lo schema ridotto,
  [capitolo 10](10-editor-commenti.md)). Il passaggio citato in un commento
  ancorato è evidenziato in dust (`.anchor-highlight`).

## 14.6 Regola pratica

Prima di introdurre un colore, un'ombra, un raggio o una class-string nuova:
non farlo. Usa i quattro colori, l'ombra dura, gli angoli vivi e i token
esistenti. Se ti serve davvero una variante nuova, aggiungila in `tokens.ts` (e
riflettila nella pagina HTML di riferimento), non inline nel componente.

---

Precedente: [← 13. Contribuire](13-contribuire.md) · [Torna all'indice](README.md)
