import { beforeEach, describe, expect, it, vi } from "vitest";

import { createProposal } from "./actions";

const { getUser, insert, from, redirect, revalidatePath } = vi.hoisted(() => {
  const insert = vi.fn();
  return {
    getUser: vi.fn(),
    insert,
    from: vi.fn(() => ({ insert })),
    redirect: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser }, from }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));

const formOf = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
};

describe("createProposal", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
    insert.mockReset().mockResolvedValue({ error: null });
    redirect.mockReset();
    revalidatePath.mockReset();
  });

  it("rejects an empty title without touching the database", async () => {
    const result = await createProposal(null, formOf({ title: "   " }));

    expect(result).toEqual({ error: "Il titolo è obbligatorio." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts for the current user, nulls empty optionals and parses links by line", async () => {
    await createProposal(
      null,
      formOf({
        title: "Mappa offline",
        description: "Scarica le mappe",
        problem: "",
        links: "https://a.test\n\n  https://b.test  \n",
      })
    );

    expect(insert).toHaveBeenCalledWith({
      title: "Mappa offline",
      description: "Scarica le mappe",
      problem: null,
      links: ["https://a.test", "https://b.test"],
      proposer_id: "u1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("refuses to write when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await createProposal(null, formOf({ title: "X" }));

    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(insert).not.toHaveBeenCalled();
  });
});
