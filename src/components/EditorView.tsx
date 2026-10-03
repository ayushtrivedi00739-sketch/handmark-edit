import { Link } from "@tanstack/react-router";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowLeft, Bold, ChevronLeft, ChevronRight, Columns2,
  Italic, List, ListOrdered, PanelRight, Redo2, Underline, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidePanel } from "@/components/SidePanel";
import { buildDocumentHtml } from "@/lib/document-html";
import { buildExtensions, setBlockAttrs } from "@/lib/editor-extensions";
import { FONT_OPTIONS, FONT_SIZES, fontCss, formatToStyle, printPageCss, type FormatProfile } from "@/lib/format";
import type { DocRecord } from "@/lib/types";

type Props = { doc: DocRecord; persist: (d: DocRecord) => Promise<void> };

export function EditorView({ doc, persist }: Props) {
  const docRef = useRef(doc);
  docRef.current = doc;
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(true);
  const [split, setSplit] = useState(false);
  const [panel, setPanel] = useState(true);
  const [page, setPage] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: buildExtensions(),
    content: doc.editorHtml,
    editorProps: { attributes: { class: "doc-content", spellcheck: "true" } },
    onUpdate: ({ editor }) => {
      setSaved(false);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await persist({ ...docRef.current, editorHtml: editor.getHTML() });
        setSaved(true);
      }, 700);
    },
  });

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const setFormat = (format: FormatProfile) => persist({ ...docRef.current, format });

  function goToPage(i: number) {
    setPage(i);
    const container = scrollRef.current;
    if (!container) return;
    if (i === 0) return container.scrollTo({ top: 0, behavior: "smooth" });
    container.querySelectorAll(".page-break")[i - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function restore(source: "ai" | "ocr") {
    if (!editor) return;
    const html = source === "ai" && doc.aiHtml ? doc.aiHtml : buildDocumentHtml(doc.pages, doc.results, doc.format, "ocr");
    if (!confirm("Replace the current document with this version? Your edits will be lost.")) return;
    editor.commands.setContent(html, { emitUpdate: true });
    toast.success(source === "ai" ? "AI version restored" : "Raw OCR text restored");
  }

  async function exportDocxFile() {
    if (!editor) return;
    try {
      const { exportDocx } = await import("@/lib/export-docx");
      await exportDocx(editor.getJSON(), doc.format, doc.title);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "DOCX export failed.");
    }
  }

  return (
    <div className="flex h-screen flex-col print-flow">
      <style>{printPageCss(doc.format)}</style>
      <header className="no-print flex items-center gap-3 border-b bg-card px-4 py-2">
        <Link to="/" className="tb-btn" aria-label="Back to dashboard"><ArrowLeft className="size-4" /></Link>
        <input
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
          value={doc.title}
          onChange={(e) => persist({ ...doc, title: e.target.value })}
          aria-label="Document title"
        />
        <span className="text-xs text-muted-foreground">{saved ? "Saved in this browser" : "Saving…"}</span>
        {doc.pages.length > 0 && (
          <button className="tb-btn gap-1 text-sm" data-active={split} onClick={() => setSplit(!split)}>
            <Columns2 className="size-4" /> <span className="hidden md:inline">Compare</span>
          </button>
        )}
        <button className="tb-btn gap-1 text-sm" data-active={panel} onClick={() => setPanel(!panel)}>
          <PanelRight className="size-4" /> <span className="hidden md:inline">Review</span>
        </button>
      </header>

      {editor && (
        <Toolbar
          editor={editor}
          hasSource={doc.pages.length > 0}
          onPrint={() => window.print()}
          onDocx={exportDocxFile}
          onRestore={restore}
          onSave={() => persist({ ...docRef.current, editorHtml: editor.getHTML() }).then(() => toast.success("Saved"))}
        />
      )}

      <div className="flex min-h-0 flex-1 print-flow">
        {split && doc.pages[page] && (
          <aside className="no-print flex w-[38%] flex-col border-r bg-desk">
            <div className="flex items-center justify-between border-b bg-card px-3 py-1.5 text-sm">
              <button className="tb-btn" disabled={page === 0} onClick={() => goToPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></button>
              <span>Original · page {page + 1} of {doc.pages.length}</span>
              <button className="tb-btn" disabled={page >= doc.pages.length - 1} onClick={() => goToPage(page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <img src={doc.pages[page].dataUrl} alt={`Original page ${page + 1}`} className="mx-auto w-full max-w-[210mm] bg-sheet shadow-sheet" />
            </div>
          </aside>
        )}

        <div ref={scrollRef} className="flex-1 overflow-auto bg-desk px-4 py-8 print-flow">
          <div className="doc-sheet mx-auto" style={formatToStyle(doc.format)}>
            {doc.format.headerText && <div className="doc-header">{doc.format.headerText}</div>}
            <EditorContent editor={editor} />
          </div>
        </div>

        {panel && editor && (
          <aside className="no-print w-80 shrink-0 border-l bg-card max-md:hidden">
            <SidePanel editor={editor} doc={doc} onFormatChange={setFormat} />
          </aside>
        )}
      </div>
    </div>
  );
}

type ToolbarProps = {
  editor: Editor;
  hasSource: boolean;
  onPrint: () => void;
  onDocx: () => void;
  onRestore: (s: "ai" | "ocr") => void;
  onSave: () => void;
};

function Toolbar({ editor, hasSource, onPrint, onDocx, onRestore, onSave }: ToolbarProps) {
  const chain = () => editor.chain().focus();
  const style = editor.getAttributes("textStyle");
  const block = editor.isActive("heading") ? editor.getAttributes("heading") : editor.getAttributes("paragraph");
  const fontValue = FONT_OPTIONS.find((f) => f.css === style.fontFamily)?.label ?? "";
  const headingValue = [1, 2, 3].find((l) => editor.isActive("heading", { level: l }));
  const inTable = editor.isActive("table");
  const btn = (label: string, active: boolean, onClick: () => void, icon: React.ReactNode, disabled = false) => (
    <button type="button" className="tb-btn" data-active={active} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {icon}
    </button>
  );
  const menu = (label: string, items: React.ReactNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger className="tb-btn px-2 text-sm font-medium">{label}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">{items}</DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="no-print flex flex-wrap items-center gap-0.5 border-b bg-card px-3 py-1.5">
      {menu("File", <>
        <DropdownMenuItem onClick={onSave}>Save</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onPrint}>Download as PDF (print → Save as PDF)</DropdownMenuItem>
        <DropdownMenuItem onClick={onDocx}>Download as DOCX</DropdownMenuItem>
        {hasSource && <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onRestore("ai")}>Restore AI-formatted version</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRestore("ocr")}>Restore raw OCR text</DropdownMenuItem>
        </>}
      </>)}
      {menu("Edit", <>
        <DropdownMenuItem onClick={() => chain().undo().run()}>Undo (Ctrl+Z)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => chain().redo().run()}>Redo (Ctrl+Y)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { editor.commands.focus(); document.execCommand("cut"); }}>Cut</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { editor.commands.focus(); document.execCommand("copy"); }}>Copy</DropdownMenuItem>
        <DropdownMenuItem disabled>Paste (Ctrl+V)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => chain().selectAll().run()}>Select all</DropdownMenuItem>
      </>)}
      {menu("Insert", <>
        <DropdownMenuItem onClick={() => chain().insertContent({ type: "pageBreak" }).run()}>Page break</DropdownMenuItem>
        <DropdownMenuItem onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table (3×3)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => chain().setHorizontalRule().run()}>Horizontal line</DropdownMenuItem>
        {inTable && <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => chain().addRowAfter().run()}>Add row below</DropdownMenuItem>
          <DropdownMenuItem onClick={() => chain().addColumnAfter().run()}>Add column right</DropdownMenuItem>
          <DropdownMenuItem onClick={() => chain().deleteRow().run()}>Delete row</DropdownMenuItem>
          <DropdownMenuItem onClick={() => chain().deleteColumn().run()}>Delete column</DropdownMenuItem>
          <DropdownMenuItem onClick={() => chain().toggleHeaderRow().run()}>Toggle header row</DropdownMenuItem>
          <DropdownMenuItem onClick={() => chain().deleteTable().run()}>Delete table</DropdownMenuItem>
        </>}
      </>)}
      <span className="tb-sep" />
      {btn("Undo", false, () => chain().undo().run(), <Undo2 className="size-4" />, !editor.can().undo())}
      {btn("Redo", false, () => chain().redo().run(), <Redo2 className="size-4" />, !editor.can().redo())}
      <span className="tb-sep" />
      <select className="tb-select w-28" aria-label="Paragraph style" value={headingValue ? `h${headingValue}` : "p"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") chain().setParagraph().run();
          else chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
        }}>
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <select className="tb-select w-36" aria-label="Font" value={fontValue}
        onChange={(e) => (e.target.value ? chain().setFontFamily(fontCss(e.target.value)).run() : chain().unsetFontFamily().run())}>
        <option value="">Document font</option>
        {FONT_OPTIONS.map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
      </select>
      <select className="tb-select w-16" aria-label="Font size" value={style.fontSize ? parseFloat(style.fontSize) : ""}
        onChange={(e) => (e.target.value ? chain().setFontSize(`${e.target.value}pt`).run() : chain().unsetFontSize().run())}>
        <option value="">—</option>
        {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <span className="tb-sep" />
      {btn("Bold", editor.isActive("bold"), () => chain().toggleBold().run(), <Bold className="size-4" />)}
      {btn("Italic", editor.isActive("italic"), () => chain().toggleItalic().run(), <Italic className="size-4" />)}
      {btn("Underline", editor.isActive("underline"), () => chain().toggleUnderline().run(), <Underline className="size-4" />)}
      <span className="tb-sep" />
      {btn("Align left", editor.isActive({ textAlign: "left" }), () => chain().setTextAlign("left").run(), <AlignLeft className="size-4" />)}
      {btn("Align center", editor.isActive({ textAlign: "center" }), () => chain().setTextAlign("center").run(), <AlignCenter className="size-4" />)}
      {btn("Align right", editor.isActive({ textAlign: "right" }), () => chain().setTextAlign("right").run(), <AlignRight className="size-4" />)}
      {btn("Justify", editor.isActive({ textAlign: "justify" }), () => chain().setTextAlign("justify").run(), <AlignJustify className="size-4" />)}
      <span className="tb-sep" />
      {btn("Bullet list", editor.isActive("bulletList"), () => chain().toggleBulletList().run(), <List className="size-4" />)}
      {btn("Numbered list", editor.isActive("orderedList"), () => chain().toggleOrderedList().run(), <ListOrdered className="size-4" />)}
      <span className="tb-sep" />
      <select className="tb-select w-24" aria-label="Line spacing" title="Line spacing" value={block.lineHeight ?? ""}
        onChange={(e) => setBlockAttrs(editor, { lineHeight: e.target.value ? Number(e.target.value) : null })}>
        <option value="">Line: doc</option>
        {[1, 1.15, 1.5, 2, 2.5].map((v) => <option key={v} value={v}>Line {v}</option>)}
      </select>
      <select className="tb-select w-28" aria-label="Paragraph spacing" title="Space after paragraph" value={block.spaceAfter ?? ""}
        onChange={(e) => setBlockAttrs(editor, { spaceAfter: e.target.value === "" ? null : Number(e.target.value) })}>
        <option value="">After: doc</option>
        {[0, 4, 8, 12, 18, 24].map((v) => <option key={v} value={v}>After {v}pt</option>)}
      </select>
      <span className="tb-sep" />
      {menu("Export", <>
        <DropdownMenuItem onClick={onPrint}>PDF (A4)</DropdownMenuItem>
        <DropdownMenuItem onClick={onDocx}>Word (.docx)</DropdownMenuItem>
      </>)}
    </div>
  );
}
