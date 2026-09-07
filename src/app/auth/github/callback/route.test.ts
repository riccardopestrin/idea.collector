import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

// Cookie `github_connect_state` = "<nonce>.<projectId>" messo da startGithubConnect:
// il callback lega l'installazione al progetto letto dal cookie, mai dall'URL.
const {
  getUser,
  cookieGet,
  cookieDelete,
  isProjectAdmin,
  installationToken,
  listInstallationRepos,
  updateGithubSettings,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  isProjectAdmin: vi.fn(),
  installationToken: vi.fn(),
  listInstallationRepos: vi.fn(),
  updateGithubSettings: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser } }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, delete: cookieDelete }),
}));
vi.mock("@/lib/projects", () => ({ isProjectAdmin }));
vi.mock("@/lib/github/app", () => ({ installationToken, listInstallationRepos }));
vi.mock("@/lib/github/settings", () => ({ updateGithubSettings }));

const call = (query: string) =>
  GET(new Request(`https://app.test/auth/github/callback?${query}`));
const location = (response: Response) => new URL(response.headers.get("location")!).pathname
  + new URL(response.headers.get("location")!).search;

describe("GitHub callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    cookieGet.mockReturnValue({ value: "nonce1.pr1" });
    isProjectAdmin.mockResolvedValue(true);
    installationToken.mockResolvedValue("tok");
    listInstallationRepos.mockResolvedValue([{ owner: "acme", name: "ideas" }]);
    updateGithubSettings.mockResolvedValue(null);
  });

  it("sends an anonymous visitor to the login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(location(await call("state=nonce1&installation_id=42"))).toBe("/login");
    expect(updateGithubSettings).not.toHaveBeenCalled();
  });

  it("rejects a state that does not match the cookie nonce and consumes the cookie", async () => {
    expect(location(await call("state=forged&installation_id=42"))).toBe("/");
    expect(cookieDelete).toHaveBeenCalledWith("github_connect_state");
    expect(updateGithubSettings).not.toHaveBeenCalled();
  });

  it("rejects a cookie without the project part", async () => {
    cookieGet.mockReturnValue({ value: "nonce1" });
    expect(location(await call("state=nonce1&installation_id=42"))).toBe("/");
    expect(isProjectAdmin).not.toHaveBeenCalled();
  });

  it("sends a non-admin of the project back to its board without writing", async () => {
    isProjectAdmin.mockResolvedValue(false);
    expect(location(await call("state=nonce1&installation_id=42"))).toBe("/projects/pr1");
    expect(isProjectAdmin).toHaveBeenCalledWith(expect.anything(), "pr1", "u1");
    expect(updateGithubSettings).not.toHaveBeenCalled();
  });

  it("flags a malformed installation_id on the project settings", async () => {
    expect(location(await call("state=nonce1&installation_id=abc"))).toBe(
      "/projects/pr1/settings?github=error",
    );
    expect(installationToken).not.toHaveBeenCalled();
  });

  it("verifies the installation, saves it on the project from the cookie and picks the only repo", async () => {
    expect(location(await call("state=nonce1&installation_id=42"))).toBe("/projects/pr1/settings");
    expect(installationToken).toHaveBeenCalledWith(42);
    expect(updateGithubSettings).toHaveBeenCalledWith("pr1", {
      github_installation_id: 42,
      github_owner: "acme",
      github_repo: "ideas",
    });
  });

  it("leaves the repo unselected when the installation covers several", async () => {
    listInstallationRepos.mockResolvedValue([
      { owner: "acme", name: "ideas" },
      { owner: "acme", name: "site" },
    ]);
    await call("state=nonce1&installation_id=42");
    expect(updateGithubSettings).toHaveBeenCalledWith("pr1", {
      github_installation_id: 42,
      github_owner: null,
      github_repo: null,
    });
  });

  it("maps a failed installation verification to the settings error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installationToken.mockRejectedValue(new Error("not our app"));
    expect(location(await call("state=nonce1&installation_id=42"))).toBe(
      "/projects/pr1/settings?github=error",
    );
    expect(updateGithubSettings).not.toHaveBeenCalled();
  });
});
