// Server-only: Lovable AI Gateway calls and prompts. Never imported by client code.
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const AI_MODEL = "openai/gpt-6-astra";

export type InputPart = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };

async function describeFailure(res: Response) {
  if (res.status === 402) return "AI credits are used up. Add credits in your workspace settings to continue converting.";
  if (res.status === 429) return "The AI service is busy. Please wait a moment and try again.";
  const body = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.message ?? parsed?.message ?? `AI service error (${res.status}).`;
  } catch {
    return `AI service error (${res.status}).`;
  }
}

/** Streams a Responses call and returns the final output text. */
export async function runAi(system: string, parts: InputPart[], json = false): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The AI service is not configured on the server.");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: AI_MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      input: [
        { role: "system", content: system },
        { role: "user", content: parts },
      ],
      ...(json ? { text: { format: { type: "json_object" } } } : {}),
    }),
  });
  if (!res.ok || !res.body) throw new Error(await describeFailure(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let event: { type?: string; delta?: string; message?: string; error?: { message?: string }; response?: { error?: { message?: string } } };
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.type === "response.output_text.delta") output += event.delta ?? "";
      else if (event.type === "response.failed" || event.type === "error")
        throw new Error(event.response?.error?.message ?? event.error?.message ?? event.message ?? "AI request failed.");
    }
  }
  return output;
}

export const OCR_PROMPT = `You are a meticulous handwriting transcription engine. Transcribe ALL handwritten and printed text on the page exactly as written, in reading order.
Rules:
- Do NOT correct, rephrase, summarize, translate or complete the text.
- Preserve line breaks, numbering (Q1., 1., a), i)), bullet symbols and punctuation.
- Preserve mathematical expressions and symbols using Unicode (√, ², π, →, ≤, ∑, ∫, etc.).
- Preserve the original language and script (e.g. Hindi in Devanagari).
- For tables, write each row on its own line with cells separated by " | ".
- If you are not confident about a word or phrase, wrap your best guess like [[?guess?]]. If text is illegible, write [[?illegible?]]. Never invent text.
- Ignore ruled lines, margins, stains and crossed-out text.
Output only the transcription with no commentary. If the page has no readable text, output exactly: NO_TEXT_FOUND`;

export const STRUCTURE_PROMPT = `You convert a raw handwriting transcription into structured document blocks. You are a FORMATTER, not an editor.
Rules:
- Keep the wording exactly as given. Never rephrase, summarize, add, reorder or drop content.
- Only fix obvious OCR character errors when the intended word is certain (e.g. "rnanagement" → "management").
- Keep every [[?...?]] uncertainty marker exactly as it appears.
- Keep question numbering (Q1., Q.2, 1)) inside the text as written.
Return JSON: {"blocks": [...]} where each block is one of:
{"type":"heading","level":1|2|3,"text":"..."}  — titles, section headings, subject names
{"type":"label","label":"Name","value":"..."}  — form fields such as Name, Roll No, Date, Class, Subject
{"type":"question","text":"Q1. What is DBMS?"}  — questions or problem statements
{"type":"answer","text":"..."}  — answer prose following a question (use \\n between separate paragraphs)
{"type":"paragraph","text":"..."}  — other prose
{"type":"bulleted_list","items":["..."]}  — bullet points
{"type":"numbered_list","start":1,"items":["..."]}  — points numbered 1. 2. 3.; item text WITHOUT the number prefix. For a) b) c) or i) ii) markers use a bulleted_list and keep the marker in the item text.
{"type":"table","rows":[["cell","cell"],["cell","cell"]]}`;

export const FORMAT_PROMPT = `You analyze an example of a desired final document layout and describe its formatting rules.
Return JSON with any of these keys you can confidently determine (omit others):
{"fontFamily": one of "Times New Roman"|"Georgia"|"Source Serif 4"|"Arial"|"Calibri"|"Courier New" (closest match),
 "fontSizePt": number, "lineHeight": number (1 to 2.5), "paragraphSpacingPt": number, "marginMm": number,
 "textAlign": "left"|"justify", "headingSizePt": number, "headingAlign": "left"|"center",
 "questionBold": boolean, "headerText": string (repeating header text, empty if none), "showPageNumbers": boolean}`;
