import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { inviteMember, removeMember, setMemberRole } from "@/app/projects/actions";
import type { Member } from "@/lib/projects";

import { MembersSection } from "./MembersSection";

vi.mock("@/app/projects/actions", () => ({
  inviteMember: vi.fn(),
  removeMember: vi.fn(),
  setMemberRole: vi.fn(),
}));

const me: Member = { id: "u1", email: "me@hint.app", name: "Ric", role: "admin" };
const ada: Member = { id: "u2", email: "ada@hint.app", name: null, role: "contributor" };

describe("MembersSection", () => {
  beforeEach(() => {
    vi.mocked(inviteMember).mockReset().mockResolvedValue({ invited: "x" });
    vi.mocked(removeMember).mockReset().mockResolvedValue(null);
    vi.mocked(setMemberRole).mockReset().mockResolvedValue(null);
  });

  it("locks the current admin's own row: role select disabled, no remove button", () => {
    render(<MembersSection projectId="pr1" members={[me, ada]} currentUserId="u1" />);

    expect(screen.getByRole("combobox", { name: "Ruolo di me@hint.app" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Rimuovi me@hint.app" })).not.toBeInTheDocument();

    expect(screen.getByRole("combobox", { name: "Ruolo di ada@hint.app" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Rimuovi ada@hint.app" })).toBeInTheDocument();
  });

  it("changes a role through the action as soon as the select changes", async () => {
    const user = userEvent.setup();
    render(<MembersSection projectId="pr1" members={[me, ada]} currentUserId="u1" />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Ruolo di ada@hint.app" }), "admin");

    expect(setMemberRole).toHaveBeenCalledWith("pr1", "u2", "admin");
  });

  it("removes a member only after the confirm step, and cancel backs out", async () => {
    const user = userEvent.setup();
    render(<MembersSection projectId="pr1" members={[me, ada]} currentUserId="u1" />);

    await user.click(screen.getByRole("button", { name: "Rimuovi ada@hint.app" }));
    expect(removeMember).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByRole("button", { name: "Conferma" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rimuovi ada@hint.app" }));
    await user.click(screen.getByRole("button", { name: "Conferma" }));
    expect(removeMember).toHaveBeenCalledWith("pr1", "u2");
  });

  it("invites with email + admin flag for the project and reports the invite", async () => {
    vi.mocked(inviteMember).mockResolvedValue({ invited: "new@hint.app" });
    const user = userEvent.setup();
    render(<MembersSection projectId="pr1" members={[me]} currentUserId="u1" />);

    await user.type(screen.getByLabelText("Email da invitare"), "new@hint.app");
    await user.click(screen.getByRole("checkbox", { name: "Admin" }));
    await user.click(screen.getByRole("button", { name: "Invita" }));

    const [projectId, , formData] = vi.mocked(inviteMember).mock.calls[0];
    expect(projectId).toBe("pr1");
    expect(formData.get("email")).toBe("new@hint.app");
    expect(formData.get("admin")).toBe("on");
    expect(await screen.findByRole("status")).toHaveTextContent("Invito inviato a new@hint.app.");
  });

  it("tells apart an existing account that was just added", async () => {
    vi.mocked(inviteMember).mockResolvedValue({ added: "old@hint.app" });
    const user = userEvent.setup();
    render(<MembersSection projectId="pr1" members={[me]} currentUserId="u1" />);

    await user.type(screen.getByLabelText("Email da invitare"), "old@hint.app");
    await user.click(screen.getByRole("button", { name: "Invita" }));

    expect(await screen.findByRole("status")).toHaveTextContent("old@hint.app aggiunto al progetto.");
  });

  it("shows the invite error returned by the action", async () => {
    vi.mocked(inviteMember).mockResolvedValue({ error: "Invito non riuscito. Riprova." });
    const user = userEvent.setup();
    render(<MembersSection projectId="pr1" members={[me]} currentUserId="u1" />);

    await user.type(screen.getByLabelText("Email da invitare"), "new@hint.app");
    await user.click(screen.getByRole("button", { name: "Invita" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invito non riuscito. Riprova.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
