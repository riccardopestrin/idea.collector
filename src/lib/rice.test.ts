import { describe, expect, it } from "vitest";

import { score } from "./rice";

describe("score", () => {
  it("computes RICE as (reach × impact × confidence) / effort", () => {
    expect(score("rice", { reach: 1000, impact: 2, confidence: 0.8, effort: 4 })).toBe(400);
  });

  it("computes ICE as impact × confidence × ease", () => {
    expect(score("ice", { impact: 8, confidence: 7, effort: 5 })).toBe(280);
  });

  it("returns null when a RICE value is missing", () => {
    expect(score("rice", { reach: 1000, impact: 2, confidence: 0.8 })).toBeNull();
  });

  it("returns null instead of dividing by zero effort", () => {
    expect(score("rice", { reach: 1000, impact: 2, confidence: 0.8, effort: 0 })).toBeNull();
  });
});
