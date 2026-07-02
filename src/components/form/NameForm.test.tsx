import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateName } from "@/app/profile/actions";
import { NameForm } from "./NameForm";

vi.mock("@/app/profile/actions", () => ({ updateName: vi.fn() }));

describe("NameForm", () => {
  beforeEach(() => {
    vi.mocked(updateName).mockReset().mockResolvedValue(null);
  });

  it("renders the heading and prefills the field with the current name", () => {
    render(<NameForm heading="Profilo" defaultName="Riccardo" />);

    expect(screen.getByRole("heading", { name: "Profilo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Riccardo");
  });

  it("starts empty when there is no name yet", () => {
    render(<NameForm heading="Come ti chiami?" />);

    expect(screen.getByLabelText("Nome")).toHaveValue("");
  });

  it("submits the typed name to the action and shows its error", async () => {
    vi.mocked(updateName).mockResolvedValue({
      error: "Il nome è troppo lungo (max 80 caratteri).",
    });
    const user = userEvent.setup();
    render(<NameForm heading="Profilo" />);

    await user.type(screen.getByLabelText("Nome"), "Riccardo");
    await user.click(screen.getByRole("button", { name: "Salva" }));

    const formData = vi.mocked(updateName).mock.calls[0][1];
    expect(formData.get("name")).toBe("Riccardo");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Il nome è troppo lungo (max 80 caratteri).",
    );
  });
});
