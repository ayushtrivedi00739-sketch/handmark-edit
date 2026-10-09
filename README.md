# DocuCraft Pro

Build a complete web application that converts handwritten A4 documents into clean, properly formatted, fully editable digital documents.

1. Main Goal

The application should take a handwritten document as an image/PDF and convert it into a clean digital document similar to Microsoft Word.

The output MUST NOT be just an image-based PDF.

The converted content must be real editable text and document elements so the user can correct any OCR/AI mistakes before exporting.

Main workflow:

Handwritten Image/PDF

→ OCR/Handwriting Recognition

→ AI-based structure understanding

→ Clean formatting

→ Editable document editor

→ User correction

→ Export as PDF/DOCX

2. Input

Allow users to upload:

- JPG

- JPEG

- PNG

- PDF

Support:

- Single-page documents

- Multiple-page documents

- A4 handwritten papers

Show the uploaded pages clearly before conversion.

The user should be able to:

- Add pages

- Remove pages

- Reorder pages

- Replace a page

- Rotate a page if required

3. Handwriting Recognition

Use an appropriate OCR/handwriting-recognition system.

The system should extract:

- Headings

- Questions

- Answers

- Paragraphs

- Lists

- Numbered points

- Tables where possible

- Labels such as Name, Roll No, Date, etc.

Do NOT simply extract text line-by-line.

The system should attempt to understand the document structure.

For example:

Handwritten:

Q1. What is DBMS?

DBMS is a software system used to manage databases.

1. Data storage

2. Data retrieval

3. Data management

Should become structured content:

Question:

Q1. What is DBMS?

Answer:

DBMS is a software system used to manage databases.

List:

1. Data storage

2. Data retrieval

3. Data management

4. AI Understanding

After OCR, use AI to improve the extracted content.

AI should:

- Correct obvious OCR mistakes

- Preserve the original meaning

- Identify headings

- Identify questions and answers

- Identify paragraphs

- Identify lists

- Detect page structure

- Preserve numbering

- Preserve important symbols and mathematical expressions as accurately as possible

IMPORTANT:

AI must NOT aggressively rewrite the user's content.

The objective is transcription + formatting, NOT essay rewriting.

If the handwriting is unclear, the system should avoid confidently inventing text.

Where possible, mark uncertain text for user review.

5. Editable Document Editor

Create a proper browser-based document editor.

The editor should feel similar to a simple Microsoft Word editor.

The converted result must be completely editable.

Users should be able to:

- Edit text

- Add text

- Delete text

- Copy/paste

- Select text

- Undo/redo

- Bold

- Italic

- Underline

- Change font

- Change font size

- Change text alignment

- Change line spacing

- Change paragraph spacing

- Create numbered lists

- Create bullet lists

- Add/remove headings

- Insert page breaks

- Edit tables

- Move content where practical

The editor should support multiple pages and A4 page visualization.

6. A4 Document Layout

The editor should visually represent an A4 page.

Use:

- A4 dimensions

- Proper margins

- Page spacing

- Printable layout

- Page breaks

The user should be able to see approximately how the final PDF/DOCX will look.

Do NOT create a simple textarea.

The application should provide a real document editing experience.

7. Reference Format System

The application should support a future "Reference Format" feature.

The user may provide:

1. Original handwritten document

2. Example of the desired final format

The application should use the reference format to understand formatting preferences such as:

- Font

- Font size

- Heading style

- Question style

- Answer style

- Margins

- Alignment

- Line spacing

- Paragraph spacing

- Numbering

- Header/footer

- Page numbering

Do NOT permanently hard-code one specific format.

Create the formatting system so these rules can be changed later.

8. OCR Review

After conversion, show a review interface.

Example:

---

Converted Document

Q1. Explain normalization.

⚠️ AI/OCR confidence: Low

[normalization]

The user can directly edit the text.

Where confidence information is available, visually indicate uncertain words without making the document difficult to read.

Provide:

- Accept

- Edit

- Ignore warning

The user must always have final control over the document.

9. Original vs Converted View

Provide an optional split-screen mode:

LEFT:

Original handwritten page

RIGHT:

Converted editable document

This will allow the user to compare the original handwriting with the converted content.

Allow synchronized page navigation where practical.

10. Export

Provide export options:

- Download as PDF

- Download as DOCX

- Save/edit later inside the application if storage is implemented

The exported PDF should preserve:

- A4 size

- Formatting

- Page breaks

- Headings

- Paragraphs

- Lists

- Tables

- Alignment

