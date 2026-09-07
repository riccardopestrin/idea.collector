import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailForm } from "./EmailForm";

const updateUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({ auth: { updateUser } }),
}));

describe("EmailForm", () => {
  beforeEach(() => {
    updateUser.mockReset().mockResolvedValue({ error: null });
  });

  it("prefills the field with the current email", () => {
    render(<EmailForm currentEmail="me@hint.app" />);

    expect(screen.getByLabelText("Email")).toHaveValue("me@hint.app");
  });

  it("refuses the unchanged email without calling GoTrue", async () => {
    const user = userEvent.setup();
    render(<EmailForm currentEmail="me@hint.app" />);

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), " ME@hint.app ");
    await user.click(screen.getByRole("button", { name: "Cambia email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("È già la tua email.");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("asks GoTrue to change the email and tells to confirm both mailboxes", async () => {
    const user = userEvent.setup();
    render(<EmailForm currentEmail="me@hint.app" />);

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "new@hint.app");
    await user.click(screen.getByRole("button", { name: "Cambia email" }));

    expect(updateUser).toHaveBeenCalledWith({ email: "new@hint.app" });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Link inviati a new@hint.app e alla casella attuale.",
    );
  });

  it("shows an error when GoTrue refuses", async () => {
    updateUser.mockResolvedValue({ error: { message: "boom" } });
    const user = userEvent.setup();
    render(<EmailForm currentEmail="me@hint.app" />);

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "new@hint.app");
    await user.click(screen.getByRole("button", { name: "Cambia email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invio non riuscito. Riprova.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
