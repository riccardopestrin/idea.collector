import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { disconnectGithub, selectRepo, startGithubConnect } from "@/app/projects/actions";

import { GithubRepoSection } from "./GithubRepoSection";

vi.mock("@/app/projects/actions", () => ({
  disconnectGithub: vi.fn(),
  selectRepo: vi.fn(),
  startGithubConnect: vi.fn(),
}));

const repos = [
  { owner: "acme", name: "ideas" },
  { owner: "acme", name: "site" },
];

describe("GithubRepoSection", () => {
  beforeEach(() => {
    for (const fn of [disconnectGithub, selectRepo, startGithubConnect]) {
      vi.mocked(fn).mockReset().mockResolvedValue(null);
    }
  });

  it("offers only the connect button when GitHub is not connected", async () => {
    const user = userEvent.setup();
    render(<GithubRepoSection projectId="pr1" connected={false} selectedRepo={null} repos={[]} />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scollega GitHub" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connetti GitHub" }));
    expect(startGithubConnect).toHaveBeenCalledWith("pr1");
  });

  it("lists the authorized repos with a placeholder until one is chosen, and submits the choice", async () => {
    const user = userEvent.setup();
    render(<GithubRepoSection projectId="pr1" connected selectedRepo={null} repos={repos} />);

    const select = screen.getByLabelText("Repo del progetto");
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "— scegli una repo —" })).toBeInTheDocument();

    await user.selectOptions(select, "acme/site");
    await user.click(screen.getByRole("button", { name: "Salva repo" }));
    // selectRepo è legata al projectId via bind: (projectId, prev, formData)
    expect(vi.mocked(selectRepo).mock.calls[0][0]).toBe("pr1");
    expect(vi.mocked(selectRepo).mock.calls[0][2].get("repo")).toBe("acme/site");
  });

  it("shows the connected repo preselected without the placeholder, and can disconnect", async () => {
    const user = userEvent.setup();
    render(<GithubRepoSection projectId="pr1" connected selectedRepo="acme/ideas" repos={repos} />);

    expect(screen.getByLabelText("Repo del progetto")).toHaveValue("acme/ideas");
    expect(screen.queryByRole("option", { name: "— scegli una repo —" })).not.toBeInTheDocument();
    expect(screen.getByText("acme/ideas", { selector: "span" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Scollega GitHub" }));
    expect(disconnectGithub).toHaveBeenCalledWith("pr1");
  });

  it("surfaces the server-side load error and the action error in the alert", async () => {
    vi.mocked(selectRepo).mockResolvedValue({
      error: "Repo non coperta dall'autorizzazione GitHub.",
    });
    const user = userEvent.setup();
    render(
      <GithubRepoSection
        projectId="pr1"
        connected
        selectedRepo={null}
        repos={repos}
        loadError="Impossibile leggere le repo da GitHub. Riprova o riconnetti."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Impossibile leggere le repo");

    await user.selectOptions(screen.getByLabelText("Repo del progetto"), "acme/ideas");
    await user.click(screen.getByRole("button", { name: "Salva repo" }));
    // l'errore dell'action ha precedenza su quello di caricamento
    expect(await screen.findByRole("alert")).toHaveTextContent("Repo non coperta");
  });
});
