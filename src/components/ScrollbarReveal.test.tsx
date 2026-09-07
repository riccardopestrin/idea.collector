import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCROLLBAR_HIDE_MS, ScrollbarReveal } from "./ScrollbarReveal";

describe("ScrollbarReveal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("marks the scrolled element and unmarks it after the quiet period", () => {
    const box = document.createElement("div");
    document.body.append(box);
    render(<ScrollbarReveal />);

    fireEvent.scroll(box);
    expect(box).toHaveAttribute("data-scrolling");

    // uno scroll successivo riparte da zero il timer
    vi.advanceTimersByTime(SCROLLBAR_HIDE_MS - 100);
    fireEvent.scroll(box);
    vi.advanceTimersByTime(SCROLLBAR_HIDE_MS - 100);
    expect(box).toHaveAttribute("data-scrolling");

    vi.advanceTimersByTime(100);
    expect(box).not.toHaveAttribute("data-scrolling");
    box.remove();
  });

  it("marks the root element when the document itself scrolls", () => {
    render(<ScrollbarReveal />);

    fireEvent.scroll(document);
    expect(document.documentElement).toHaveAttribute("data-scrolling");

    vi.advanceTimersByTime(SCROLLBAR_HIDE_MS);
    expect(document.documentElement).not.toHaveAttribute("data-scrolling");
  });
});