The DOCX should contain actual editable text, not screenshots of the pages.

11. User Interface

Create a clean, modern and simple UI.

Main sections:

Dashboard

- Upload Document

- Recent Documents

- Create New Conversion

Conversion Screen

- Uploaded pages

- Convert button

- Conversion progress

- OCR/AI status

Editor Screen

Top toolbar:

File

Edit

Undo

Redo

Font

Size

Bold

Italic

Underline

Alignment

Lists

Insert

Export

Main area:

A4 document editor

Optional right panel:

- AI/OCR warnings

- Confidence issues

- Formatting suggestions

12. Conversion States

Show clear progress:

Uploading...

Reading handwriting...

Understanding document structure...

Applying formatting...

Preparing editable document...

Complete

Do not freeze the UI.

Handle errors properly.

13. Error Handling

If handwriting is unclear:

Do NOT fabricate large portions of text.

Instead:

"Some text could not be confidently recognized. Please review the highlighted section."

If OCR fails:

"Unable to read this page. Please upload a clearer image."

If AI service fails:

Keep the OCR result available so the user does not lose their work.

14. Important Data Principle

Never destroy the original uploaded document.

Maintain:

Original document

↓

OCR result

↓

AI-processed result

↓

User-edited document

The user should always be able to return to the original page for comparison.

15. Architecture

Use a clean and maintainable architecture.

Prefer a simple stack.

Suggested:

Frontend:

React + TypeScript

Styling:

Tailwind CSS or another clean CSS system

Editor:

Use a reliable rich-text/document editor library instead of building a complex editor completely from scratch.

Backend:

Use a simple API/server architecture.

OCR:

Use a suitable handwriting OCR/API.

AI:

Use an API-based AI model for document structure understanding and correction.

Database/storage:

Keep this modular so it can be added without rewriting the application.

IMPORTANT:

Do not create unnecessary files.

Keep the project modular and readable.

Do not over-engineer the application.

16. Security

Never expose API keys in frontend code.

Use environment variables.

Example:

VITE_...

or server-side environment variables depending on the API.

Never hard-code secret keys.

Validate uploaded files.

Limit file size.

Reject unsupported file types.

17. Responsive Design

The application should work on:

- Laptop

- Desktop

- Tablet

Mobile support can be basic, but the main editor should be optimized for laptop/desktop because document editing is the primary use case.

18. Code Quality Rules

IMPORTANT:

- Write clean, understandable code.

- Avoid unnecessary dependencies.

- Avoid unnecessary new files.

- Reuse existing components.

- Do not rewrite working sections without a reason.

- Keep components modular.

- Use meaningful variable and function names.

- Handle loading and error states.

- Do not use fake OCR results in the final implementation.

- Do not pretend that an OCR/API service is working if it has not been connected.

- Clearly separate frontend, backend, OCR and AI logic.

19. Development Approach

Build the application in phases.

PHASE 1:

Create the UI and A4 document editor.

PHASE 2:

Implement image/PDF upload.

PHASE 3:

Connect OCR/handwriting recognition.

PHASE 4:

Connect AI document-structure processing.

PHASE 5:

Convert OCR output into editable document blocks.

PHASE 6:

Add original-vs-converted comparison.

PHASE 7:

Add PDF export.

PHASE 8:

Add DOCX export.

PHASE 9:

Add reference-format processing.

PHASE 10:

Test with real handwritten A4 documents.

20. Testing

Test with:

- Clear handwriting

- Poor handwriting

- Different handwriting styles

- Hindi/English where supported

- Headings

- Questions/answers

- Numbered lists

- Paragraphs

- Tables

- Multiple pages

- Different A4 layouts

Check that the final output remains editable.

21. Most Important Requirement

The core purpose of this application is:

"Convert handwritten A4 documents into clean, professionally formatted, editable digital documents while allowing the user to manually correct every AI/OCR mistake."

Do not prioritize visual effects over functionality.

The editor, OCR accuracy, document structure, editability and export quality are the highest priorities.

Before implementing a complicated feature, keep the architecture simple and explain any required external API/service.

Start by inspecting the existing project structure.

If this is a new project, create the minimum required project structure.

Do not add unnecessary files or libraries.

After implementation, provide:

1. What was built

2. Files created/modified

3. APIs/services required

4. Environment variables required

5. How to run the project

6. What is fully functional

7. What still requires an external API/key

8. Testing instructions

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://handmark-edit.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5c99e52a-1ba6-5c8a-b26c-d311e9655458).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
