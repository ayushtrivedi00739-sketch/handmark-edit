// Converts the editor's document (Tiptap JSON) into a real, editable .docx file.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { JSONContent } from "@tiptap/react";
import type { FormatProfile } from "./format";

const TWIPS_PER_MM = 56.7;
const A4 = { width: 11906, height: 16838 };
const ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const;
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

const firstFont = (css?: string) => css?.split(",")[0]?.replace(/["']/g, "").trim();
function sizeToHalfPoints(size?: string) {
  if (!size) return undefined;
  const n = parseFloat(size);
  return Math.round((size.endsWith("px") ? n * 0.75 : n) * 2);
}

function runs(nodes: JSONContent[] = []): TextRun[] {
  return nodes.map((n) => {
    if (n.type === "hardBreak") return new TextRun({ break: 1 });
    const marks = n.marks ?? [];
    const has = (t: string) => marks.some((m) => m.type === t);
    const style = marks.find((m) => m.type === "textStyle")?.attrs ?? {};
    return new TextRun({
      text: n.text ?? "",
      bold: has("bold"),
      italics: has("italic"),
      underline: has("underline") ? {} : undefined,
      strike: has("strike"),
      font: firstFont(style.fontFamily),
      size: sizeToHalfPoints(style.fontSize),
    });
  });
}

export async function exportDocx(json: JSONContent, format: FormatProfile, title: string) {
  const margin = Math.round(format.marginMm * TWIPS_PER_MM);
  const contentWidth = A4.width - margin * 2;
  let listInstance = 0;

  const paragraph = (node: JSONContent, extra: Record<string, unknown> = {}) => {
    const a = node.attrs ?? {};
    const isHeading = node.type === "heading";
    return new Paragraph({
      children: runs(node.content),
      heading: isHeading ? HEADINGS[(a.level ?? 1) - 1] : undefined,
      alignment: ALIGN[(a.textAlign as keyof typeof ALIGN) ?? (isHeading ? format.headingAlign : format.textAlign)],
      spacing: {
        line: a.lineHeight ? Math.round(a.lineHeight * 240) : undefined,
        after: a.spaceAfter != null ? a.spaceAfter * 20 : undefined,
      },
      ...extra,
    });
  };

  const list = (node: JSONContent, level: number): Paragraph[] => {
    const ordered = node.type === "orderedList";
    const instance = ++listInstance;
    return (node.content ?? []).flatMap((item) =>
      (item.content ?? []).flatMap((child, i) => {
        if (child.type === "bulletList" || child.type === "orderedList") return list(child, Math.min(level + 1, 3));
        if (i === 0) return [paragraph(child, { numbering: { reference: ordered ? "ol" : "ul", level, instance } })];
        return [paragraph(child, { indent: { left: 720 * (level + 1) } })];
      }),
    );
  };

  const blocks = (nodes: JSONContent[] = []): (Paragraph | Table)[] =>
    nodes.flatMap((node): (Paragraph | Table)[] => {
      switch (node.type) {
        case "paragraph":
        case "heading":
          return [paragraph(node)];
        case "bulletList":
        case "orderedList":
          return list(node, 0);
        case "pageBreak":
          return [new Paragraph({ children: [new PageBreak()] })];
        case "horizontalRule":
          return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } } })];
        case "blockquote":
          return blocks(node.content);
        case "table": {
          const rows = node.content ?? [];
          const cols = Math.max(1, ...rows.map((r) => r.content?.length ?? 0));
          const colWidth = Math.floor(contentWidth / cols);
          return [
            new Table({
              width: { size: colWidth * cols, type: WidthType.DXA },
              columnWidths: Array(cols).fill(colWidth),
              rows: rows.map(
                (row) =>
                  new TableRow({
                    children: (row.content ?? []).map(
                      (cell) =>
                        new TableCell({
                          width: { size: colWidth, type: WidthType.DXA },
                          margins: { top: 80, bottom: 80, left: 120, right: 120 },
                          children: (blocks(cell.content).filter((b) => b instanceof Paragraph) as Paragraph[]).length
                            ? (blocks(cell.content).filter((b) => b instanceof Paragraph) as Paragraph[])
                            : [new Paragraph("")],
                        }),
                    ),
                  }),
              ),
            }),
          ];
        }
        default:
          return node.content ? blocks(node.content) : [];
      }
    });

  const levels = (ordered: boolean) =>
    [0, 1, 2, 3].map((level) => ({
      level,
      format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
      text: ordered ? `%${level + 1}.` : ["•", "◦", "▪", "•"][level],
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
    }));

  const font = format.fontFamily;
  const doc = new Document({
    title,
    styles: {
      default: {
        document: {
          run: { font, size: format.fontSizePt * 2 },
          paragraph: { spacing: { line: Math.round(format.lineHeight * 240), after: format.paragraphSpacingPt * 20 } },
        },
      },
      paragraphStyles: [1, 2, 3].map((n) => ({
        id: `Heading${n}`,
        name: `Heading ${n}`,
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font, bold: true, size: Math.round(format.headingSizePt * [1, 0.85, 0.72][n - 1] * 2) },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: n - 1 },
      })),
    },
    numbering: {
      config: [
        { reference: "ul", levels: levels(false) },
        { reference: "ol", levels: levels(true) },
      ],
    },
    sections: [
      {
        properties: { page: { size: A4, margin: { top: margin, right: margin, bottom: margin, left: margin } } },
        headers: format.headerText
          ? { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: format.headerText, size: 18 })] })] }) }
          : undefined,
        footers: format.showPageNumbers
          ? { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }) }
          : undefined,
        children: blocks(json.content),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "document"}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
