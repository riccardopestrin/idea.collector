// Ancoraggio commenti exact-quote + occurrence index (ADR-0005).
// La quote è la proiezione plain-text della selezione nel doc Tiptap; qui
// viviamo lato server, quindi la risoluzione avviene sulla proiezione
// plain-text del markdown persistito. `markdownToPlainText` DEVE combaciare
// con la proiezione del doc ProseMirror (src/components/editor/anchoring.ts):
// l'invariante è coperta dai test round-trip.

// Un solo body ancorabile: la descrizione. 'problem' è deprecato (via dal form,
// dall'edit, dal dettaglio e dai prompt AI); eventuali commenti storici ancorati
// a 'problem' semplicemente non risolvono più (getProposalDetail li tratta come
// orfani). La colonna DB resta, non si elimina.
export const ANCHOR_FIELDS = ["description"] as const;
export type AnchorField = (typeof ANCHOR_FIELDS)[number];

export function isAnchorField(value: string): value is AnchorField {
  return ANCHOR_FIELDS.includes(value as AnchorField);
}

export type Anchor = {
  field: AnchorField;
  text: string;
  occurrence: number; // 1-based
};

// Indici (0-based) di tutte le occorrenze, anche sovrapposte.
export function findOccurrences(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const result: number[] = [];
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    result.push(i);
    i = haystack.indexOf(needle, i + 1);
  }
  return result;
}

// Risolve l'ancora sul plain text del campo: N-esima occorrenza della quote.
// null = orfana (testo modificato).
export function resolveAnchor(
  plainText: string,
  anchor: Pick<Anchor, "text" | "occurrence">,
): { start: number; end: number } | null {
  const start = findOccurrences(plainText, anchor.text)[anchor.occurrence - 1];
  if (start === undefined) return null;
  return { start, end: start + anchor.text.length };
}

// Proiezione plain-text del markdown, replicando come Tiptap (schema ADR-0005:
// heading 1-3, bold, italic, elenchi) proietta il doc: un "\n" tra blocchi,
// softbreak → spazio, hard break (due spazi finali) → "\n".
// ponytail: regex-based, non un parser markdown completo — sintassi fuori
// schema (code fence, blockquote) può divergere dal doc reale; l'ancora in
// quel caso non risolve e il commento resta non ancorato, niente di rotto.
export function markdownToPlainText(markdown: string): string {
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length) {
      blocks.push(current.join(" "));
      current = [];
    }
  };

  for (const rawLine of markdown.split("\n")) {
    if (rawLine.trim() === "") {
      flush();
      continue;
    }
    // hard break: due spazi finali, oppure backslash finale (come lo
    // serializza prosemirror-markdown)
    const hardBreak = /[ ]{2,}$/.test(rawLine) || /(?<!\\)\\$/.test(rawLine.trimEnd());
    let line = rawLine.trim().replace(/(?<!\\)\\$/, "");
    const isBlock =
      /^#{1,6}\s/.test(line) || /^[-*+]\s/.test(line) || /^\d+[.)]\s/.test(line);
    line = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+[.)]\s+/, "");
    line = inlineToPlainText(line);
    // heading/list item = blocco a sé; testo semplice si aggrega al paragrafo
    if (isBlock) {
      flush();
      blocks.push(line);
    } else if (hardBreak) {
      current.push(line);
      blocks.push(current.join(" "));
      current = [];
      // il prossimo pezzo dello stesso paragrafo va su una "riga" nuova
    } else {
      current.push(line);
    }
  }
  flush();
  return blocks.join("\n");
}

function inlineToPlainText(text: string): string {
  // gli escape (\*) vanno sottratti alle regex di enfasi e ripristinati alla fine
  const saved: string[] = [];
  return text
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, (_, c: string) => {
      saved.push(c);
      return `\u0000${saved.length - 1}\u0000`;
    })
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // link -> label
    .replace(/\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*/g, "$1") // bold **
    .replace(/(?<![\w_])__([^\s_](?:[^_]*?[^\s_])?)__(?![\w_])/g, "$1") // bold __
    .replace(/\*([^\s*](?:[^*]*?[^\s*])?)\*/g, "$1") // italic *
    // underscore intra-parola non è enfasi (CommonMark): snake_case resta intatto
    .replace(/(?<![\w_])_([^\s_](?:[^_]*?[^\s_])?)_(?![\w_])/g, "$1") // italic _
    .replace(/`([^`]+)`/g, "$1") // code span
    // entity HTML che il serializer puo' emettere al posto del carattere
    .replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (_, e: string) =>
      e === "amp" ? "&"
      : e === "lt" ? "<"
      : e === "gt" ? ">"
      : e === "quot" ? '"'
      : e === "apos" ? "'"
      : String.fromCodePoint(Number(e.slice(1))),
    )
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => saved[Number(i)]);
}
