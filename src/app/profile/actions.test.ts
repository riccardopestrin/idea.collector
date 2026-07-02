import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateName } from "./actions";

const { getUser, update, eq, from, redirect } = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  return {
    getUser: vi.fn(),
    update,
    eq,
    from: vi.fn(() => ({ update })),
    redirect: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser }, from }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const formOf = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
};

describe("updateName", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
    update.mockClear();
    eq.mockReset().mockResolvedValue({ error: null });
    redirect.mockReset();
  });

  it("rejects an empty name without touching the database", async () => {
    const result = await updateName(null, formOf({ name: "   " }));

    expect(result).toEqual({ error: "Il nome è obbligatorio." });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a name longer than 80 characters without touching the database", async () => {
    const result = await updateName(null, formOf({ name: "x".repeat(81) }));

    expect(result).toEqual({
      error: "Il nome è troppo lungo (max 80 caratteri).",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates the current user's row with the trimmed name and redirects home", async () => {
    await updateName(null, formOf({ name: "  Riccardo  " }));

    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ name: "Riccardo" });
    expect(eq).toHaveBeenCalledWith("id", "u1");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("refuses to write when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await updateName(null, formOf({ name: "Riccardo" }));

    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the update fails", async () => {
    eq.mockResolvedValue({ error: { message: "boom" } });

    const result = await updateName(null, formOf({ name: "Riccardo" }));

    expect(result).toEqual({ error: "Errore nel salvataggio. Riprova." });
    expect(redirect).not.toHaveBeenCalled();
  });
});
