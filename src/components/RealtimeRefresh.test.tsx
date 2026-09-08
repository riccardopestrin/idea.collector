import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RealtimeRefresh } from "./RealtimeRefresh";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// Canale realtime finto: registra i callback passati a .on e li espone perché il
// test simuli un evento Postgres.
const channel = vi.hoisted(() => {
  const handlers: Array<() => void> = [];
  const ch = {
    handlers,
    on: vi.fn((_event: string, _config: unknown, cb: () => void) => {
      handlers.push(cb);
      return ch;
    }),
    subscribe: vi.fn(() => ch),
  };
  return ch;
});
const removeChannel = vi.hoisted(() => vi.fn());
const setAuth = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const getSession = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ data: { session: { access_token: "jwt-utente" } } }))
);
vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    channel: () => channel,
    removeChannel,
    auth: { getSession },
    realtime: { setAuth },
  }),
}));

// Lascia risolvere la catena getSession → setAuth → subscribe.
const flush = () => act(() => Promise.resolve());

afterEach(() => {
  vi.clearAllMocks();
  channel.handlers.length = 0;
  vi.useRealTimers();
});

describe("RealtimeRefresh", () => {
  it("sets the user JWT on realtime before subscribing", async () => {
    render(<RealtimeRefresh />);
    expect(channel.on).toHaveBeenCalledTimes(6);
    expect(channel.subscribe).not.toHaveBeenCalled();

    await flush();
    expect(setAuth).toHaveBeenCalledWith("jwt-utente");
    expect(channel.subscribe).toHaveBeenCalledOnce();
    expect(setAuth.mock.invocationCallOrder[0]).toBeLessThan(
      channel.subscribe.mock.invocationCallOrder[0]
    );
  });

  it("does not subscribe without a session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } } as never);
    render(<RealtimeRefresh />);
    await flush();
    expect(setAuth).not.toHaveBeenCalled();
    expect(channel.subscribe).not.toHaveBeenCalled();
  });

  it("coalesces a burst of events into one refresh", async () => {
    vi.useFakeTimers();
    render(<RealtimeRefresh />);
    await flush();

    // due eventi ravvicinati (es. move = update + insert history) → un solo refresh
    channel.handlers[0]();
    channel.handlers[1]();
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("tears the channel down on unmount and never subscribes afterwards", async () => {
    const { unmount } = render(<RealtimeRefresh />);
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(channel);
    await flush();
    expect(channel.subscribe).not.toHaveBeenCalled();
  });
});
