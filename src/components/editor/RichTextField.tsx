"use client";

import dynamic from "next/dynamic";

import { controlClass, labelClass } from "@/lib/tokens";

// Client-only (ADR-0005): Tiptap in SSR causa hydration mismatch su Next 16.
// Fallback primo paint: box vuoto della stessa altezza.
const RichTextEditor = dynamic(
  () => import("@/components/editor/RichTextEditor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className={`${controlClass} min-h-32`} /> },
);

// Campo rich-text con label, drop-in al posto di <Field multiline>.
export function RichTextField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      <RichTextEditor name={name} defaultValue={defaultValue} />
    </div>
  );
}
