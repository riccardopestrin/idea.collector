import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";

// Schema unico per editor e viewer (ADR-0005): heading 1–3, bold, italic,
// elenchi; tutto il resto disattivato (minimalismo Note iOS). html: false =
// niente raw HTML persistito, solo markdown attraverso lo schema vincolato.
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    link: false,
  }),
  Markdown.configure({ html: false, transformPastedText: true }),
];

// tiptap-markdown non dichiara il proprio storage sul tipo Storage di Tiptap.
export function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}
