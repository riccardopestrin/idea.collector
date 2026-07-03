"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useState } from "react";

import { getMarkdown, richTextExtensions } from "@/components/editor/extensions";
import { controlClass } from "@/components/form/Field";

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
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [markdown, setMarkdown] = useState(defaultValue ?? "");
  const editor = useEditor({
    extensions: richTextExtensions,
    content: defaultValue ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich-text min-h-24 outline-none px-3 py-2 text-sm" },
    },
    onUpdate: ({ editor }) => {
      setMarkdown(getMarkdown(editor));
    },
  });

  return (
    <div className={`${controlClass} p-0`}>
      <input type="hidden" name={name} value={markdown} />
      <div className="flex gap-1 border-b border-border px-2 py-1">
        {TOOLBAR.map(({ label, action }) => (
          <button
            key={label}
            type="button"
            disabled={!editor}
            onClick={() => editor && action(editor)}
            className="min-w-7 rounded px-1.5 py-0.5 text-sm text-foreground/70 hover:bg-foreground/10"
          >
            {label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
