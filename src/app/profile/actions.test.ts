import { beforeEach, describe, expect, it, vi } from "vitest";

import { disconnectGithub, selectRepo, startGithubConnect, updateName } from "./actions";

const {
  getUser,
  update,
  eq,
  from,
  redirect,
  refresh,
  cookieSet,
  getProfile,
  listInstallationRepos,
  getGithubSettings,
  upsertGithubSettings,
} = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  return {
    getUser: vi.fn(),
    update,
    eq,
    from: vi.fn(() => ({ update })),
    redirect: vi.fn(),
    refresh: vi.fn(),
    cookieSet: vi.fn(),
    getProfile: vi.fn(),
    listInstallationRepos: vi.fn(),
    getGithubSettings: vi.fn(),
    upsertGithubSettings: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser }, from }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet }) }));
vi.mock("@/lib/profiles", () => ({ getProfile }));
vi.mock("@/lib/github/app", () => ({ listInstallationRepos }));
vi.mock("@/lib/github/settings", () => ({ getGithubSettings, upsertGithubSettings }));

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

describe("GitHub actions", () => {
  // Setup comune: admin autenticato, installazione attiva che copre
  // acme/ideas, upsert che va a buon fine.
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    getProfile.mockResolvedValue({ role: "admin", name: "Ric" });
    getGithubSettings.mockResolvedValue({
      github_installation_id: 42,
      github_owner: null,
      github_repo: null,
    });
    listInstallationRepos.mockResolvedValue([{ owner: "acme", name: "ideas" }]);
    upsertGithubSettings.mockResolvedValue(null);
  });

  describe("selectRepo", () => {
    it("refuses a non-admin user", async () => {
      getProfile.mockResolvedValue({ role: "contributor", name: null });

      const result = await selectRepo(null, formOf({ repo: "acme/ideas" }));

      expect(result).toEqual({ error: "Solo un admin può configurare GitHub." });
      expect(upsertGithubSettings).not.toHaveBeenCalled();
    });

    it("errors when no GitHub installation is active", async () => {
      getGithubSettings.mockResolvedValue(null);

      const result = await selectRepo(null, formOf({ repo: "acme/ideas" }));

      expect(result).toEqual({
        error: "Nessuna autorizzazione GitHub attiva. Connetti GitHub prima.",
      });
      expect(upsertGithubSettings).not.toHaveBeenCalled();
    });

    it("rejects a repo outside the authorized installation", async () => {
      const result = await selectRepo(null, formOf({ repo: "evil/other" }));

      expect(result).toEqual({ error: "Repo non coperta dall'autorizzazione GitHub." });
      expect(upsertGithubSettings).not.toHaveBeenCalled();
    });

    it("saves the selected repo and refreshes", async () => {
      const result = await selectRepo(null, formOf({ repo: "acme/ideas" }));

      expect(result).toBeNull();
      expect(upsertGithubSettings).toHaveBeenCalledWith(expect.anything(), "u1", {
        github_owner: "acme",
        github_repo: "ideas",
      });
      expect(refresh).toHaveBeenCalled();
    });
  });

  describe("startGithubConnect", () => {
    it("refuses a non-admin user", async () => {
      getProfile.mockResolvedValue({ role: "contributor", name: null });

      const result = await startGithubConnect();

      expect(result).toEqual({ error: "Solo un admin può configurare GitHub." });
      expect(redirect).not.toHaveBeenCalled();
    });

    it("errors when GITHUB_APP_SLUG is missing", async () => {
      vi.stubEnv("GITHUB_APP_SLUG", "");

      const result = await startGithubConnect();

      expect(result).toEqual({ error: "GitHub App non configurata (manca GITHUB_APP_SLUG)." });
      expect(redirect).not.toHaveBeenCalled();
    });

    it("sets the anti-CSRF nonce cookie and redirects to the install URL with the same state", async () => {
      vi.stubEnv("GITHUB_APP_SLUG", "idea-app");

      await startGithubConnect();

      const [name, state, options] = cookieSet.mock.calls[0];
      expect(name).toBe("github_connect_state");
      expect(options).toMatchObject({ httpOnly: true, sameSite: "lax" });
      expect(redirect).toHaveBeenCalledWith(
        `https://github.com/apps/idea-app/installations/new?state=${state}`,
      );
    });
  });

  describe("disconnectGithub", () => {
    it("refuses a non-admin user", async () => {
      getProfile.mockResolvedValue({ role: "contributor", name: null });

      const result = await disconnectGithub();

      expect(result).toEqual({ error: "Solo un admin può configurare GitHub." });
      expect(upsertGithubSettings).not.toHaveBeenCalled();
    });

    it("clears the GitHub settings and refreshes", async () => {
      const result = await disconnectGithub();

      expect(result).toBeNull();
      expect(upsertGithubSettings).toHaveBeenCalledWith(expect.anything(), "u1", {
        github_installation_id: null,
        github_owner: null,
        github_repo: null,
      });
      expect(refresh).toHaveBeenCalled();
    });
  });
});
