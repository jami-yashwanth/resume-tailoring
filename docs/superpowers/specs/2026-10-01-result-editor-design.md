# Result screen as a structured editor, on one HTML template

**Decided 1 Oct 2026 (owner).** Supersedes the layout in `2026-09-29-result-screen-revamp-design.md` and the LaTeX rendering path introduced 30 Sep 2026. Builds on `2026-09-30-schema-extraction.md`, which stays as is.

## Why

The screen should read as a finished product, not a review tool: a resume the user can see as structure and edit, next to a page that is exactly what downloads. Competitors get this from one HTML/CSS template that is both the live preview and the printed PDF. Rezz now has the structured document that template needs; what remains is the editor and the renderer.

Rules unchanged: nothing added behind the user's back; no fake ATS score; page count never grows without asking; never invent numbers; English only; web first; **one template, no gallery, no picker**. Only the template's implementation changes.

## Scope

**In:** review plus light editing of the user's own lines; section reorder; one HTML/CSS template (direction C: serif, single column, ruled headings, employer line with dates right, italic title beneath); live preview from the same component; PDF printed from it by headless Chromium in docsvc; printed page count drives page fit; retirement of the LaTeX path, `shared/template.json`, the parity tests and the PNG preview route.

**Out (this version):** add section, add entry, reorder entries, colour or font pickers, a general undo/redo history, re-running tailoring after an edit, accounts or a dashboard.

## 1. Data model

The parsed `Layout`, the verified `Outline`, the plan's operations and the review state stay. The review state (persisted in sessionStorage with the result) gains:

- `edits: Record<SlotKey, string>` — the user's own text for a slot. `SlotKey` is a block id for a whole line (`"12"`), or block id plus field for an entry header field (`"12:org"`, `"12:title"`, `"12:dates"`, `"12:place"`), so retyping the employer never touches dates sharing its line. An edit wins over the original and over any rewording of that line. Undo removes the key.
- `sectionOrder: number[]` — indices into `outline.sections` in the user's order; default document order. Absent in older stored decisions, which is why it is optional and defaults.

**Flow.** Whole-line edits are one more `LineState`, `edited`, produced by `buildLines`, so the page, the download and coverage evidence read one text. Field edits apply in `resolveDocument`, which also applies `sectionOrder`. No second resolver.

**What edits do not do.** They never re-run tailoring and never reach the model. Coverage still reflects the plan; when an edit touches a line that is evidence for a requirement, the requirement row says "You edited this line; tailor again to re-check". A pending "Not in your resume" draft may be edited before deciding via the existing wording mechanism and stays `added_by_user`. Header fields are editable by the user (the titles-and-dates rule binds the AI). Edits go through the same page-fit check as everything else.

## 2. Rendering

**One component, `ResumePage`,** takes a `TemplateDocument` and renders A4 pages in HTML/CSS: template C as CSS variables (type scale, rules, spacing), Source Serif 4 self-hosted under `public/fonts/` so browser and printer use identical files. It replaces the LaTeX template, the measured CSS replica and the PNG preview.

**Preview** is that component rendered live in the right pane. On-screen page boundaries come from measuring blocks against the A4 text height; blocks never split across a boundary. This is a guide, not the count.

**PDF** is that component printed. On download the Next server renders `ResumePage` to a self-contained HTML string (inline CSS, fonts as data URIs) and posts it to docsvc `POST /print` `{ html }`, which loads it in headless Chromium (Playwright for Python; Chromium added to the docsvc image), blocks all network, prints A4 with `prefer_css_page_size` and backgrounds, enforces a 15 s timeout and a 4 MB HTML cap (ruling below), and returns `{ file, pages, renderer }`. The print HTML zeroes the browser's default body margin, so text starts at the 40pt `@page` margin exactly as on screen; `services/docsvc/tests/test_printer.py` prints the real `renderResumeHtml` output (a committed fixture, `npm run fixture:print`) and checks both edges.

**Page count is the printer's.** After edits settle (debounce), the app calls `POST /print` with `count_only: true`; the header status and the page-fit card use that number. The first printed count of the tailored document (original plus automatic rewordings) is the length the user agrees to.

