import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateName } from "./actions";

const { getUser, update, eq, from, revalidatePath } = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  return {
    getUser: vi.fn(),
    update,
    eq,
    from: vi.fn(() => ({ update })),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser }, from }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

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
    revalidatePath.mockReset();
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

  it("updates the current user's row with the trimmed name, revalidates the layout and stays put", async () => {
    const result = await updateName(null, formOf({ name: "  Riccardo  " }));

    expect(result).toBeNull();

    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ name: "Riccardo" });
    expect(eq).toHaveBeenCalledWith("id", "u1");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
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
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
