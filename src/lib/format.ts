import type { CSSProperties } from "react";

/**
 * Formatting rules for the document. Nothing here is hard-coded into the editor:
 * the editor, print/PDF and DOCX export all read from this profile, and a
 * reference document can overwrite any subset of it.
 */
export type FormatProfile = {
  fontFamily: string;
  fontSizePt: number;
  lineHeight: number;
  paragraphSpacingPt: number;
  marginMm: number;
  textAlign: "left" | "justify";
  headingSizePt: number;
  headingAlign: "left" | "center";
  questionBold: boolean;
  headerText: string;
  showPageNumbers: boolean;
};

export const FONT_OPTIONS: { label: string; css: string }[] = [
  { label: "Times New Roman", css: '"Times New Roman", Times, serif' },
  { label: "Georgia", css: "Georgia, serif" },
  { label: "Source Serif 4", css: '"Source Serif 4", Georgia, serif' },
  { label: "Arial", css: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", css: 'Calibri, Carlito, "IBM Plex Sans", sans-serif' },
  { label: "Courier New", css: '"Courier New", monospace' },
];

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

export const DEFAULT_FORMAT: FormatProfile = {
  fontFamily: "Times New Roman",
  fontSizePt: 12,
  lineHeight: 1.5,
  paragraphSpacingPt: 8,
  marginMm: 25,
  textAlign: "left",
  headingSizePt: 18,
  headingAlign: "left",
  questionBold: true,
  headerText: "",
  showPageNumbers: true,
};

export function fontCss(label: string) {
  return FONT_OPTIONS.find((f) => f.label === label)?.css ?? label;
}

export function formatToStyle(format: FormatProfile): CSSProperties {
  return {
    "--doc-font": fontCss(format.fontFamily),
    "--doc-size": `${format.fontSizePt}pt`,
    "--doc-line": String(format.lineHeight),
    "--doc-para": `${format.paragraphSpacingPt}pt`,
    "--doc-margin": `${format.marginMm}mm`,
    "--doc-align": format.textAlign,
    "--doc-h-size": `${format.headingSizePt}pt`,
    "--doc-h-align": format.headingAlign,
  } as CSSProperties;
}

/** @page rules for print / Save as PDF (margins, header, page numbers). */
export function printPageCss(format: FormatProfile) {
  const header = format.headerText.replace(/["\\]/g, "\\$&");
  return `@page { size: A4; margin: ${format.marginMm}mm;
    ${header ? `@top-center { content: "${header}"; font-size: 9pt; color: #555; }` : ""}
    ${format.showPageNumbers ? `@bottom-center { content: counter(page) " / " counter(pages); font-size: 9pt; color: #555; }` : ""}
  }`;
}
