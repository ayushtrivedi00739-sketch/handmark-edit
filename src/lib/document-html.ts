// Turns pipeline output (AI blocks or raw OCR text) into editor HTML.
import type { FormatProfile } from "./format";
import type { DocBlock, PageImage, PageResult } from "./types";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Escapes text and converts [[?text?]] markers into review highlights. */
export function inlineHtml(text = "") {
  return escapeHtml(text).replace(/\[\[\?(.+?)\?\]\]/g, (_, w) => `<mark data-uncertain="true">${w}</mark>`);
}

const paragraphs = (text = "") =>
  text
    .split(/\n+/)
    .filter((l) => l.trim())
    .map((l) => `<p>${inlineHtml(l)}</p>`)
    .join("");

function tableHtml(rows: string[][]) {
  return `<table><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td><p>${inlineHtml(c)}</p></td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function blockToHtml(block: DocBlock, format: FormatProfile) {
  switch (block.type) {
    case "heading": {
      const level = Math.min(3, Math.max(1, block.level ?? 1));
      return `<h${level}>${inlineHtml(block.text)}</h${level}>`;
    }
    case "label":
      return `<p><strong>${inlineHtml(block.label)}:</strong> ${inlineHtml(block.value)}</p>`;
    case "question":
      return format.questionBold ? `<p><strong>${inlineHtml(block.text)}</strong></p>` : `<p>${inlineHtml(block.text)}</p>`;
    case "bulleted_list":
      return `<ul>${(block.items ?? []).map((i) => `<li><p>${inlineHtml(i)}</p></li>`).join("")}</ul>`;
    case "numbered_list":
      return `<ol start="${block.start ?? 1}">${(block.items ?? []).map((i) => `<li><p>${inlineHtml(i)}</p></li>`).join("")}</ol>`;
    case "table":
      return block.rows?.length ? tableHtml(block.rows) : "";
    default:
      return paragraphs(block.text);
  }
}

/** Fallback when AI structuring fails: raw OCR lines as paragraphs, pipe rows as tables. */
export function ocrToHtml(text: string) {
  const lines = text.split("\n");
  let html = "";
  let tableRows: string[][] = [];
  const flush = () => {
    if (tableRows.length) html += tableHtml(tableRows);
    tableRows = [];
  };
  for (const line of lines) {
    if (line.includes(" | ")) tableRows.push(line.split(" | ").map((c) => c.trim()));
    else {
      flush();
      if (line.trim()) html += `<p>${inlineHtml(line.trim())}</p>`;
    }
  }
  flush();
  return html;
}

const PAGE_BREAK = `<div data-page-break="true"></div>`;
const unreadable = (n: number) =>
  `<p><mark data-uncertain="true">[Page ${n} could not be read — type its content here]</mark></p>`;

export function buildDocumentHtml(
  pages: PageImage[],
  results: Record<string, PageResult>,
  format: FormatProfile,
  source: "ai" | "ocr" = "ai",
) {
  return pages
    .map((page, i) => {
      const r = results[page.id];
      if (source === "ai" && r?.blocks?.length) return r.blocks.map((b) => blockToHtml(b, format)).join("");
      if (r?.ocrText) return ocrToHtml(r.ocrText);
      return unreadable(i + 1);
    })
    .join(PAGE_BREAK);
}
