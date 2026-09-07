import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { getMemberRole, isProjectAdmin, listMembers, listProjects } from "./projects";

// Query builder finto: ogni filtro ritorna se stesso e registra le chiamate;
// overrideTypes / maybeSingle chiudono la catena risolvendo { data }.
function fakeBuilder(data: unknown) {
  const eq = vi.fn();
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: eq.mockImplementation(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data })),
    overrideTypes: vi.fn(() => Promise.resolve({ data })),
  };
  const from = vi.fn(() => builder);
  return { supabase: { from } as unknown as SupabaseClient, from, eq };
}

describe("listProjects", () => {
  it("maps the caller's membership and the proposal count onto each project", async () => {
    const { supabase, eq } = fakeBuilder([
      {
        id: "pr1", name: "Mobile", github_owner: "acme", github_repo: "app",
        members: [{ role: "admin" }], proposals: [{ count: 3 }],
      },
      {
        id: "pr2", name: "Web", github_owner: null, github_repo: null,
        members: [{ role: "contributor" }], proposals: [],
      },
    ]);

    const projects = await listProjects(supabase, "u1");

    // il filtro sull'embed tiene solo la membership di chi guarda
    expect(eq).toHaveBeenCalledWith("members.user_id", "u1");
    expect(projects).toEqual([
      { id: "pr1", name: "Mobile", github_owner: "acme", github_repo: "app", role: "admin", proposalCount: 3 },
      { id: "pr2", name: "Web", github_owner: null, github_repo: null, role: "contributor", proposalCount: 0 },
    ]);
  });

  it("returns an empty list when the query yields no data", async () => {
    const { supabase } = fakeBuilder(null);
    expect(await listProjects(supabase, "u1")).toEqual([]);
  });
});

describe("getMemberRole / isProjectAdmin", () => {
  it("reads the role of the pair (project, user) and null for a non-member", async () => {
    const { supabase, from, eq } = fakeBuilder({ role: "admin" });

    expect(await getMemberRole(supabase, "pr1", "u1")).toBe("admin");
    expect(from).toHaveBeenCalledWith("project_members");
    expect(eq).toHaveBeenCalledWith("project_id", "pr1");
    expect(eq).toHaveBeenCalledWith("user_id", "u1");

    expect(await getMemberRole(fakeBuilder(null).supabase, "pr1", "u1")).toBeNull();
  });

  it("isProjectAdmin is true only for the admin role", async () => {
    expect(await isProjectAdmin(fakeBuilder({ role: "admin" }).supabase, "pr1", "u1")).toBe(true);
    expect(await isProjectAdmin(fakeBuilder({ role: "contributor" }).supabase, "pr1", "u1")).toBe(false);
    expect(await isProjectAdmin(fakeBuilder(null).supabase, "pr1", "u1")).toBe(false);
  });
});

describe("listMembers", () => {
  it("flattens the embedded profile onto each membership", async () => {
    const { supabase, eq } = fakeBuilder([
      { user_id: "u1", role: "admin", profile: { email: "me@hint.app", name: "Ric" } },
      { user_id: "u2", role: "contributor", profile: null },
    ]);

    expect(await listMembers(supabase, "pr1")).toEqual([
      { id: "u1", email: "me@hint.app", name: "Ric", role: "admin" },
      { id: "u2", email: "", name: null, role: "contributor" },
    ]);
    expect(eq).toHaveBeenCalledWith("project_id", "pr1");
  });
});
