// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { markdownToPlainText, resolveAnchor } from "@/lib/anchors";

import { captureSelection, plainRangeToPm, projectDoc } from "./anchoring";
import { getMarkdown, richTextExtensions } from "./extensions";

function editorFor(markdown: string) {
  return new Editor({
    element: document.createElement("div"),
    extensions: richTextExtensions,
    content: markdown,
  });
}

const SAMPLES = [
  "testo semplice senza markdown",
  "# Titolo\n\nParagrafo con **grasso** e *corsivo*.",
  "## Sezione\n\n- primo punto\n- secondo **punto**\n\n1. uno\n2. due",
  "Paragrafo uno.\n\nParagrafo due con testo ripetuto. testo ripetuto.",
];

describe("markdown round-trip (invariante ADR-0005)", () => {
  // load→save senza modifiche deve essere no-op sulla stringa, altrimenti le
  // ancore si orfanizzano spuriamente a ogni save.
  it.each(SAMPLES)("serializes back to the same markdown: %s", (markdown) => {
    const editor = editorFor(markdown);
    expect(getMarkdown(editor)).toBe(markdown);
    editor.destroy();
  });
});

describe("projectDoc vs markdownToPlainText (invariante ancore)", () => {
  // La proiezione del doc (client) e quella del markdown (server) devono
  // coincidere: è ciò che rende valida la validazione server delle ancore.
  it.each(SAMPLES)("projects the same plain text: %s", (markdown) => {
    const editor = editorFor(markdown);
    expect(projectDoc(editor.state.doc).text).toBe(markdownToPlainText(markdown));
    editor.destroy();
  });
});

describe("plainRangeToPm", () => {
  it("maps a resolved quote to a ProseMirror range with the same text", () => {
    const markdown = "# Titolo\n\nIl gatto dorme sul divano.";
    const editor = editorFor(markdown);
    const projection = projectDoc(editor.state.doc);
    const range = resolveAnchor(projection.text, { text: "gatto dorme", occurrence: 1 })!;
    const pm = plainRangeToPm(projection, range)!;
    expect(editor.state.doc.textBetween(pm.from, pm.to)).toBe("gatto dorme");
    editor.destroy();
  });

  it("maps a range that crosses a paragraph and a list item", () => {
    const markdown = "Paragrafo iniziale\n\n- elemento lista";
    const editor = editorFor(markdown);
    const projection = projectDoc(editor.state.doc);
    const range = resolveAnchor(projection.text, {
      text: "iniziale\nelemento",
      occurrence: 1,
    })!;
    expect(range).not.toBeNull();
    const pm = plainRangeToPm(projection, range)!;
    expect(editor.state.doc.textBetween(pm.from, pm.to, "\n")).toBe(
      "iniziale\nelemento",
    );
    editor.destroy();
  });
});

describe("captureSelection", () => {
  it("captures quote and occurrence for a repeated selection", () => {
    const markdown = "testo ripetuto. testo ripetuto.";
    const editor = editorFor(markdown);
    const projection = projectDoc(editor.state.doc);
    // seconda occorrenza di "testo ripetuto": offset plain 16..30 → pm 17..31
    const range = resolveAnchor(projection.text, { text: "testo ripetuto", occurrence: 2 })!;
    const pm = plainRangeToPm(projection, range)!;
    expect(captureSelection(editor.state.doc, pm)).toEqual({
      quote: "testo ripetuto",
      occurrence: 2,
    });
    editor.destroy();
  });

  it("returns null for a whitespace-only selection", () => {
    const editor = editorFor("uno due");
    expect(captureSelection(editor.state.doc, { from: 4, to: 5 })).toBeNull();
    editor.destroy();
  });
});
