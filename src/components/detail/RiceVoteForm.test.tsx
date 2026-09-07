import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RiceVoteForm } from "./RiceVoteForm";

const submitRiceVote = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/app/proposals/[id]/actions", () => ({ submitRiceVote }));

afterEach(() => {
  vi.restoreAllMocks();
  submitRiceVote.mockClear();
});

describe("RiceVoteForm", () => {
  it("submits directly, without a confirm, when the proposal is in valutazione", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RiceVoteForm proposalId="p1" status="in_valutazione" existingVote={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Invia voto" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(submitRiceVote).toHaveBeenCalledWith("p1", null, expect.any(FormData));
  });

  it("asks for confirmation before voting a card that is not in valutazione (#9d)", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RiceVoteForm proposalId="p1" status="approvata" existingVote={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Invia voto" }));

    expect(confirm).toHaveBeenCalledOnce();
    expect(submitRiceVote).toHaveBeenCalled();
  });

  it("does not submit when the user cancels that confirmation (#9d)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<RiceVoteForm proposalId="p1" status="approvata" existingVote={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Invia voto" }));

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
