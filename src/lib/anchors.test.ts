import { describe, expect, it } from "vitest";

import { findOccurrences, markdownToPlainText, resolveAnchor } from "./anchors";

describe("findOccurrences", () => {
  it("returns every occurrence index, including overlapping ones", () => {
    expect(findOccurrences("abcabcabc", "abc")).toEqual([0, 3, 6]);
    expect(findOccurrences("aaaa", "aa")).toEqual([0, 1, 2]);
  });

  it("returns an empty list for a missing or empty needle", () => {
    expect(findOccurrences("abc", "zzz")).toEqual([]);
    expect(findOccurrences("abc", "")).toEqual([]);
  });
});

describe("resolveAnchor", () => {
  const text = "il gatto dorme. il gatto mangia.";

  it("resolves the nth occurrence of the quote", () => {
    expect(resolveAnchor(text, { text: "il gatto", occurrence: 2 })).toEqual({
      start: 16,
      end: 24,
    });
  });

  it("returns null when the occurrence does not exist (orphaned anchor)", () => {
    expect(resolveAnchor(text, { text: "il gatto", occurrence: 3 })).toBeNull();
    expect(resolveAnchor(text, { text: "il cane", occurrence: 1 })).toBeNull();
  });

  it("handles unicode quotes", () => {
    expect(resolveAnchor("perché è così", { text: "è così", occurrence: 1 })).toEqual({
      start: 7,
      end: 13,
    });
  });
});

describe("markdownToPlainText", () => {
  it("strips heading markers, one block per line", () => {
    expect(markdownToPlainText("# Titolo\n\n## Sotto")).toBe("Titolo\nSotto");
  });

  it("strips list markers for bullet and ordered lists", () => {
    expect(markdownToPlainText("- uno\n- due\n\n1. tre\n2. quattro")).toBe(
      "uno\ndue\ntre\nquattro",
    );
  });

  it("strips bold, italic, code spans and link syntax", () => {
    expect(markdownToPlainText("Testo **grasso** e *corsivo* e `codice`")).toBe(
      "Testo grasso e corsivo e codice",
    );
    expect(markdownToPlainText("Vedi [la guida](https://example.com) qui")).toBe(
      "Vedi la guida qui",
    );
  });

  it("keeps literal asterisks that are not emphasis", () => {
    expect(markdownToPlainText("2 * 3 = 6")).toBe("2 * 3 = 6");
  });

  it("joins soft-wrapped lines of a paragraph with a space", () => {
    expect(markdownToPlainText("prima riga\nseconda riga")).toBe(
      "prima riga seconda riga",
    );
  });

  it("separates paragraphs on blank lines", () => {
    expect(markdownToPlainText("primo\n\n\nsecondo")).toBe("primo\nsecondo");
  });

  it("unescapes markdown-it escapes", () => {
    expect(markdownToPlainText("valore \\*non\\* enfasi")).toBe("valore *non* enfasi");
  });

  it("keeps intra-word underscores (snake_case is not emphasis)", () => {
    expect(markdownToPlainText("id snake_case_variabile qui")).toBe(
      "id snake_case_variabile qui",
    );
  });

  it("decodes the HTML entities the serializer can emit", () => {
    expect(markdownToPlainText("a &gt; b &amp;&amp; c &lt; d")).toBe("a > b && c < d");
  });

  it("treats a trailing backslash as a hard break", () => {
    expect(markdownToPlainText("prima riga\\\nseconda riga")).toBe(
      "prima riga\nseconda riga",
    );
  });

  it("keeps plain text unchanged", () => {
    expect(markdownToPlainText("testo semplice senza markdown")).toBe(
      "testo semplice senza markdown",
    );
  });
});