**Fallback.** If printing fails, retry once, then render through docsvc's drawn renderer (`render_template` via `document_to_blocks`) and tell the user: "Saved with the fallback layout; it may differ slightly from the preview." While a count is in flight the status reads "checking pages…" and Download waits ("Checking pages…"). Never a blank result, never silent.

**Rulings (1 Oct 2026, from the implementation ledger):**
- *4 MB cap.* The HTML cap is 4 MB, not 2 MB: the two inlined Source Serif 4 faces alone are ~1 MB of base64. Over the cap docsvc answers 413 and the app says "This resume is too large to print. Remove some content and try again."
- *"page count unavailable".* A count that fails, and fails again on its one retry, keeps the last known number and shows "page count unavailable". Download comes back then; the download backstop still refuses to save a file longer than the agreed length.
- *Fallback counts never become the allowance.* A count from the drawn fallback is shown with "(fallback layout)" but is never adopted as the agreed length, because the fallback sets differently from the template. The allowance is stored with `pagesSource: "printer"`; a stored allowance without it (from before the printer) is dropped and re-counted.

**Results without an outline** (older sessions, the sample fixture, extraction that fell back) are converted from flat blocks to a one-section document (`blocksToDocument`), so `ResumePage` only ever takes a document.

**Retired in the same change:** `services/docsvc/app/latex_render.py`, `templates/rezz.tex`, `tests/test_latex_parity.py`, `tests/test_latex_render.py`, `shared/template.json`, `src/lib/tailor/template-metrics.ts`, `DefaultTemplateSheet`, `ExactPreview`, `/api/preview`, tectonic in the Dockerfile. `/render-template` is removed once `/print` passes.

## 3. Screen

**Header:** unchanged. Wordmark, role and company, one status ("2 to decide · 1 page", printer count), Compare with original, Download with its existing states (secondary while undecided, primary when nothing is, disabled while the page-fit card waits).

**Left pane, sections.** A coverage strip at the top: "Covers 6 of 9 · Your original covered 3 · See requirements", expanding into today's requirement rows. Then one row per section in `sectionOrder`: drag grip, name, a count when something waits ("2 to decide", "1 reworded", "1 edited"), chevron. Personal information (name, contact) is always first and does not move.

**Open section:** entries as labelled fields: employer and dates on one row, title, location, then bullets and lines each as a row; skills as label + items rows. Tap a field to edit in place; Enter or blur commits, Escape cancels. Marks: highlighter + "Reworded · Undo"; "Edited by you · Undo"; a "Not in your resume" draft sits where it would land, dashed, with the question, the line, "Nothing is added unless you choose Add it", **Skip / Add it** equal weight, nothing pre-selected, "Try another wording", "Why this line?". The page-fit card appears at the top of the left pane when the printed count exceeds the agreed one, offering cheapest first: a shorter wording, a named line to remove, allowing the page.

**Reorder:** drag the grip, or Move up / Move down in the row's menu (keyboard and screen readers). Sections only.

**Right pane, the page.** `ResumePage` at A4 proportion scaled to the pane. Reworded, edited and added lines highlighted; pending drafts dashed. Clicking a marked line opens its section and focuses the field. Compare with original shows the uploaded wording; the left pane is read-only with "Turn off compare to make changes."

**Widths:** below 1100px the panes stack, sections above the page. Nothing hidden at any width.

**Copy and style:** per `rezz-design` (paper and highlighter; Bricolage Grotesque + Geist for the UI; the resume itself uses the template's serif). Skip is as prominent as Add it; no shaming copy; no re-asking after Skip.

## 4. Testing

- Unit: `edits` and `sectionOrder` through `buildLines` and `resolveDocument`, with rewordings, undo, removed lines and pending drafts; field edits on split header blocks; `blocksToDocument`.
- Template: render a document to DOM; assert order, structure, and that no user text is altered.
- Printer: docsvc prints a sample document, extracts text with PyMuPDF, asserts order and page count; `count_only` returns no file; skips without Chromium, runs in the container.
- Screen: the Playwright result check extended to the two-pane layout at 1440/1240/1100/880: edit, undo, reorder, Add it, Skip, page fit, download.

## 5. Docs to update

`docs/03-ux-result-screen.md` (layout section), `docs/05-architecture.md` (render path), `CLAUDE.md` (the v1 override note: template is HTML/CSS printed by Chromium; rule unchanged), `docs/07-open-items.md` (page-fit guard closed).
