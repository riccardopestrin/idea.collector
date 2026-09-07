"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { labelClass } from "@/lib/tokens";

// Link della nav di progetto: sottolineato solo sulla pagina corrente,
// paprika al hover. Client solo per leggere il pathname.
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${labelClass} decoration-1 underline-offset-4 hover:text-paprika ${active ? "underline" : ""}`}
    >
      {children}
    </Link>
  );
}
