"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect } from "react";

import {
  captureSelection,
  plainRangeToPm,
  projectDoc,
} from "@/components/editor/anchoring";
import { richTextExtensions } from "@/components/editor/extensions";
import { resolveAnchor } from "@/lib/anchors";

type ViewerAnchor = { text: string; occurrence: number };

// Le ancore evidenziate vivono nello stato del plugin e si aggiornano via meta:
// così l'highlight (guidato dall'hover sul commento) cambia senza ricreare
// l'editor Tiptap a ogni passaggio del mouse.
const anchorKey = new PluginKey<ViewerAnchor[]>("anchorHighlight");

const anchorHighlight = Extension.create({
  name: "anchorHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<ViewerAnchor[]>({
        key: anchorKey,
        state: {
          init: () => [],
          apply: (tr, value) => tr.getMeta(anchorKey) ?? value,
        },
        props: {
          decorations(state) {
            const anchors = anchorKey.getState(state) ?? [];
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
      extensions: [...richTextExtensions, anchorHighlight],
      content: value,
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: "rich-text text-sm text-foreground/80" },
      },
    },
    // l'editor viene ricreato solo quando cambia il contenuto; le ancore si
    // aggiornano via meta nell'effetto sottostante
    [value],
  );

  const anchorsKey = JSON.stringify(anchors);
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(anchorKey, anchors));
    // anchorsKey è la proiezione stabile di anchors (evita un dispatch a ogni render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, anchorsKey]);

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
