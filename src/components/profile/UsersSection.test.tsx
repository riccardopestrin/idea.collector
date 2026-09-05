import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { inviteUser, setUserDisabled, setUserRole } from "@/app/profile/actions";

import { type UserRow, UsersSection } from "./UsersSection";

vi.mock("@/app/profile/actions", () => ({
  inviteUser: vi.fn(),
  setUserDisabled: vi.fn(),
  setUserRole: vi.fn(),
}));

const me: UserRow = { id: "u1", email: "me@hint.app", name: "Ric", role: "admin", disabled: false };
const ada: UserRow = { id: "u2", email: "ada@hint.app", name: null, role: "contributor", disabled: false };

describe("UsersSection", () => {
  beforeEach(() => {
    vi.mocked(inviteUser).mockReset().mockResolvedValue(null);
    vi.mocked(setUserDisabled).mockReset().mockResolvedValue(null);
    vi.mocked(setUserRole).mockReset().mockResolvedValue(null);
  });

  it("locks the current admin's own row: role select disabled, no disable button", () => {
    render(<UsersSection users={[me, ada]} currentUserId="u1" />);

    expect(screen.getByRole("combobox", { name: "Ruolo di me@hint.app" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Disabilita me@hint.app" })).not.toBeInTheDocument();

    expect(screen.getByRole("combobox", { name: "Ruolo di ada@hint.app" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Disabilita ada@hint.app" })).toBeInTheDocument();
  });

  it("changes a role through the action as soon as the select changes", async () => {
    const user = userEvent.setup();
    render(<UsersSection users={[me, ada]} currentUserId="u1" />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Ruolo di ada@hint.app" }), "admin");

    expect(setUserRole).toHaveBeenCalledWith("u2", "admin");
  });

  it("disables a user only after the confirm step, and cancel backs out", async () => {
    const user = userEvent.setup();
    render(<UsersSection users={[me, ada]} currentUserId="u1" />);

    await user.click(screen.getByRole("button", { name: "Disabilita ada@hint.app" }));
    expect(setUserDisabled).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByRole("button", { name: "Conferma" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disabilita ada@hint.app" }));
    await user.click(screen.getByRole("button", { name: "Conferma" }));
    expect(setUserDisabled).toHaveBeenCalledWith("u2", true);
  });

  it("shows a disabled user with a badge and a direct re-enable button", async () => {
    const user = userEvent.setup();
    render(<UsersSection users={[me, { ...ada, disabled: true }]} currentUserId="u1" />);

    const row = screen.getByText("ada@hint.app").closest("li")!;
    expect(within(row).getByText("disabilitato")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /Disabilita/ })).not.toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Riabilita ada@hint.app" }));
    expect(setUserDisabled).toHaveBeenCalledWith("u2", false);
  });

  it("invites with email + admin flag and reports success", async () => {
    const user = userEvent.setup();
    render(<UsersSection users={[me]} currentUserId="u1" />);

    await user.type(screen.getByLabelText("Email da invitare"), "new@hint.app");
    await user.click(screen.getByRole("checkbox", { name: "Admin" }));
    await user.click(screen.getByRole("button", { name: "Invita" }));

    const formData = vi.mocked(inviteUser).mock.calls[0][1];
    expect(formData.get("email")).toBe("new@hint.app");
    expect(formData.get("admin")).toBe("on");
    expect(await screen.findByRole("status")).toHaveTextContent("Invito inviato a new@hint.app.");
  });

  it("shows the invite error returned by the action", async () => {
    vi.mocked(inviteUser).mockResolvedValue({ error: "Invito non riuscito. Riprova." });
    const user = userEvent.setup();
    render(<UsersSection users={[me]} currentUserId="u1" />);

    await user.type(screen.getByLabelText("Email da invitare"), "new@hint.app");
    await user.click(screen.getByRole("button", { name: "Invita" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invito non riuscito. Riprova.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
