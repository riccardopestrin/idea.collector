import { describe, expect, it } from "vitest";

import { parseTaskUrl } from "./taskUrl";

describe("parseTaskUrl", () => {
  it("keeps a ClickUp task URL as typed, trimmed", () => {
    expect(parseTaskUrl("  https://app.clickup.com/t/86c1abc  ")).toBe(
      "https://app.clickup.com/t/86c1abc",
    );
  });

  it("clears on empty input", () => {
    expect(parseTaskUrl("   ")).toBeNull();
  });

  it("rejects other hosts, plain http, non-URLs and oversized input", () => {
    expect(parseTaskUrl("https://evil.example/t/1")).toBeUndefined();
    expect(parseTaskUrl("https://app.clickup.com.evil.example/t/1")).toBeUndefined();
    expect(parseTaskUrl("http://app.clickup.com/t/1")).toBeUndefined();
    expect(parseTaskUrl("https://u@app.clickup.com/t/1")).toBeUndefined();
    // il check a DB è case-sensitive e vuole il "/" dopo l'host: il parser dice la stessa cosa
    expect(parseTaskUrl("https://APP.CLICKUP.COM/t/1")).toBeUndefined();
    expect(parseTaskUrl("https://app.clickup.com")).toBeUndefined();
    expect(parseTaskUrl("not a url")).toBeUndefined();
    expect(parseTaskUrl(`https://app.clickup.com/t/${"x".repeat(500)}`)).toBeUndefined();
  });
});
