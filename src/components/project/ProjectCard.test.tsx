import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProjectListItem } from "@/lib/projects";

import { ProjectCard } from "./ProjectCard";

const base: ProjectListItem = {
  id: "pr1",
  name: "Mobile",
  github_owner: "acme",
  github_repo: "app",
  role: "admin",
  proposalCount: 3,
};

describe("ProjectCard", () => {
  it("links to the project board and shows repo, proposal count and role", () => {
    render(<ProjectCard project={base} />);

    expect(screen.getByRole("link", { name: /Mobile/ })).toHaveAttribute("href", "/projects/pr1");
    expect(screen.getByText("acme/app")).toBeInTheDocument();
    expect(screen.getByText("3 proposte")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("falls back to 'nessuna repo' and the singular count", () => {
    render(
      <ProjectCard
        project={{ ...base, github_owner: null, github_repo: null, role: "contributor", proposalCount: 1 }}
      />,
    );

    expect(screen.getByText("nessuna repo collegata")).toBeInTheDocument();
    expect(screen.getByText("1 proposta")).toBeInTheDocument();
    expect(screen.getByText("Contributor")).toBeInTheDocument();
  });
});
