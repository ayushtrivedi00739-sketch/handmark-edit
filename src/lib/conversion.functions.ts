// Server functions for the conversion pipeline: OCR → structure → (optional) reference format.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FONT_OPTIONS } from "./format";

const imageSchema = z
  .string()
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Unsupported image format.")
  .max(15_000_000, "Image is too large.");

const blockSchema = z.object({
  type: z.enum(["heading", "label", "question", "answer", "paragraph", "bulleted_list", "numbered_list", "table"]),
  text: z.string().optional(),
  level: z.number().optional(),
  label: z.string().optional(),
  value: z.string().optional(),
  items: z.array(z.string()).optional(),
  start: z.number().optional(),
  rows: z.array(z.array(z.string())).optional(),
});

const formatSchema = z
  .object({
    fontFamily: z.enum(FONT_OPTIONS.map((f) => f.label) as [string, ...string[]]),
    fontSizePt: z.number().min(6).max(48),
    lineHeight: z.number().min(1).max(3),
    paragraphSpacingPt: z.number().min(0).max(48),
    marginMm: z.number().min(5).max(50),
    textAlign: z.enum(["left", "justify"]),
    headingSizePt: z.number().min(8).max(60),
    headingAlign: z.enum(["left", "center"]),
    questionBold: z.boolean(),
    headerText: z.string().max(200),
    showPageNumbers: z.boolean(),
  })
  .partial();

const blocksTextLength = (blocks: z.infer<typeof blockSchema>[]) =>
  blocks
    .map((b) => [b.text, b.label, b.value, ...(b.items ?? []), ...(b.rows ?? []).flat()].join(""))
    .join("")
    .replace(/\s/g, "").length;

export const recognizeHandwriting = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ image: imageSchema }).parse(data))
  .handler(async ({ data }) => {
    const { runAi, OCR_PROMPT } = await import("./ai.server");
    const text = (
      await runAi(OCR_PROMPT, [
        { type: "input_text", text: "Transcribe this handwritten page." },
        { type: "input_image", image_url: data.image },
      ])
    ).trim();
    if (!text || (text.includes("NO_TEXT_FOUND") && text.length < 40))
      throw new Error("Unable to read this page. Please upload a clearer image.");
    return { text };
  });

export const structureDocument = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ text: z.string().min(1).max(60_000) }).parse(data))
  .handler(async ({ data }) => {
    const { runAi, STRUCTURE_PROMPT } = await import("./ai.server");
    const raw = await runAi(STRUCTURE_PROMPT, [{ type: "input_text", text: `Return JSON for this transcription:\n\n${data.text}` }], true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("The AI returned an unreadable structure.");
    }
    const result = z.object({ blocks: z.array(blockSchema) }).safeParse(parsed);
    if (!result.success || result.data.blocks.length === 0) throw new Error("The AI returned an unreadable structure.");
    // Guard against the AI dropping or summarizing content.
    const sourceLength = data.text.replace(/\[\[\?|\?\]\]|\s/g, "").length;
    if (blocksTextLength(result.data.blocks) < sourceLength * 0.7)
      throw new Error("The AI result left out part of the text, so the raw OCR text was kept instead.");
    return { blocks: result.data.blocks };
  });

export const extractReferenceFormat = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ image: imageSchema }).parse(data))
  .handler(async ({ data }) => {
    const { runAi, FORMAT_PROMPT } = await import("./ai.server");
    const raw = await runAi(
      FORMAT_PROMPT,
      [
        { type: "input_text", text: "Describe the formatting of this example document as JSON." },
        { type: "input_image", image_url: data.image },
      ],
      true,
    );
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Could not understand the reference format.");
    }
    // Keep only valid keys; drop anything malformed individually.
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const single = formatSchema.safeParse({ [k]: v });
      if (single.success && k in single.data) clean[k] = v;
    }
    return { format: clean as z.infer<typeof formatSchema> };
  });
