import { render } from "@testing-library/react";
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
vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({ channel: () => channel, removeChannel }),
}));

afterEach(() => {
  refresh.mockClear();
  channel.on.mockClear();
  channel.subscribe.mockClear();
  channel.handlers.length = 0;
  vi.useRealTimers();
});

describe("RealtimeRefresh", () => {
  it("subscribes to every realtime table and coalesces a burst into one refresh", () => {
    vi.useFakeTimers();
    render(<RealtimeRefresh />);

    // una sottoscrizione per tabella, poi subscribe()
    expect(channel.on).toHaveBeenCalledTimes(6);
    expect(channel.subscribe).toHaveBeenCalledOnce();

    // due eventi ravvicinati (es. move = update + insert history) → un solo refresh
    channel.handlers[0]();
    channel.handlers[1]();
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("tears the channel down on unmount", () => {
    const { unmount } = render(<RealtimeRefresh />);
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
