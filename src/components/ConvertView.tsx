import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Loader2, Plus, Replace, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { recognizeHandwriting, structureDocument } from "@/lib/conversion.functions";
import { buildDocumentHtml } from "@/lib/document-html";
import { ACCEPT_ATTR, filesToPages, rotatePage } from "@/lib/pages";
import type { DocRecord, PageResult } from "@/lib/types";

type Props = { doc: DocRecord; persist: (d: DocRecord) => Promise<void> };
type Progress = { stage: string; page: number; done: number };

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
const isFatal = (msg: string) => /credits|busy|not configured/i.test(msg);

export function ConvertView({ doc, persist }: Props) {
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [preview, setPreview] = useState(0);
  const ocr = useServerFn(recognizeHandwriting);
  const structure = useServerFn(structureDocument);
  const pages = doc.pages;
  const busy = progress !== null;

  const updatePages = (next: typeof pages) => persist({ ...doc, pages: next });

  async function addFiles(files: File[], at?: number) {
    const { pages: added, errors } = await filesToPages(files);
    errors.forEach((e) => toast.error(e));
    if (!added.length) return;
    if (at != null) {
      const next = [...pages];
      next.splice(at, 1, ...added.slice(0, 1));
      const results = { ...doc.results };
      delete results[pages[at].id];
      await persist({ ...doc, pages: next, results });
    } else await updatePages([...pages, ...added]);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    updatePages(next);
  }

  async function rotate(i: number) {
    const next = [...pages];
    next[i] = await rotatePage(pages[i]);
    const results = { ...doc.results };
    delete results[pages[i].id];
    persist({ ...doc, pages: next, results });
  }

  async function convert() {
    const results: Record<string, PageResult> = { ...doc.results };
    let stopped = false;
    for (let i = 0; i < pages.length && !stopped; i++) {
      const page = pages[i];
      setPreview(i);
      setProgress({ stage: "Reading handwriting…", page: i + 1, done: i });
      let ocrText: string;
      try {
        ocrText = (await ocr({ data: { image: page.dataUrl } })).text;
      } catch (e) {
        const msg = errorMessage(e);
        results[page.id] = { error: msg };
        toast.error(`Page ${i + 1}: ${msg}`);
        if (isFatal(msg)) stopped = true;
        continue;
      }
      setProgress({ stage: "Understanding document structure…", page: i + 1, done: i + 0.5 });
      try {
        const { blocks } = await structure({ data: { text: ocrText } });
        results[page.id] = { ocrText, blocks };
      } catch (e) {
        // Keep the OCR result so no work is lost.
        results[page.id] = { ocrText, aiFailed: true, error: errorMessage(e) };
        toast.warning(`Page ${i + 1}: structure step failed, raw text kept. ${errorMessage(e)}`);
        if (isFatal(errorMessage(e))) stopped = true;
      }
      await persist({ ...doc, results });
    }
    if (stopped || pages.every((p) => !results[p.id]?.ocrText)) {
      await persist({ ...doc, results });
      setProgress(null);
      if (!stopped) toast.error("No page could be read. Please upload clearer images.");
      return;
    }
    setProgress({ stage: "Applying formatting…", page: pages.length, done: pages.length });
    const html = buildDocumentHtml(pages, results, doc.format);
    setProgress({ stage: "Preparing editable document…", page: pages.length, done: pages.length });
    await persist({ ...doc, results, aiHtml: html, editorHtml: html });
    toast.success("Conversion complete");
  }

  const current = pages[preview];
  const pct = progress ? Math.round((progress.done / Math.max(1, pages.length)) * 100) : 0;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Link to="/" className="tb-btn" aria-label="Back to dashboard"><ArrowLeft className="size-4" /></Link>
          <input
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
            value={doc.title}
            onChange={(e) => persist({ ...doc, title: e.target.value })}
            aria-label="Document title"
          />
          <Button onClick={convert} disabled={busy || pages.length === 0} size="lg">
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Convert {pages.length} page{pages.length === 1 ? "" : "s"}
          </Button>
        </div>
        {progress && (
          <div className="mx-auto max-w-7xl px-6 pb-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">{progress.stage}</span>
              <span className="text-muted-foreground">Page {progress.page} of {pages.length}</span>
            </div>
            <Progress value={pct} />
          </div>
        )}
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Uploaded pages</h2>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => addRef.current?.click()}>
              <Plus /> Add pages
            </Button>
          </div>
          {pages.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">No pages yet — add some to start.</p>
          ) : (
            <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {pages.map((p, i) => {
                const r = doc.results[p.id];
                return (
                  <li key={p.id} className={`overflow-hidden rounded-lg border bg-card ${preview === i ? "ring-2 ring-ring" : ""}`}>
                    <button type="button" className="relative block aspect-[210/297] w-full bg-desk" onClick={() => setPreview(i)}>
                      <img src={p.dataUrl} alt={`Page ${i + 1}`} className="h-full w-full object-contain" />
                      <span className="absolute left-2 top-2 rounded bg-card px-1.5 text-xs font-semibold">{i + 1}</span>
                      {r?.error && !r.ocrText && <AlertTriangle className="absolute right-2 top-2 size-5 text-destructive" />}
                      {r?.ocrText && <CheckCircle2 className="absolute right-2 top-2 size-5 text-success" />}
                    </button>
                    <div className="flex justify-between border-t px-1 py-1">
                      <button className="tb-btn" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move earlier"><ChevronLeft className="size-4" /></button>
                      <button className="tb-btn" disabled={busy} onClick={() => rotate(i)} aria-label="Rotate"><RotateCw className="size-4" /></button>
                      <button className="tb-btn" disabled={busy} onClick={() => { setReplaceIndex(i); replaceRef.current?.click(); }} aria-label="Replace"><Replace className="size-4" /></button>
                      <button className="tb-btn" disabled={busy} onClick={() => updatePages(pages.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="size-4" /></button>
                      <button className="tb-btn" disabled={busy || i === pages.length - 1} onClick={() => move(i, 1)} aria-label="Move later"><ChevronRight className="size-4" /></button>
                    </div>
                    {r?.error && <p className="border-t px-2 py-1 text-xs text-destructive">{r.ocrText ? "Structure step failed — raw text kept" : r.error}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-3 font-semibold">Preview {current ? `· page ${preview + 1}` : ""}</h2>
          <div className="aspect-[210/297] overflow-hidden rounded-lg border bg-card shadow-sheet">
            {current && <img src={current.dataUrl} alt={`Page ${preview + 1} preview`} className="h-full w-full object-contain" />}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Rotate pages so text is upright before converting. Your original uploads are always kept for comparison.
          </p>
        </aside>
      </main>

      <input ref={addRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <input ref={replaceRef} type="file" accept={ACCEPT_ATTR} hidden onChange={(e) => { if (replaceIndex != null) addFiles(Array.from(e.target.files ?? []), replaceIndex); e.target.value = ""; }} />
    </div>
  );
}
