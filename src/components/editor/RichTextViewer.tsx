"use client";

import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";

import {
  captureSelection,
  plainRangeToPm,
  projectDoc,
} from "@/components/editor/anchoring";
import { richTextExtensions } from "@/components/editor/extensions";
import { resolveAnchor } from "@/lib/anchors";

export type ViewerAnchor = { text: string; occurrence: number };

function anchorHighlight(anchors: ViewerAnchor[]) {
  return Extension.create({
    name: "anchorHighlight",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations(state) {
              const projection = projectDoc(state.doc);
              const decorations = anchors.flatMap((anchor) => {
                const range = resolveAnchor(projection.text, anchor);
                const pm = range && plainRangeToPm(projection, range);
                return pm
                  ? [Decoration.inline(pm.from, pm.to, { class: "anchor-highlight" })]
                  : [];
              });
              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  });
}

// Viewer read-only (ADR-0005): stesso schema dell'editor, inline decorations
// per l'highlight dei commenti ancorati (non alterano il doc → formattazione
// intatta, range cross-blocco gratis). onComment abilita il BubbleMenu
// "Commenta" sulla selezione.
export function RichTextViewer({
  value,
  anchors = [],
  onComment,
}: {
  value: string;
  anchors?: ViewerAnchor[];
  onComment?: (anchor: { quote: string; occurrence: number }) => void;
}) {
  const editor = useEditor(
    {
      extensions: [...richTextExtensions, anchorHighlight(anchors)],
      content: value,
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: "rich-text text-sm text-foreground/80" },
      },
    },
    // l'editor viene ricreato quando cambiano contenuto o ancore
    [value, JSON.stringify(anchors)],
  );

  if (!editor) {
    return <div className="whitespace-pre-wrap text-sm text-foreground/80">{value}</div>;
  }

  return (
    <div className="relative">
      {onComment && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ state }) => !state.selection.empty}
        >
          <button
            type="button"
            onClick={() => {
              const { from, to } = editor.state.selection;
              const captured = captureSelection(editor.state.doc, { from, to });
              if (captured) onComment(captured);
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs shadow-sm"
          >
            Commenta
          </button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
