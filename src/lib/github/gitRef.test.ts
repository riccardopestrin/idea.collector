import { describe, expect, it } from "vitest";

import { gitRefUrl, parseGitRef } from "./gitRef";

const repo = { owner: "acme", name: "ideas" };

describe("gitRefUrl", () => {
  it("links a #n reference to the pull request", () => {
    expect(gitRefUrl("#42", repo)).toBe("https://github.com/acme/ideas/pull/42");
  });

  it("links a branch name to the tree, keeping slashes as path separators", () => {
    expect(gitRefUrl("feature/über x", repo)).toBe(
      "https://github.com/acme/ideas/tree/feature/%C3%BCber%20x",
    );
  });
});

describe("parseGitRef", () => {
  it("turns an empty input into null (clears the reference)", () => {
    expect(parseGitRef("   ")).toBeNull();
  });

  it("normalizes a bare number to a PR reference", () => {
    expect(parseGitRef(" 42 ")).toBe("#42");
  });

  it("keeps a branch name as is", () => {
    expect(parseGitRef("fix/login")).toBe("fix/login");
  });

  it("rejects whitespace inside and over-long values", () => {
    expect(parseGitRef("two words")).toBeUndefined();
    expect(parseGitRef("a".repeat(201))).toBeUndefined();
  });

  it("rejects empty, '.' and '..' path segments so the link cannot leave the repo", () => {
    expect(parseGitRef("../../x")).toBeUndefined();
    expect(parseGitRef("a//b")).toBeUndefined();
    expect(parseGitRef("/lead")).toBeUndefined();
    expect(parseGitRef("./x")).toBeUndefined();
  });
});
