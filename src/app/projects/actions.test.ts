import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createProject,
  disconnectGithub,
  inviteMember,
  removeMember,
  selectRepo,
  setMemberRole,
  startGithubConnect,
} from "./actions";

// Builder finto per project_members: insert/update/delete registrano le
// scritture e risolvono il risultato configurato. rpc pilota create_project;
// isProjectAdmin il ruolo di chi chiama.
const {
  getUser,
  rpc,
  membersInsert,
  membersUpdate,
  membersDelete,
  writeResult,
  redirect,
  refresh,
  cookieSet,
  isProjectAdmin,
  listInstallationRepos,
  getGithubSettings,
  updateGithubSettings,
  inviteUserByEmail,
  adminProfile,
} = vi.hoisted(() => {
  const writeResult = { value: { error: null } as { error: unknown } };
  const chain = () => {
    const eq = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(writeResult.value)) }));
    return { eq };
  };
  return {
    getUser: vi.fn(),
    rpc: vi.fn(),
    membersInsert: vi.fn(() => Promise.resolve(writeResult.value)),
    membersUpdate: vi.fn(() => chain()),
    membersDelete: vi.fn(() => chain()),
    writeResult,
    redirect: vi.fn(),
    refresh: vi.fn(),
    cookieSet: vi.fn(),
    isProjectAdmin: vi.fn(),
    listInstallationRepos: vi.fn(),
    getGithubSettings: vi.fn(),
    updateGithubSettings: vi.fn(),
    inviteUserByEmail: vi.fn(),
    // profiles.select().eq().maybeSingle() lato service-role
    adminProfile: { value: null as { id: string } | null },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser },
    rpc,
    from: () => ({ insert: membersInsert, update: membersUpdate, delete: membersDelete }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    auth: { admin: { inviteUserByEmail } },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: adminProfile.value }) }),
      }),
    }),
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet }) }));
vi.mock("@/lib/projects", () => ({ isProjectAdmin, ROLES: ["admin", "contributor"] }));
vi.mock("@/lib/github/app", () => ({ listInstallationRepos }));
vi.mock("@/lib/github/settings", () => ({ getGithubSettings, updateGithubSettings }));

const formOf = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  isProjectAdmin.mockResolvedValue(true);
  rpc.mockResolvedValue({ data: "pr9", error: null });
  writeResult.value = { error: null };
  adminProfile.value = null;
  inviteUserByEmail.mockResolvedValue({ data: { user: { id: "new-1" } }, error: null });
  getGithubSettings.mockResolvedValue({
    github_installation_id: 42,
    github_owner: null,
    github_repo: null,
  });
  listInstallationRepos.mockResolvedValue([{ owner: "acme", name: "ideas" }]);
  updateGithubSettings.mockResolvedValue(null);
});

