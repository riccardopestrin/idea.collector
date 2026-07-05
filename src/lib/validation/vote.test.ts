import { describe, expect, it } from "vitest";

import { parseVoteFields } from "./vote";

const OUT_OF_RANGE = { error: "Assegna un valore da 1 a 10 a ogni parametro." };

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

describe("parseVoteFields", () => {
  it("parses the four RICE-10 factors from valid sliders", () => {
    expect(
      parseVoteFields(form({ reach: "3", impact: "7", confidence: "5", effort: "2" })),
    ).toEqual({ fields: { reach: 3, impact: 7, confidence: 5, effort: 2 } });
  });

  it("rejects a missing factor (all four required, reach included)", () => {
    expect(parseVoteFields(form({ impact: "5", confidence: "5", effort: "5" }))).toEqual(
      OUT_OF_RANGE,
    );
  });

  it("rejects a non-integer value", () => {
    expect(
      parseVoteFields(form({ reach: "3.5", impact: "5", confidence: "5", effort: "5" })),
    ).toEqual(OUT_OF_RANGE);
  });

  it("rejects values outside 1–10", () => {
    expect(parseVoteFields(form({ reach: "0", impact: "5", confidence: "5", effort: "5" }))).toEqual(
      OUT_OF_RANGE,
    );
    expect(
      parseVoteFields(form({ reach: "5", impact: "11", confidence: "5", effort: "5" })),
    ).toEqual(OUT_OF_RANGE);
  });

  it("accepts the boundary values 1 and 10", () => {
    expect(
      parseVoteFields(form({ reach: "1", impact: "10", confidence: "1", effort: "10" })),
    ).toEqual({ fields: { reach: 1, impact: 10, confidence: 1, effort: 10 } });
  });
});
