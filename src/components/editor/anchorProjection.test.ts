// @vitest-environment jsdom
// Test di proprieta' dell'invariante ancore (ADR-0005): per ogni selezione
// possibile del doc, il flusso captureSelection (client) ->
// resolveAnchor(markdownToPlainText) (server) deve risolvere. E' il test che
// ha scovato le divergenze snake_case / hard break / entity HTML.
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { markdownToPlainText, resolveAnchor } from "@/lib/anchors";
import { captureSelection, plainRangeToPm, projectDoc } from "@/components/editor/anchoring";
import { getMarkdown, richTextExtensions } from "@/components/editor/extensions";

const TEXTS = [
  "L'idea è semplice: aggiungere una mappa offline (v2) per l'uso in montagna.",
  "# Contesto\n\nOggi l'app non funziona senza rete. Serve una cache locale.\n\n- pro: uso offline\n- contro: storage",
  "Perché? Perché i clienti (il 30%!) lo chiedono. Vedi ticket #42, costo 3-5 giorni.",
  "Testo con **grassetto** e *corsivo*, e snake_case_variabile più 2*3=6.",
  "Prima riga\nseconda riga dello stesso paragrafo\n\nAltro paragrafo qui.",
  "riga con hard break  \nriga dopo il break",
  'Prezzi: 100\u20ac (50%), "citazione", per\u00f2 \u2014 forse; path/api/v1 e 3.5 giorni',
  "# Piano\n\nFase 1: analisi **critica** del *flusso*.\n\n1. step uno\n2. step due (con nota)\n\n- extra: snake_case_id\n- fine",
  "Testo>con angolo, 5+3, a{b}, [quadra] e (tonda) + trattino-basso_finale_",
];

describe("anchor projection invariant", () => {
  for (const original of TEXTS) {
    it(`resolves every selectable range: ${JSON.stringify(original.slice(0, 30))}`, () => {
      // 1. simula il primo save: markdown "normalizzato" dall'editor
      const e1 = new Editor({
        element: document.createElement("div"),
        extensions: richTextExtensions,
        content: original,
      });
      const stored = getMarkdown(e1);
      e1.destroy();

      // 2. viewer sul markdown persistito
      const editor = new Editor({
        element: document.createElement("div"),
        extensions: richTextExtensions,
        content: stored,
      });
      const projection = projectDoc(editor.state.doc);
      const serverPlain = markdownToPlainText(stored);
      expect(serverPlain).toBe(projection.text);

      // 3. ogni selezione plausibile (finestra scorrevole di varie lunghezze)
      const failures: string[] = [];
      const len = projection.text.length;
      for (let start = 0; start < len; start++) {
        for (const width of [3, 8, 20, 45]) {
          const end = Math.min(start + width, len);
          if (end <= start) continue;
          const pm = plainRangeToPm(projection, { start, end });
          if (!pm) continue;
          // selezione valida in PM?
          try {
            TextSelection.create(editor.state.doc, pm.from, pm.to);
          } catch {
            continue;
          }
          const captured = captureSelection(editor.state.doc, pm);
          if (!captured) continue;
          const resolved = resolveAnchor(serverPlain, {
            text: captured.quote,
            occurrence: captured.occurrence,
          });
          if (!resolved) {
            failures.push(JSON.stringify({ start, end, quote: captured.quote }));
          }
        }
      }
      editor.destroy();
      expect(failures).toEqual([]);
    });
  }
});
