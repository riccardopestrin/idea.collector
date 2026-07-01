import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

const call = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`));

describe("proxy", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("redirects an unauthenticated visitor to the login from any protected path", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    for (const path of ["/", "/proposals/new"]) {
      const res = await call(path);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    }
  });

  it("lets an unauthenticated visitor reach the login and the magic-link callback", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    for (const path of ["/login", "/auth/callback"]) {
      const res = await call(path);
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("sends a logged-in user away from the login to the home", async () => {
    const res = await call("/login");

    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("lets a logged-in user through on protected paths", async () => {
    const res = await call("/proposals/new");

    expect(res.headers.get("location")).toBeNull();
  });
});
