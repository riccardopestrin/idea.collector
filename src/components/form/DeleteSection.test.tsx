import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteSection } from "./DeleteSection";

const texts = {
  heading: "Elimina cosa",
  intro: "Sparisce tutto.",
  button: "Elimina cosa",
  confirmBody: "Irreversibile.",
  confirm: "Elimina definitivamente",
};

describe("DeleteSection", () => {
  it("opens the confirm dialog and cancel closes it without calling the action", async () => {
    const action = vi.fn().mockResolvedValue(null);
    const user = userEvent.setup();
    render(<DeleteSection texts={texts} confirmHeading="Eliminare “Mobile”?" action={action} />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).not.toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Elimina cosa" }));
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Eliminare “Mobile”?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(action).not.toHaveBeenCalled();
  });

  it("calls the action only after the confirm button", async () => {
    const action = vi.fn().mockResolvedValue(null);
    const user = userEvent.setup();
    render(<DeleteSection texts={texts} confirmHeading="Eliminare?" action={action} />);

    await user.click(screen.getByRole("button", { name: "Elimina cosa" }));
    await user.click(screen.getByRole("button", { name: "Elimina definitivamente" }));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows the action error inside the dialog", async () => {
    const action = vi.fn().mockResolvedValue({ error: "Eliminazione non riuscita. Riprova." });
    const user = userEvent.setup();
    render(<DeleteSection texts={texts} confirmHeading="Eliminare?" action={action} />);

    await user.click(screen.getByRole("button", { name: "Elimina cosa" }));
    await user.click(screen.getByRole("button", { name: "Elimina definitivamente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Eliminazione non riuscita. Riprova.");
  });
});
