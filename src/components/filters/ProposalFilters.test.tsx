import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PROPOSAL_STATUSES } from "@/lib/proposals";

import { ProposalFilters } from "./ProposalFilters";

describe("ProposalFilters", () => {
  it("offers every DB status plus an all-statuses option", () => {
    render(<ProposalFilters search="" status={undefined} />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(PROPOSAL_STATUSES.length + 1);
    expect(options[0]).toHaveTextContent("Tutti gli stati");
  });

  it("reflects the current search and status back into the controls", () => {
    render(<ProposalFilters search="mappa" status="approvata" />);
    expect(screen.getByRole("textbox")).toHaveValue("mappa");
    expect(screen.getByRole("combobox")).toHaveValue("approvata");
  });

  it("clears the search field when the × is clicked", async () => {
    const user = userEvent.setup();
    render(<ProposalFilters search="mappa" status={undefined} />);

    await user.click(screen.getByRole("button", { name: /cancella ricerca/i }));

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("hides the × when the field is empty", () => {
    render(<ProposalFilters search="" status={undefined} />);
    expect(screen.queryByRole("button", { name: /cancella ricerca/i })).not.toBeInTheDocument();
  });

  it("shows a reset link to the full board only when a filter is active", () => {
    const { rerender } = render(<ProposalFilters search="" status={undefined} />);
    expect(screen.queryByRole("link", { name: /azzera/i })).not.toBeInTheDocument();

    rerender(<ProposalFilters search="" status="approvata" />);
    expect(screen.getByRole("link", { name: /azzera/i })).toHaveAttribute("href", "/");
  });
});
