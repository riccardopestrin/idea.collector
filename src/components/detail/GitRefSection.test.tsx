import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setGitRef } from "@/app/proposals/[id]/actions";

import { GitRefSection } from "./GitRefSection";

vi.mock("@/app/proposals/[id]/actions", () => ({ setGitRef: vi.fn() }));

const repo = { owner: "acme", name: "ideas" };

describe("GitRefSection", () => {
  beforeEach(() => {
    vi.mocked(setGitRef).mockReset().mockResolvedValue(null);
  });

  it("links the reference into the connected repo and offers edit only to those allowed", () => {
    const { rerender } = render(
      <GitRefSection proposalId="p1" gitRef="feature/x" repo={repo} canEdit={false} />,
    );
    expect(screen.getByRole("link", { name: "feature/x" })).toHaveAttribute(
      "href",
      "https://github.com/acme/ideas/tree/feature/x",
    );
    expect(screen.queryByRole("button", { name: "Modifica branch / PR" })).not.toBeInTheDocument();

    rerender(<GitRefSection proposalId="p1" gitRef="feature/x" repo={repo} canEdit />);
    expect(screen.getByRole("button", { name: "Modifica branch / PR" })).toBeInTheDocument();
  });

  it("renders the reference as plain text when no repo is connected, and a dash when unset", () => {
    const { rerender } = render(
      <GitRefSection proposalId="p1" gitRef="#42" repo={null} canEdit={false} />,
    );
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(<GitRefSection proposalId="p1" gitRef={null} repo={repo} canEdit={false} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("submits the typed reference to the action and shows its error", async () => {
    vi.mocked(setGitRef).mockResolvedValue({
      error: "Riferimento non valido: niente spazi, max 200 caratteri.",
    });
    const user = userEvent.setup();
    render(<GitRefSection proposalId="p1" gitRef={null} repo={repo} canEdit />);

    await user.click(screen.getByRole("button", { name: "Modifica branch / PR" }));
    await user.type(screen.getByLabelText("Branch o numero PR"), "two words");
    await user.click(screen.getByRole("button", { name: "Salva" }));

    expect(vi.mocked(setGitRef).mock.calls[0][0]).toBe("p1");
    expect(vi.mocked(setGitRef).mock.calls[0][2].get("git_ref")).toBe("two words");
    expect(await screen.findByRole("alert")).toHaveTextContent("Riferimento non valido");
  });
});
