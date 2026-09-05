import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateProposal, runProposalScanAction } from "@/app/proposals/actions";

import { RetryButton } from "./RetryButton";

vi.mock("@/app/proposals/actions", () => ({
  evaluateProposal: vi.fn(),
  runProposalScanAction: vi.fn(),
}));

describe("RetryButton", () => {
  beforeEach(() => {
    vi.mocked(evaluateProposal).mockReset().mockResolvedValue(null);
    vi.mocked(runProposalScanAction).mockReset().mockResolvedValue(null);
  });

  it("relaunches the AI evaluation with force by default", async () => {
    const user = userEvent.setup();
    render(<RetryButton proposalId="p1" />);

    await user.click(screen.getByRole("button", { name: "Rilancia valutazione" }));

    expect(evaluateProposal).toHaveBeenCalledWith("p1", true);
    expect(runProposalScanAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("relaunches the duplicate scan for kind=scan and shows the action error", async () => {
    vi.mocked(runProposalScanAction).mockResolvedValue({
      error: "Scan duplicati fallito: boom",
    });
    const user = userEvent.setup();
    render(<RetryButton proposalId="p1" kind="scan" />);

    await user.click(screen.getByRole("button", { name: "Rilancia scansione" }));

    expect(runProposalScanAction).toHaveBeenCalledWith("p1", true);
    expect(evaluateProposal).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Scan duplicati fallito: boom");
  });

  it("does not let the click bubble up to the draggable card", async () => {
    const onPointerDown = vi.fn();
    const user = userEvent.setup();
    render(
      <div onPointerDown={onPointerDown}>
        <RetryButton proposalId="p1" />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Rilancia valutazione" }));
    expect(onPointerDown).not.toHaveBeenCalled();
  });
});
