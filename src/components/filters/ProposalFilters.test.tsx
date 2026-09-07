import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PROPOSAL_STATUSES } from "@/lib/proposals";

import { ProposalFilters } from "./ProposalFilters";

describe("ProposalFilters", () => {
  it("offers a chip for every DB status plus an all-statuses one, pressed when nothing is selected", () => {
    render(<ProposalFilters search="" basePath="/" />);
    const chips = within(screen.getByRole("navigation", { name: /filtra per stato/i })).getAllByRole("link");
    expect(chips).toHaveLength(PROPOSAL_STATUSES.length + 1);
    expect(chips[0]).toHaveTextContent("Tutti gli stati");
    expect(chips[0]).toHaveAttribute("aria-pressed", "true");
    expect(chips[1]).toHaveAttribute("aria-pressed", "false");
  });

  it("combines statuses in OR: a click adds or removes one, keeping the search", () => {
    render(
      <ProposalFilters search="mappa" statuses={["approvata", "nuova"]} basePath="/p/1/ranking" />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("mappa");
    // gli stati attivi restano nel form (hidden) e nei chip premuti
    expect(document.querySelector('input[name="status"]')).toHaveValue("approvata,nuova");
    expect(screen.getByRole("link", { name: "Approvata" })).toHaveAttribute("aria-pressed", "true");
    // ricliccare uno stato attivo lo toglie; cliccarne uno nuovo lo aggiunge
    expect(screen.getByRole("link", { name: "Approvata" })).toHaveAttribute(
      "href",
      "/p/1/ranking?q=mappa&status=nuova",
    );
    expect(screen.getByRole("link", { name: "In Sviluppo" })).toHaveAttribute(
      "href",
      "/p/1/ranking?q=mappa&status=approvata%2Cnuova%2Cin_sviluppo",
    );
    // "Tutti gli stati" azzera la selezione
    const all = screen.getByRole("link", { name: "Tutti gli stati" });
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(all).toHaveAttribute("href", "/p/1/ranking?q=mappa");
  });

  it("clears the search field when the × is clicked", async () => {
    const user = userEvent.setup();
    render(<ProposalFilters search="mappa" basePath="/" />);

    await user.click(screen.getByRole("button", { name: /cancella ricerca/i }));

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("hides the × when the field is empty", () => {
    render(<ProposalFilters search="" basePath="/" />);
    expect(screen.queryByRole("button", { name: /cancella ricerca/i })).not.toBeInTheDocument();
  });

  it("shows a reset link to the full board only when a filter is active", () => {
    const { rerender } = render(<ProposalFilters search="" basePath="/" />);
    expect(screen.queryByRole("link", { name: /reset/i })).not.toBeInTheDocument();

    rerender(<ProposalFilters search="" statuses={["approvata"]} basePath="/" />);
    expect(screen.getByRole("link", { name: /reset/i })).toHaveAttribute("href", "/");
  });
});
