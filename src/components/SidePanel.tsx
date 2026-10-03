import type { Editor } from "@tiptap/react";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { AlertTriangle, Check, EyeOff, Loader2, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractReferenceFormat } from "@/lib/conversion.functions";
import { findUncertain } from "@/lib/editor-extensions";
import { DEFAULT_FORMAT, FONT_OPTIONS, type FormatProfile } from "@/lib/format";
import { ACCEPT_ATTR, filesToPages } from "@/lib/pages";
import type { DocRecord } from "@/lib/types";

type Props = { editor: Editor; doc: DocRecord; onFormatChange: (f: FormatProfile) => void };

export function SidePanel({ editor, doc, onFormatChange }: Props) {
  return (
    <Tabs defaultValue="review" className="flex h-full flex-col">
      <TabsList className="m-3 grid grid-cols-2">
        <TabsTrigger value="review">Review</TabsTrigger>
        <TabsTrigger value="format">Format</TabsTrigger>
      </TabsList>
      <TabsContent value="review" className="flex-1 overflow-y-auto px-3 pb-6">
        <ReviewList editor={editor} doc={doc} />
      </TabsContent>
      <TabsContent value="format" className="flex-1 overflow-y-auto px-3 pb-6">
        <FormatForm format={doc.format} onChange={onFormatChange} />
      </TabsContent>
    </Tabs>
  );
}

function ReviewList({ editor, doc }: { editor: Editor; doc: DocRecord }) {
  const issues = findUncertain(editor);
  const pageWarnings = doc.pages
    .map((p, i) => ({ i, r: doc.results[p.id] }))
    .filter(({ r }) => r?.error);
  const select = (from: number, to: number) => editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run();

  return (
    <div className="space-y-3">
      {issues.length > 0 ? (
        <p className="rounded-md bg-warning-soft p-3 text-sm text-warning-foreground">
          Some text could not be confidently recognized. Please review the highlighted sections.
        </p>
      ) : (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No uncertain text left to review.</p>
      )}
      {pageWarnings.map(({ i, r }) => (
        <div key={i} className="flex gap-2 rounded-md border p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>
            <strong>Page {i + 1}:</strong> {r?.ocrText ? `AI structuring failed, raw OCR text was used. ${r.error}` : r?.error}
          </span>
        </div>
      ))}
      <ul className="space-y-2">
        {issues.map((issue) => (
          <li key={`${issue.from}-${issue.to}`} className="rounded-md border bg-card p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {issue.page} · Low confidence</span>
            </div>
            <button type="button" onClick={() => select(issue.from, issue.to)} className="mb-2 block text-left font-display text-base">
              “{issue.text}”
            </button>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => editor.chain().setTextSelection({ from: issue.from, to: issue.to }).unsetMark("uncertain").run()}>
                <Check /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => select(issue.from, issue.to)}>
                <Pencil /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => editor.chain().setTextSelection({ from: issue.from, to: issue.to }).setMark("uncertain", { dismissed: true }).run()}>
                <EyeOff /> Ignore
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FormatForm({ format, onChange }: { format: FormatProfile; onChange: (f: FormatProfile) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const extract = useServerFn(extractReferenceFormat);
  const set = <K extends keyof FormatProfile>(k: K, v: FormatProfile[K]) => onChange({ ...format, [k]: v });
  const num = (k: keyof FormatProfile, step = 1) => (
    <input type="number" step={step} className="tb-select w-20" value={format[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} />
  );

  async function applyReference(file?: File) {
    if (!file) return;
    setLoading(true);
    try {
      const { pages, errors } = await filesToPages([file]);
      if (errors.length || !pages[0]) throw new Error(errors[0] ?? "Could not open file.");
      const { format: found } = await extract({ data: { image: pages[0].dataUrl } });
      onChange({ ...format, ...found });
      toast.success(`Reference format applied (${Object.keys(found).length} settings detected).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the reference format.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-3">
        <p className="text-sm font-medium">Reference format</p>
        <p className="mt-1 text-xs text-muted-foreground">Upload an example of how the final document should look. Detected settings fill in below and stay editable.</p>
        <Button size="sm" variant="outline" className="mt-2" disabled={loading} onClick={() => fileRef.current?.click()}>
          {loading ? <Loader2 className="animate-spin" /> : <Upload />} Upload example
        </Button>
        <input ref={fileRef} type="file" accept={ACCEPT_ATTR} hidden onChange={(e) => { applyReference(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <div className="space-y-3">
        <Field label="Font">
          <select className="tb-select w-40" value={format.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}>
            {FONT_OPTIONS.map((f) => <option key={f.label}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Body size (pt)">{num("fontSizePt")}</Field>
        <Field label="Line spacing">{num("lineHeight", 0.05)}</Field>
        <Field label="Paragraph spacing (pt)">{num("paragraphSpacingPt")}</Field>
        <Field label="Margins (mm)">{num("marginMm")}</Field>
        <Field label="Body alignment">
          <select className="tb-select w-28" value={format.textAlign} onChange={(e) => set("textAlign", e.target.value as FormatProfile["textAlign"])}>
            <option value="left">Left</option>
            <option value="justify">Justify</option>
          </select>
        </Field>
        <Field label="Heading size (pt)">{num("headingSizePt")}</Field>
        <Field label="Heading alignment">
          <select className="tb-select w-28" value={format.headingAlign} onChange={(e) => set("headingAlign", e.target.value as FormatProfile["headingAlign"])}>
            <option value="left">Left</option>
            <option value="center">Center</option>
          </select>
        </Field>
        <Field label="Bold questions (on convert)">
          <input type="checkbox" checked={format.questionBold} onChange={(e) => set("questionBold", e.target.checked)} />
        </Field>
        <Field label="Header text">
          <input className="tb-select w-40" value={format.headerText} onChange={(e) => set("headerText", e.target.value)} placeholder="None" />
        </Field>
        <Field label="Page numbers">
          <input type="checkbox" checked={format.showPageNumbers} onChange={(e) => set("showPageNumbers", e.target.checked)} />
        </Field>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_FORMAT })}>Reset to default</Button>
    </div>
  );
}
