import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FilePlus2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DEFAULT_FORMAT } from "@/lib/format";
import { ACCEPT_ATTR, MAX_FILE_MB, filesToPages } from "@/lib/pages";
import { deleteDoc, listDocs, saveDoc } from "@/lib/storage";
import type { DocRecord, PageImage } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scriptly — Turn handwritten pages into editable documents" },
      { name: "description", content: "Upload handwritten A4 pages, review the AI transcription, and export clean PDF or Word documents." },
      { property: "og:title", content: "Scriptly — Handwriting to editable documents" },
      { property: "og:description", content: "Upload handwritten A4 pages and get a clean, editable document you can export as PDF or DOCX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function newDoc(title: string, pages: PageImage[], editorHtml?: string): DocRecord {
  const now = Date.now();
  return { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now, pages, results: {}, format: { ...DEFAULT_FORMAT }, editorHtml };
}

function Dashboard() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    listDocs().then(setDocs).catch(() => setDocs([]));
  }, []);

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    try {
      const { pages, errors } = await filesToPages(files);
      errors.forEach((e) => toast.error(e));
      if (!pages.length) return;
      const doc = newDoc(files[0].name.replace(/\.[^.]+$/, ""), pages);
      await saveDoc(doc);
      navigate({ to: "/doc/$id", params: { id: doc.id } });
    } finally {
      setBusy(false);
    }
  }

  async function startBlank() {
    const doc = newDoc("Untitled document", [], "<p></p>");
    await saveDoc(doc);
    navigate({ to: "/doc/$id", params: { id: doc.id } });
  }

  async function remove(id: string) {
    await deleteDoc(id);
    setDocs((d) => d?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-semibold tracking-tight">Scriptly</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">handwriting → editable documents</span>
          </div>
          <Button variant="outline" onClick={startBlank}>
            <FilePlus2 /> Blank document
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <section>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">New conversion</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Upload photos or scans of handwritten A4 pages. You'll review every page, convert it to real text, and fix anything the AI wasn't sure about before exporting.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(Array.from(e.dataTransfer.files));
            }}
            className={`mt-6 flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              dragging ? "border-primary bg-accent" : "border-input bg-card hover:border-primary/60"
            }`}
          >
            {busy ? <Loader2 className="size-8 animate-spin text-primary" /> : <Upload className="size-8 text-primary" />}
            <span className="text-lg font-medium">{busy ? "Uploading…" : "Drop pages here or click to upload"}</span>
            <span className="text-sm text-muted-foreground">JPG, PNG or PDF · up to {MAX_FILE_MB} MB per file · multiple pages supported</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            hidden
            onChange={(e) => {
              handleFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Recent documents</h2>
          {docs === null ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : docs.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No documents yet. Your conversions are saved in this browser.</p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {docs.map((d) => (
                <li key={d.id} className="group relative overflow-hidden rounded-lg border bg-card">
                  <Link to="/doc/$id" params={{ id: d.id }} className="block">
                    <div className="flex aspect-[210/150] items-center justify-center overflow-hidden bg-desk">
                      {d.pages[0] ? (
                        <img src={d.pages[0].dataUrl} alt="" className="h-full w-full object-cover object-top" />
                      ) : (
                        <FileText className="size-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.pages.length} page{d.pages.length === 1 ? "" : "s"} · {d.editorHtml != null ? "Editable" : "Not converted"} ·{" "}
                        {new Date(d.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${d.title}`}
                    onClick={() => remove(d.id)}
                    className="absolute right-2 top-2 rounded-md bg-card/90 p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
