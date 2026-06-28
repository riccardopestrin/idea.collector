import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => ({ auth: { exchangeCodeForSession } }),
}));

const call = (url: string) => GET(new NextRequest(url));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  });

  it("exchanges a valid code for a session and lands on the home", async () => {
    const res = await call("http://localhost:3000/auth/callback?code=abc123");

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects back to login when the code is missing", async () => {
    const res = await call("http://localhost:3000/auth/callback");

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("redirects back to login when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });

    const res = await call("http://localhost:3000/auth/callback?code=stale");

    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
