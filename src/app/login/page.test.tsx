import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const signInWithOtp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({ auth: { signInWithOtp } }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    signInWithOtp.mockReset().mockResolvedValue({ error: null });
  });

  it("sends an invite-only magic link to the typed email and confirms", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "team@hint.app");
    await user.click(screen.getByRole("button", { name: /invia link/i }));

    const arg = signInWithOtp.mock.calls[0][0];
    expect(arg.email).toBe("team@hint.app");
    expect(arg.options.shouldCreateUser).toBe(false);
    expect(arg.options.emailRedirectTo).toMatch(/\/auth\/callback$/);
    expect(await screen.findByRole("status")).toHaveTextContent("team@hint.app");
  });

  it("shows the provider error and keeps the form visible", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "rate limit" } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "team@hint.app");
    await user.click(screen.getByRole("button", { name: /invia link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("rate limit");
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
