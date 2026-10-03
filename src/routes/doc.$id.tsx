import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ConvertView } from "@/components/ConvertView";
import { EditorView } from "@/components/EditorView";
import { loadDoc, saveDoc } from "@/lib/storage";
import type { DocRecord } from "@/lib/types";

export const Route = createFileRoute("/doc/$id")({
  head: () => ({
    meta: [
      { title: "Document — Scriptly" },
      { name: "description", content: "Review, convert and edit your handwritten document." },
      { property: "og:title", content: "Document — Scriptly" },
      { property: "og:description", content: "Review, convert and edit your handwritten document." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocPage,
});

function DocPage() {
  const { id } = Route.useParams();
  const [doc, setDoc] = useState<DocRecord | null | undefined>(undefined);

  useEffect(() => {
    loadDoc(id).then(setDoc).catch(() => setDoc(null));
  }, [id]);

  const persist = useCallback((next: DocRecord) => {
    const updated = { ...next, updatedAt: Date.now() };
    setDoc(updated);
    return saveDoc(updated);
  }, []);

  if (doc === undefined) return <div className="p-10 text-muted-foreground">Loading document…</div>;
  if (doc === null)
    return (
      <div className="p-10">
        <p>This document was not found in this browser.</p>
        <Link to="/" className="text-primary underline">Back to dashboard</Link>
      </div>
    );
  return doc.editorHtml == null ? <ConvertView doc={doc} persist={persist} /> : <EditorView key={doc.id} doc={doc} persist={persist} />;
}
