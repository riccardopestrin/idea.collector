import type { Node as PMNode } from "@tiptap/pm/model";

// Proiezione plain-text del doc ProseMirror, speculare a
// markdownToPlainText (src/lib/anchors.ts): "\n" tra textblock,
// hardBreak → "\n". `map` collega gli offset del plain text alle
// posizioni ProseMirror dei text node, per decorations e capture.
export type DocProjection = {
  text: string;
  map: { start: number; end: number; pmStart: number }[];
};

export function projectDoc(doc: PMNode): DocProjection {
  let text = "";
  const map: DocProjection["map"] = [];
  let firstBlock = true;

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (!firstBlock) text += "\n";
    firstBlock = false;
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        map.push({
          start: text.length,
          end: text.length + child.text.length,
          pmStart: pos + 1 + offset,
        });
        text += child.text;
      } else if (child.type.name === "hardBreak") {
        text += "\n";
      }
    });
    return false;
  });

  return { text, map };
}

// Offset plain-text → posizione ProseMirror. Gli offset dentro i separatori
// ("\n") si agganciano al text node adiacente.
function plainOffsetToPm(projection: DocProjection, offset: number, side: "start" | "end"): number | null {
  for (const seg of projection.map) {
    if (offset >= seg.start && offset <= seg.end) {
      return seg.pmStart + (offset - seg.start);
    }
    if (side === "start" && offset < seg.start) return seg.pmStart;
    if (side === "end" && offset < seg.start) break;
  }
  const last = projection.map[projection.map.length - 1];
  return side === "end" && last ? last.pmStart + (last.end - last.start) : null;
}

export function plainRangeToPm(
  projection: DocProjection,
  range: { start: number; end: number },
): { from: number; to: number } | null {
  const from = plainOffsetToPm(projection, range.start, "start");
  const to = plainOffsetToPm(projection, range.end, "end");
  return from !== null && to !== null && to > from ? { from, to } : null;
}

// Posizione ProseMirror → offset plain-text (per catturare la selezione).
function pmPosToPlainOffset(projection: DocProjection, pos: number): number | null {
  for (const seg of projection.map) {
    const len = seg.end - seg.start;
    if (pos >= seg.pmStart && pos <= seg.pmStart + len) {
      return seg.start + (pos - seg.pmStart);
    }
  }
  return null;
}

// Cattura {quote, occurrence} da una selezione: quote = slice della proiezione,
// occurrence = in quale occorrenza della quote cade lo start.
export function captureSelection(
  doc: PMNode,
  selection: { from: number; to: number },
): { quote: string; occurrence: number } | null {
  const projection = projectDoc(doc);
  const start = pmPosToPlainOffset(projection, selection.from);
  const end = pmPosToPlainOffset(projection, selection.to);
  if (start === null || end === null || end <= start) return null;
  const quote = projection.text.slice(start, end);
  if (!quote.trim()) return null;

  let occurrence = 0;
  let i = projection.text.indexOf(quote);
  while (i !== -1 && i <= start) {
    occurrence += 1;
    if (i === start) break;
    i = projection.text.indexOf(quote, i + 1);
  }
  return occurrence >= 1 ? { quote, occurrence } : null;
}
