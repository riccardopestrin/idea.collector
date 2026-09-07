import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RefSection } from "./RefSection";

const texts = {
  heading: "Branch / PR",
  edit: "Modifica branch / PR",
  label: "Branch o numero PR",
  placeholder: "feature/x",
  hint: "Lascia vuoto per rimuoverlo.",
};
const noop = vi.fn().mockResolvedValue(null);

describe("RefSection", () => {
  it("links the value when an href is given and offers edit only to those allowed", () => {
    const { rerender } = render(
      <RefSection texts={texts} name="git_ref" value="feature/x" href="https://g/h" canEdit={false} action={noop} />,
    );
    expect(screen.getByRole("link", { name: "feature/x" })).toHaveAttribute("href", "https://g/h");
    expect(screen.queryByRole("button", { name: "Modifica branch / PR" })).not.toBeInTheDocument();

    rerender(
      <RefSection texts={texts} name="git_ref" value="feature/x" href="https://g/h" canEdit action={noop} />,
    );
    expect(screen.getByRole("button", { name: "Modifica branch / PR" })).toBeInTheDocument();
  });

  it("renders plain text without an href, and a dash when unset", () => {
    const { rerender } = render(
      <RefSection texts={texts} name="git_ref" value="#42" href={null} canEdit={false} action={noop} />,
    );
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(
      <RefSection texts={texts} name="git_ref" value={null} href={null} canEdit={false} action={noop} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("submits the typed value under its field name and shows the action error", async () => {
    const action = vi.fn().mockResolvedValue({ error: "Riferimento non valido" });
    const user = userEvent.setup();
    render(<RefSection texts={texts} name="git_ref" value={null} href={null} canEdit action={action} />);

    await user.click(screen.getByRole("button", { name: "Modifica branch / PR" }));
    await user.type(screen.getByLabelText("Branch o numero PR"), "two words");
    await user.click(screen.getByRole("button", { name: "Salva" }));

    expect(action.mock.calls[0][1].get("git_ref")).toBe("two words");
    expect(await screen.findByRole("alert")).toHaveTextContent("Riferimento non valido");
  });

  it("leaves edit mode after a successful save", async () => {
    const user = userEvent.setup();
    render(<RefSection texts={texts} name="git_ref" value="old" href={null} canEdit action={noop} />);

    await user.click(screen.getByRole("button", { name: "Modifica branch / PR" }));
    await user.click(screen.getByRole("button", { name: "Salva" }));

    expect(await screen.findByRole("button", { name: "Modifica branch / PR" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Branch o numero PR")).not.toBeInTheDocument();
  });
});
