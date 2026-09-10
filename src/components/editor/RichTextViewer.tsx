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
import { STRINGS } from "@/lib/strings";

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
// intatta, range cross-blocco gratis). Il BubbleMenu "Commenta" sulla selezione
// chiama onComment.
export function RichTextViewer({
  value,
  anchors = [],
  onComment,
}: {
  value: string;
  anchors?: ViewerAnchor[];
  onComment: (anchor: { quote: string; occurrence: number }) => void;
}) {
  const editor = useEditor(
    {
      extensions: [...richTextExtensions, anchorHighlight],
      content: value,
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: "rich-text text-base text-foreground/80" },
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

  // Read-only: ProseMirror non collassa la sua selezione quando quella del DOM
  // sparisce (click fuori dal viewer), quindi il BubbleMenu "Commenta" resterebbe
  // appeso. La riallineiamo alla selezione reale del DOM.
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const sel = window.getSelection();
      const inside = sel && !sel.isCollapsed && editor.view.dom.contains(sel.anchorNode);
      if (!inside && !editor.state.selection.empty) {
        editor.commands.setTextSelection(editor.state.selection.to);
      }
    };
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, [editor]);

  if (!editor) {
    return <div className="whitespace-pre-wrap text-base text-foreground/80">{value}</div>;
  }

  return (
    <div className="relative">
      <BubbleMenu editor={editor} shouldShow={({ state }) => !state.selection.empty}>
        <button
          type="button"
          // preventDefault tiene ferma la selezione mentre il click prende il
          // focus, così captureSelection la legge prima che il sync la collassi.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const { from, to } = editor.state.selection;
            const captured = captureSelection(editor.state.doc, { from, to });
            if (captured) onComment(captured);
            editor.commands.setTextSelection(to); // collassa → nasconde il bubble
          }}
          className="border border-ink bg-ink px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-paper hover:bg-paprika"
        >
          {STRINGS.common.comment}
        </button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
