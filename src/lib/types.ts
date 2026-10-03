import type { FormatProfile } from "./format";

/** One uploaded page. `original` is never modified; `dataUrl` reflects user rotation. */
export type PageImage = {
  id: string;
  name: string;
  original: string;
  dataUrl: string;
  rotation: 0 | 90 | 180 | 270;
};

/** Structured block produced by the AI structure step. Uncertain text uses [[?text?]] markers. */
export type DocBlock = {
  type:
    | "heading"
    | "label"
    | "question"
    | "answer"
    | "paragraph"
    | "bulleted_list"
    | "numbered_list"
    | "table";
  text?: string;
  level?: number;
  label?: string;
  value?: string;
  items?: string[];
  start?: number;
  rows?: string[][];
};

/** Per-page pipeline output: OCR text is kept even when the AI step fails. */
export type PageResult = {
  ocrText?: string;
  blocks?: DocBlock[];
  error?: string;
  aiFailed?: boolean;
};

/** Original pages → OCR results → AI version → user-edited document. */
export type DocRecord = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pages: PageImage[];
  results: Record<string, PageResult>;
  aiHtml?: string;
  editorHtml?: string;
  format: FormatProfile;
};
