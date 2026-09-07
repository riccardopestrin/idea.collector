import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAccount, updateName } from "./actions";

const { getUser, update, eq, from, rpc, signOut, deleteUser, revalidatePath, redirect } =
  vi.hoisted(() => {
    const eq = vi.fn();
    const update = vi.fn(() => ({ eq }));
    return {
      getUser: vi.fn(),
      update,
      eq,
      from: vi.fn(() => ({ update })),
      rpc: vi.fn(),
      signOut: vi.fn(),
      deleteUser: vi.fn(),
      revalidatePath: vi.fn(),
      redirect: vi.fn(),
    };
  });

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser, signOut }, from, rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ auth: { admin: { deleteUser } } }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
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

describe("deleteAccount", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockReset().mockResolvedValue({ error: null });
    deleteUser.mockReset().mockResolvedValue({ error: null });
    signOut.mockReset().mockResolvedValue({ error: null });
    redirect.mockReset();
  });

  it("runs the RPC, removes the auth user, signs out and lands on the login", async () => {
    await deleteAccount();

    expect(rpc).toHaveBeenCalledWith("delete_account");
    expect(deleteUser).toHaveBeenCalledWith("u1");
    expect(signOut).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("explains which projects block the deletion when the user is their only admin", async () => {
    rpc.mockResolvedValue({ error: { message: "unico admin: Mobile, Web" } });

    expect(await deleteAccount()).toEqual({
      error:
        "Sei l’unico admin di Mobile, Web e ci sono altri membri: nomina un altro admin o elimina il progetto, poi riprova.",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("keeps the session when the auth user cannot be removed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteUser.mockResolvedValue({ error: { message: "boom" } });

    expect(await deleteAccount()).toEqual({ error: "Eliminazione non riuscita. Riprova." });
    expect(signOut).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses without an authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await deleteAccount()).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(rpc).not.toHaveBeenCalled();
  });
});