describe("createProject", () => {
  it("rejects an empty name without calling the RPC", async () => {
    expect(await createProject(null, formOf({ name: "   " }))).toEqual({
      error: "Il nome è obbligatorio.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a name longer than 80 characters", async () => {
    expect(await createProject(null, formOf({ name: "x".repeat(81) }))).toEqual({
      error: "Il nome è troppo lungo (max 80 caratteri).",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates through create_project with the trimmed name and lands on the board", async () => {
    await createProject(null, formOf({ name: "  Mobile  " }));

    expect(rpc).toHaveBeenCalledWith("create_project", { p_name: "Mobile" });
    expect(redirect).toHaveBeenCalledWith("/projects/pr9");
  });

  it("lands on the settings when the user asked to connect a repo right away", async () => {
    await createProject(null, formOf({ name: "Mobile", connect_repo: "on" }));

    expect(redirect).toHaveBeenCalledWith("/projects/pr9/settings");
  });

  it("maps an RPC failure to a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    expect(await createProject(null, formOf({ name: "Mobile" }))).toEqual({
      error: "Errore nel salvataggio. Riprova.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await createProject(null, formOf({ name: "Mobile" }))).toEqual({
      error: "Sessione scaduta. Rientra e riprova.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("inviteMember", () => {
  it("refuses a non-admin of the project", async () => {
    isProjectAdmin.mockResolvedValue(false);

    expect(await inviteMember("pr1", null, formOf({ email: "a@b.co" }))).toEqual({
      error: "Solo un admin del progetto può gestire i membri.",
    });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed email before calling Supabase", async () => {
    expect(await inviteMember("pr1", null, formOf({ email: "not-an-email" }))).toEqual({
      error: "Email non valida.",
    });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("invites a new user with the normalized email and adds the membership", async () => {
    expect(await inviteMember("pr1", null, formOf({ email: " Ada@Hint.App " }))).toEqual({
      invited: "ada@hint.app",
    });
    expect(inviteUserByEmail).toHaveBeenCalledWith("ada@hint.app");
    expect(membersInsert).toHaveBeenCalledWith({
      project_id: "pr1",
      user_id: "new-1",
      role: "contributor",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("adds the invitee as admin when the flag is set", async () => {
    await inviteMember("pr1", null, formOf({ email: "ada@hint.app", admin: "on" }));

    expect(membersInsert).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
  });

  it("only adds the membership when the email already has an account", async () => {
    inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: "registered" } });
    adminProfile.value = { id: "old-7" };

    expect(await inviteMember("pr1", null, formOf({ email: "ada@hint.app" }))).toEqual({
      added: "ada@hint.app",
    });
    expect(membersInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "old-7" }));
  });

  it("maps an invite failure for an unknown email to a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: "smtp" } });

    expect(await inviteMember("pr1", null, formOf({ email: "ada@hint.app" }))).toEqual({
      error: "Invito non riuscito. Riprova.",
    });
    expect(membersInsert).not.toHaveBeenCalled();
  });

  it("reports an existing member on unique violation", async () => {
    writeResult.value = { error: { code: "23505" } };

    expect(await inviteMember("pr1", null, formOf({ email: "ada@hint.app" }))).toEqual({
      error: "È già membro del progetto.",
    });
  });
});

describe("setMemberRole", () => {
  it("rejects an unknown role", async () => {
    expect(await setMemberRole("pr1", "u2", "owner")).toEqual({ error: "Ruolo non valido." });
    expect(membersUpdate).not.toHaveBeenCalled();
  });

  it("refuses to change the caller's own role", async () => {
    expect(await setMemberRole("pr1", "u1", "contributor")).toEqual({
      error: "Non puoi cambiare il tuo stesso ruolo.",
    });
    expect(membersUpdate).not.toHaveBeenCalled();
  });

  it("updates another member's role and refreshes", async () => {
    expect(await setMemberRole("pr1", "u2", "admin")).toBeNull();
    expect(membersUpdate).toHaveBeenCalledWith({ role: "admin" });
    expect(refresh).toHaveBeenCalled();
  });
});

describe("removeMember", () => {
  it("refuses to remove the caller", async () => {
    expect(await removeMember("pr1", "u1")).toEqual({ error: "Non puoi rimuovere te stesso." });
    expect(membersDelete).not.toHaveBeenCalled();
  });

  it("deletes another member's membership and refreshes", async () => {
    expect(await removeMember("pr1", "u2")).toBeNull();
    expect(membersDelete).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("maps a delete failure to a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeResult.value = { error: { message: "boom" } };

    expect(await removeMember("pr1", "u2")).toEqual({ error: "Operazione non riuscita. Riprova." });
  });
});

describe("GitHub actions", () => {
  describe("selectRepo", () => {
    it("refuses a non-admin of the project", async () => {
      isProjectAdmin.mockResolvedValue(false);

      expect(await selectRepo("pr1", null, formOf({ repo: "acme/ideas" }))).toEqual({
        error: "Solo un admin del progetto può configurare GitHub.",
      });
      expect(updateGithubSettings).not.toHaveBeenCalled();
    });

    it("errors when no GitHub installation is active", async () => {
      getGithubSettings.mockResolvedValue(null);

      expect(await selectRepo("pr1", null, formOf({ repo: "acme/ideas" }))).toEqual({
        error: "Nessuna autorizzazione GitHub attiva. Connetti GitHub prima.",
      });
      expect(updateGithubSettings).not.toHaveBeenCalled();
    });

    it("rejects a repo outside the authorized installation", async () => {
      expect(await selectRepo("pr1", null, formOf({ repo: "evil/other" }))).toEqual({
        error: "Repo non coperta dall'autorizzazione GitHub.",
      });
      expect(updateGithubSettings).not.toHaveBeenCalled();
    });

    it("saves the selected repo on the project and refreshes", async () => {
      expect(await selectRepo("pr1", null, formOf({ repo: "acme/ideas" }))).toBeNull();
      expect(updateGithubSettings).toHaveBeenCalledWith("pr1", {
        github_owner: "acme",
        github_repo: "ideas",
      });
      expect(refresh).toHaveBeenCalled();
    });
  });

  describe("startGithubConnect", () => {
    it("refuses a non-admin of the project", async () => {
      isProjectAdmin.mockResolvedValue(false);

      expect(await startGithubConnect("pr1")).toEqual({
        error: "Solo un admin del progetto può configurare GitHub.",
      });
      expect(redirect).not.toHaveBeenCalled();
    });

    it("errors when GITHUB_APP_SLUG is missing", async () => {
      vi.stubEnv("GITHUB_APP_SLUG", "");

      expect(await startGithubConnect("pr1")).toEqual({
        error: "GitHub App non configurata (manca GITHUB_APP_SLUG).",
      });
      expect(redirect).not.toHaveBeenCalled();
    });

    it("stores nonce + project in the cookie and redirects to the install URL with the nonce as state", async () => {
      vi.stubEnv("GITHUB_APP_SLUG", "idea-app");

      await startGithubConnect("pr1");

      const [name, value, options] = cookieSet.mock.calls[0];
      expect(name).toBe("github_connect_state");
      expect(options).toMatchObject({ httpOnly: true, sameSite: "lax" });
      const [state, projectId] = String(value).split(".");
      expect(projectId).toBe("pr1");
      expect(redirect).toHaveBeenCalledWith(
        `https://github.com/apps/idea-app/installations/new?state=${state}`,
      );
    });
  });

  describe("disconnectGithub", () => {
    it("refuses a non-admin of the project", async () => {
      isProjectAdmin.mockResolvedValue(false);

      expect(await disconnectGithub("pr1")).toEqual({
        error: "Solo un admin del progetto può configurare GitHub.",
      });
      expect(updateGithubSettings).not.toHaveBeenCalled();
    });

    it("clears the project's GitHub settings and refreshes", async () => {
      expect(await disconnectGithub("pr1")).toBeNull();
      expect(updateGithubSettings).toHaveBeenCalledWith("pr1", {
        github_installation_id: null,
        github_owner: null,
        github_repo: null,
      });
      expect(refresh).toHaveBeenCalled();
    });
  });
});
