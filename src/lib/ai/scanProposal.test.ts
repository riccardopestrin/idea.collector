import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import {
  buildScanReport,
  extractWebFindings,
  findLocalDuplicate,
  type LocalScanResult,
  validateLocalScan,
} from "./scanProposal";

const candidateIds = new Set(["idea-1", "idea-2"]);

const raw = (overrides: Partial<LocalScanResult>): LocalScanResult => ({
  matchId: "idea-1",
  similarity: 90,
  summary: "Molto simile a «Mappa offline».",
  ...overrides,
});

describe("validateLocalScan", () => {
  it("passes through a valid match unchanged", () => {
    expect(validateLocalScan(raw({}), candidateIds)).toEqual(raw({}));
  });

  it("clamps and rounds similarity into 0..100", () => {
    expect(validateLocalScan(raw({ similarity: 141 }), candidateIds).similarity).toBe(100);
    expect(validateLocalScan(raw({ similarity: 86.6 }), candidateIds).similarity).toBe(87);
  });

  it("discards a matchId invented by the model, zeroing the similarity", () => {
    const result = validateLocalScan(raw({ matchId: "not-a-real-id" }), candidateIds);
    expect(result.matchId).toBeNull();
    expect(result.similarity).toBe(0);
  });

  it("keeps a null match with zero similarity", () => {
    const result = validateLocalScan(raw({ matchId: null, similarity: 40 }), candidateIds);
    expect(result).toMatchObject({ matchId: null, similarity: 0 });
  });

  it("rejects a non-numeric similarity", () => {
    expect(() => validateLocalScan(raw({ similarity: Number.NaN }), candidateIds)).toThrowError(
      /similarity/,
    );
  });

  it("trims and caps the summary", () => {
    const result = validateLocalScan(raw({ summary: `  ${"x".repeat(3000)}  ` }), candidateIds);
    expect(result.summary).toHaveLength(2000);
    expect(result.summary.startsWith("x")).toBe(true);
  });
});

describe("buildScanReport", () => {
  it("joins the local and web findings into paragraphs", () => {
    expect(buildScanReport(raw({}), "Esiste già in Trello.")).toBe(
      "Molto simile a «Mappa offline».\n\nEsiste già in Trello.",
    );
  });

  it("keeps a single paragraph when the other side is empty", () => {
    expect(buildScanReport(raw({ summary: "" }), "Esiste già in Trello.")).toBe(
      "Esiste già in Trello.",
    );
  });

  it("falls back to the no-findings message when both sides are empty", () => {
    expect(buildScanReport(raw({ summary: "  " }), "")).toBe(
      "Nessun riscontro simile trovato, né tra le idee esistenti né sul web.",
    );
  });
});

// blocchi finti del contenuto Messages API, solo i campi letti dal parser
const text = (t: string, citations?: { url: string; title: string | null }[]) =>
  ({
    type: "text",
    text: t,
    citations: citations?.map((c) => ({ type: "web_search_result_location", ...c })),
  }) as unknown as Anthropic.ContentBlock;
const toolResult = { type: "web_search_tool_result" } as unknown as Anthropic.ContentBlock;

describe("extractWebFindings", () => {
  it("keeps only the prose after the last tool result, dropping the preamble", () => {
    const findings = extractWebFindings([
      text("Cerco sul web…"),
      toolResult,
      text("Trello ha già questa feature."),
    ]);
    expect(findings).toBe("Trello ha già questa feature.");
  });

  it("appends the real cited sources, deduplicated by URL", () => {
    const findings = extractWebFindings([
      toolResult,
      text("Trello ha già questa feature.", [
        { url: "https://trello.com/x", title: "Trello" },
        { url: "https://trello.com/x", title: "Trello" },
      ]),
    ]);
    expect(findings).toBe(
      "Trello ha già questa feature.\n\nFonti:\n- Trello: https://trello.com/x",
    );
  });

  it("returns the whole prose when no search was performed", () => {
    expect(extractWebFindings([text("Nessun riscontro sul web.")])).toBe(
      "Nessun riscontro sul web.",
    );
  });
});

describe("findLocalDuplicate", () => {
  it("short-circuits to no-match without calling the model when there are no candidates", async () => {
    const client = {} as Anthropic; // qualsiasi accesso farebbe fallire il test
    const result = await findLocalDuplicate(
      client,
      { title: "Idea", description: null, problem: null },
      [],
    );
    expect(result).toEqual({ matchId: null, similarity: 0, summary: "" });
  });
});
