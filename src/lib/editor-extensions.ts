import { Extension, Mark, Node, mergeAttributes, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";

/** Manual page break; prints as a real page break and maps to DOCX PageBreak. */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: () => ["div", { "data-page-break": "true", class: "page-break" }],
});

/** Highlights text the OCR/AI was unsure about. `dismissed` hides the warning but keeps a record. */
export const Uncertain = Mark.create({
  name: "uncertain",
  inclusive: false,
  addAttributes: () => ({
    dismissed: {
      default: false,
      parseHTML: (el) => el.getAttribute("data-dismissed") === "true",
      renderHTML: (attrs) => (attrs.dismissed ? { "data-dismissed": "true" } : {}),
    },
  }),
  parseHTML: () => [{ tag: "mark[data-uncertain]" }],
  renderHTML: ({ HTMLAttributes }) => ["mark", mergeAttributes({ "data-uncertain": "true" }, HTMLAttributes), 0],
});

/** Per-paragraph line spacing and space-after (pt). */
export const ParagraphSpacing = Extension.create({
  name: "paragraphSpacing",
  addGlobalAttributes: () => [
    {
      types: ["paragraph", "heading"],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el) => (el.style.lineHeight ? parseFloat(el.style.lineHeight) : null),
          renderHTML: (a) => (a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {}),
        },
        spaceAfter: {
          default: null,
          parseHTML: (el) => (el.style.marginBottom ? parseFloat(el.style.marginBottom) : null),
          renderHTML: (a) => (a.spaceAfter != null ? { style: `margin-bottom: ${a.spaceAfter}pt` } : {}),
        },
      },
    },
  ],
});

export function buildExtensions() {
  return [
    StarterKit.configure({ link: false }),
    TextStyle,
    FontFamily,
    FontSize,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TableKit.configure({ table: { resizable: false } }),
    PageBreak,
    Uncertain,
    ParagraphSpacing,
  ];
}

export function setBlockAttrs(editor: Editor, attrs: Record<string, unknown>) {
  editor.chain().focus().updateAttributes("paragraph", attrs).updateAttributes("heading", attrs).run();
}

export type ReviewIssue = { from: number; to: number; text: string; page: number };

export function findUncertain(editor: Editor): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  let page = 1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "pageBreak") {
      page++;
      return false;
    }
    if (!node.isText) return true;
    const mark = node.marks.find((m) => m.type.name === "uncertain" && !m.attrs.dismissed);
    if (!mark) return false;
    const last = issues[issues.length - 1];
    if (last && last.to === pos) {
      last.to = pos + node.nodeSize;
      last.text += node.text ?? "";
    } else issues.push({ from: pos, to: pos + node.nodeSize, text: node.text ?? "", page });
    return false;
  });
  return issues;
}
