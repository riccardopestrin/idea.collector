import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => ({ auth: { exchangeCodeForSession, verifyOtp } }),
}));

const call = (url: string) => GET(new NextRequest(url));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
    verifyOtp.mockReset().mockResolvedValue({ error: null });
  });

  it("verifies an invite token_hash server-side and lands on the home", async () => {
    const res = await call("http://localhost:3000/auth/callback?token_hash=th1&type=invite");

    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "th1" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("verifies an email_change token_hash server-side", async () => {
    const res = await call("http://localhost:3000/auth/callback?token_hash=th2&type=email_change");

    expect(verifyOtp).toHaveBeenCalledWith({ type: "email_change", token_hash: "th2" });
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("ignores a token_hash of another type", async () => {
    const res = await call("http://localhost:3000/auth/callback?token_hash=th1&type=recovery");

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
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
