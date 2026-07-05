import { describe, expect, it } from "vitest";

import { parseVoteFields } from "./vote";

const OUT_OF_RANGE = { error: "Assegna un valore da 1 a 10 a ogni parametro." };

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

describe("parseVoteFields", () => {
  it("parses the four RICE components from valid sliders", () => {
    expect(
      parseVoteFields(form({ reach: "3", impact: "7", confidence: "5", effort: "2" }), "rice"),
    ).toEqual({ fields: { reach: 3, impact: 7, confidence: 5, effort: 2 } });
  });

  it("nulls reach for ICE and keeps the other three", () => {
    expect(
      parseVoteFields(form({ reach: "9", impact: "8", confidence: "6", effort: "4" }), "ice"),
    ).toEqual({ fields: { reach: null, impact: 8, confidence: 6, effort: 4 } });
  });

  it("rejects a missing RICE component (reach required)", () => {
    expect(parseVoteFields(form({ impact: "5", confidence: "5", effort: "5" }), "rice")).toEqual(
      OUT_OF_RANGE,
    );
  });

  it("rejects a missing ICE component while reach absent is fine", () => {
    expect(parseVoteFields(form({ impact: "5", confidence: "5" }), "ice")).toEqual(OUT_OF_RANGE);
  });

  it("rejects a non-integer value", () => {
    expect(
      parseVoteFields(form({ reach: "3.5", impact: "5", confidence: "5", effort: "5" }), "rice"),
    ).toEqual(OUT_OF_RANGE);
  });

  it("rejects values outside 1–10", () => {
    expect(
      parseVoteFields(form({ reach: "0", impact: "5", confidence: "5", effort: "5" }), "rice"),
    ).toEqual(OUT_OF_RANGE);
    expect(
      parseVoteFields(form({ reach: "5", impact: "11", confidence: "5", effort: "5" }), "rice"),
    ).toEqual(OUT_OF_RANGE);
  });

  it("accepts the boundary values 1 and 10", () => {
    expect(
      parseVoteFields(form({ reach: "1", impact: "10", confidence: "1", effort: "10" }), "rice"),
    ).toEqual({ fields: { reach: 1, impact: 10, confidence: 1, effort: 10 } });
  });
});
