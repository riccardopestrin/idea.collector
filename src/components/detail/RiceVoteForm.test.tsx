import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RiceVoteForm } from "./RiceVoteForm";

const submitRiceVote = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/app/proposals/[id]/actions", () => ({ submitRiceVote }));

afterEach(() => {
  submitRiceVote.mockClear();
});

describe("RiceVoteForm", () => {
  it("submits directly, without a confirm dialog, when the proposal is in valutazione", async () => {
    render(<RiceVoteForm proposalId="p1" status="in_valutazione" existingVote={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Invia voto" }));

    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("open");
    expect(submitRiceVote).toHaveBeenCalledWith("p1", null, expect.any(FormData));
  });

  it("opens the confirm dialog before voting a card that is not in valutazione (#9d)", async () => {
    render(<RiceVoteForm proposalId="p1" status="approvata" existingVote={null} />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).not.toHaveAttribute("open");

    await userEvent.click(screen.getByRole("button", { name: "Invia voto" }));

    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Sei sicuro di voler votare?" })).toBeInTheDocument();
    expect(submitRiceVote).not.toHaveBeenCalled();
  });

  it("submits the vote only after confirming in the dialog (#9d)", async () => {
    render(<RiceVoteForm proposalId="p1" status="approvata" existingVote={null} />);

    const [openButton] = screen.getAllByRole("button", { name: "Invia voto" });
    await userEvent.click(openButton);
    const [, confirmButton] = screen.getAllByRole("button", { name: "Invia voto" });
    await userEvent.click(confirmButton);

    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("open");
    expect(submitRiceVote).toHaveBeenCalledWith("p1", null, expect.any(FormData));
  });

  it("does not submit when the user cancels that confirmation (#9d)", async () => {
    render(<RiceVoteForm proposalId="p1" status="approvata" existingVote={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Invia voto" }));
    await userEvent.click(screen.getByRole("button", { name: "Annulla" }));

    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("open");
    expect(submitRiceVote).not.toHaveBeenCalled();
  });

  it("prefills the sliders and labels the button 'Aggiorna voto' for an existing vote (#8)", () => {
    const { container } = render(
      <RiceVoteForm
        proposalId="p1"
        status="in_valutazione"
        existingVote={{ reach: 8, impact: 3, confidence: 9, effort: 2 }}
      />,
    );

    expect(screen.getByRole("button", { name: "Aggiorna voto" })).toBeInTheDocument();
    expect(container.querySelector<HTMLInputElement>('input[name="reach"]')?.value).toBe("8");
    expect(container.querySelector<HTMLInputElement>('input[name="effort"]')?.value).toBe("2");
  });
});
