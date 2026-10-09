<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Pipeline keeps every stage (original page images → OCR text → AI blocks → AI html → user html) in one DocRecord; never overwrite an earlier stage, so users can always restore/compare.
- AI/OCR calls live only in `src/lib/ai.server.ts`, exposed via `src/lib/conversion.functions.ts`; client never sees prompts or keys.
- All document typography comes from the FormatProfile (`src/lib/format.ts`); editor CSS, print/PDF and DOCX export read it — never hard-code a format elsewhere.
- Persistence goes only through `src/lib/storage.ts` (IndexedDB today) so a backend can replace it without UI changes.
- PDF export uses browser print with A4 @page CSS (real text); DOCX is built from editor JSON in `src/lib/export-docx.ts`.
