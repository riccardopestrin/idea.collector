import { describe, expect, it } from "vitest";

import { type RiceScores, validateScores } from "./evaluateProposal";

const raw = (overrides: Partial<RiceScores>): RiceScores => ({
  reach: 100,
  impact: 2,
  confidence: 0.8,
  effort: 3,
  rationale: "motivazione",
  ...overrides,
});

describe("validateScores", () => {
  it("passes through valid RICE scores unchanged", () => {
    expect(validateScores(raw({}), "rice")).toEqual(raw({}));
  });

  it("clamps RICE confidence into 0..1", () => {
    expect(validateScores(raw({ confidence: 1.7 }), "rice").confidence).toBe(1);
    expect(validateScores(raw({ confidence: -0.2 }), "rice").confidence).toBe(0);
  });

  it("forces RICE effort above zero", () => {
    expect(validateScores(raw({ effort: 0 }), "rice").effort).toBe(0.1);
    expect(validateScores(raw({ effort: -5 }), "rice").effort).toBe(0.1);
  });

  it("clamps negative reach to zero on RICE", () => {
    expect(validateScores(raw({ reach: -10 }), "rice").reach).toBe(0);
  });

  it("clamps every ICE component into 1..10", () => {
    const result = validateScores(
      raw({ reach: 0, impact: 15, confidence: 5, effort: -3 }),
      "ice",
    );
    expect(result).toMatchObject({ reach: 1, impact: 10, confidence: 5, effort: 1 });
  });

  it("rejects non-numeric components", () => {
    expect(() =>
      validateScores(raw({ impact: Number.NaN }), "rice"),
    ).toThrowError(/impact/);
  });

  it("trims and caps the rationale", () => {
    const result = validateScores(raw({ rationale: `  ${"x".repeat(3000)}  ` }), "rice");
    expect(result.rationale).toHaveLength(2000);
    expect(result.rationale.startsWith("x")).toBe(true);
  });
});
