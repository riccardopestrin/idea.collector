"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useState } from "react";

import { getMarkdown, richTextExtensions } from "@/components/editor/extensions";

const TOOLBAR = [
  { label: "H1", action: (e: ToolbarEditor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: "H2", action: (e: ToolbarEditor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "H3", action: (e: ToolbarEditor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "B", action: (e: ToolbarEditor) => e.chain().focus().toggleBold().run() },
  { label: "I", action: (e: ToolbarEditor) => e.chain().focus().toggleItalic().run() },
  { label: "•", action: (e: ToolbarEditor) => e.chain().focus().toggleBulletList().run() },
  { label: "1.", action: (e: ToolbarEditor) => e.chain().focus().toggleOrderedList().run() },
] as const;

type ToolbarEditor = NonNullable<ReturnType<typeof useEditor>>;

// Editor WYSIWYG (ADR-0005): serializza markdown in un <input hidden> a ogni
// update, così i Server Action a formData restano invariati.
export function RichTextEditor({
  name,
  defaultValue,
  tall = false,
  fill = false,
}: {
  name: string;
  defaultValue?: string | null;
  // tall: area più alta (es. edit proposta). fill: body principale della nuova
  // proposta — riempie l'altezza rimasta nel modal (max-h-90vh) tolti gli altri
  // campi (~29rem), così il modal è quasi a tutta pagina SENZA scroll.
  tall?: boolean;
  fill?: boolean;
}) {
  const [markdown, setMarkdown] = useState(defaultValue ?? "");
  const minHeight = fill ? "min-h-[calc(90vh_-_29rem)]" : tall ? "min-h-64" : "min-h-24";
  const editor = useEditor({
    extensions: richTextExtensions,
    content: defaultValue ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `rich-text ${minHeight} outline-none px-3 py-2 text-sm`,
      },
    },
    onUpdate: ({ editor }) => {
      setMarkdown(getMarkdown(editor));
    },
  });

  return (
    <div className="border border-ink bg-paper">
      <input type="hidden" name={name} value={markdown} />
      <div className="flex gap-1 border-b border-ink px-2 py-1">
        {TOOLBAR.map(({ label, action }) => (
          <button
            key={label}
            type="button"
            disabled={!editor}
            onClick={() => editor && action(editor)}
            className="min-w-7 px-1.5 py-0.5 font-mono text-xs text-foreground/70 hover:bg-ink hover:text-paper"
          >
            {label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
