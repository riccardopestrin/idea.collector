import { describe, expect, it } from "vitest";

import { type RiceScores, validateScores } from "./evaluateProposal";

const raw = (overrides: Partial<RiceScores>): RiceScores => ({
  reach: 8,
  impact: 6,
  confidence: 4,
  effort: 5,
  rationale: "motivazione",
  ...overrides,
});

describe("validateScores", () => {
  it("passes through valid RICE-10 scores unchanged", () => {
    expect(validateScores(raw({}))).toEqual(raw({}));
  });

  it("clamps every factor into 1..10", () => {
    expect(validateScores(raw({ reach: 0, impact: 15, confidence: 5, effort: -3 }))).toMatchObject({
      reach: 1,
      impact: 10,
      confidence: 5,
      effort: 1,
    });
  });

  it("rounds non-integer factors to the nearest integer", () => {
    expect(validateScores(raw({ impact: 6.4, confidence: 4.6 }))).toMatchObject({
      impact: 6,
      confidence: 5,
    });
  });

  it("rejects non-numeric components", () => {
    expect(() => validateScores(raw({ impact: Number.NaN }))).toThrowError(/impact/);
  });

  it("trims and caps the rationale", () => {
    const result = validateScores(raw({ rationale: `  ${"x".repeat(3000)}  ` }));
    expect(result.rationale).toHaveLength(2000);
    expect(result.rationale.startsWith("x")).toBe(true);
  });
});
