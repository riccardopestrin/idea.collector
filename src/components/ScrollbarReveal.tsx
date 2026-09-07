"use client";

import { useEffect } from "react";

// ms di quiete dopo l'ultimo scroll prima che la thumb sparisca.
export const SCROLLBAR_HIDE_MS = 800;

// Le scrollbar ::-webkit-scrollbar personalizzate sono sempre visibili: qui
// marchiamo con data-scrolling l'elemento che sta scorrendo (documento incluso)
// e il CSS in globals.css colora la thumb solo in quello stato. Listener unico
// in capture: gli eventi scroll non risalgono (bubble) dai contenitori interni.
export function ScrollbarReveal() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const onScroll = (e: Event) => {
      const el = e.target instanceof Element ? e.target : document.documentElement;
      el.setAttribute("data-scrolling", "");
      window.clearTimeout(timers.get(el));
      timers.set(
        el,
        window.setTimeout(() => el.removeAttribute("data-scrolling"), SCROLLBAR_HIDE_MS),
      );
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  return null;
}
