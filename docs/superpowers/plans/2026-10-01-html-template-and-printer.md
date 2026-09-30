# HTML Template and Chromium Printer Implementation Plan (plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One React component renders the resume as A4 HTML/CSS; it is the live preview in the Result screen and, printed by headless Chromium in docsvc, the downloaded PDF; the printed page count drives page fit; the LaTeX path, its measured CSS replica and the PNG preview are retired.

**Architecture:** `ResumePage` (React, template direction C, CSS-variable tokens, self-hosted Source Serif 4) takes a `TemplateDocument` whose items now carry review marks. The browser renders it live and paginates by measurement for display only. For download and page count the Next server renders the same component to a self-contained HTML string and posts it to docsvc `POST /print`, which prints A4 in Chromium (Playwright for Python), falls back to the drawn renderer on failure, and returns the PDF and its page count. Results without an outline are converted to a one-section document so the component only ever takes a document.

**Tech Stack:** Next 15 / React 19 (`react-dom/server` for the print HTML) / vitest; FastAPI / Playwright for Python / Chromium / PyMuPDF / pytest; Docker.

**Spec:** `docs/superpowers/specs/2026-10-01-result-editor-design.md` (sections 2 and 4, and the parts of 1 and 3 that the preview needs). The sections editor is plan 2.

## Global Constraints

- One template, no gallery, no picker (CLAUDE.md v1 override); direction C: serif, single column, ruled uppercase headings, employer line with dates right-aligned, italic title beneath, bullets with "•".
- The page the user sees is the page that downloads: preview and PDF come from the same `ResumePage` component and the same `RESUME_CSS`; nothing else renders a resume.
- User text is never altered by rendering: React escapes it; no trimming, casing or punctuation changes beyond what `resolveDocument` already does.
- Page count shown to the user is the printer's (`/print` `pages`), never the on-screen measurement. Status copy while unknown: "checking pages…".
- Printer limits: request body over 2 MB → HTTP 413; print timeout 15 s; all network requests from the printed page aborted; fonts arrive inline as `data:font/woff2;base64,…`.
- Fallback copy (download message when `renderer === "fallback"`): "Saved with the fallback layout; it may differ slightly from the preview." Never a blank result, never silent.
- A4: 595.28 × 841.89 pt; page margin 40 pt on all sides; body 10 pt / 13.5 pt leading; name 20 pt; heading 10.5 pt uppercase letter-spaced 0.06 em with a 0.6 pt rule beneath; ink `#111111`. Source Serif 4 (OFL) self-hosted under `public/fonts/source-serif-4/` with its `LICENSE.md`.
- Field names of `TemplateDocument` stay exactly as they are (docsvc mirrors them); new item fields are optional and ignored by docsvc.
- Design: follow `.claude/skills/rezz-design` for any UI chrome touched; the resume itself uses the template's serif, not the UI type.
- Every commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. A two-page resume: no bullet or entry header is split across the printed page break, and the on-screen boundary falls on a block edge. → Task 2 `test_blocks_never_split_across_pages`; Task 1 `breaks pages only between blocks`.
2. User text containing HTML or LaTeX-looking characters (`<script>`, `&`, `%`, `\`): rendered as literal text in both preview and PDF. → Task 1 `renders user text literally`; Task 2 `test_print_keeps_special_characters_as_text`.
3. Chromium absent or crashing (a dev machine without the browser, a container OOM): download still succeeds through the drawn renderer and says so. → Task 2 `test_print_falls_back_to_drawn_renderer`; Task 3 `reports the fallback layout in the download message`.
4. A stored result from before outlines (no `outline`, flat blocks only): opens, previews and downloads. → Task 1 `blocksToDocument builds a one-section document`; Task 4 `builds a document when there is no outline`.
5. Fast successive edits: an older page-count response must not overwrite a newer one. → Task 4 `ignores a stale page-count response`.

---

### Task 1: Page constants, template CSS, `ResumePage`, print HTML

**Files:**
- Create: `src/lib/tailor/page.ts`
- Create: `src/components/resume/resumeCss.ts`
- Create: `src/components/resume/ResumePage.tsx`
- Create: `src/lib/tailor/resume-html.ts`
- Create: `public/fonts/source-serif-4/SourceSerif4Variable-Roman.otf.woff2`, `…-Italic.otf.woff2`, `LICENSE.md` (from the `4.005R` release zip at https://github.com/adobe-fonts/source-serif/releases, `WOFF2/VAR/`)
- Modify: `src/lib/tailor/document.ts` (`Item` gains marks; `blocksToDocument`)
- Test: `src/components/resume/ResumePage.test.tsx`, `src/lib/tailor/document.test.ts`

**Interfaces:**
- Consumes: `TemplateDocument`, `resolveDocument` (existing); `RenderedLine`, `LineState` (`view.ts`); `TemplateBlock` (`docsvc.ts`).
- Produces:
  ```ts
  // page.ts — A4 in points, the one place these numbers live
  export const A4 = { width: 595.28, height: 841.89, margin: 40 } as const;
  export const CONTENT_HEIGHT_PT = A4.height - 2 * A4.margin;
  export const contentHeightFor = (contentWidthPx: number) => number; // px of content height at that width

  // document.ts
  export type Item = { text: string; bullet: boolean; key?: string; state?: LineState; opId?: string; blockId?: string };
  export function blocksToDocument(blocks: { kind: BlockKind; text: string }[]): TemplateDocument;
  // resolveDocument now fills key/state/opId/blockId on every item from its RenderedLine; header fields unchanged.

  // resumeCss.ts
  export const RESUME_CSS: string; // template C tokens as CSS variables on .rz-page, @page { size: A4; margin: 40pt }, break-inside: avoid on .rz-block

  // ResumePage.tsx (server-safe: no hooks, no browser APIs)
  export function ResumePage(props: { document: TemplateDocument; marks?: boolean }): JSX.Element;
  // Every block element: class "rz-block", data-key, data-block, data-op, data-state when marks (default true).
  // Sections in document order; entry header: <div class="rz-row"><span class="rz-org">org<span class="rz-place">, place</span></span><span class="rz-dates">dates</span></div><div class="rz-title">title</div>.

  // resume-html.ts (server only)
  export function renderResumeHtml(document: TemplateDocument): string;
  // <!doctype html><html><head><meta charset="utf-8"><style>@font-face…data:font/woff2;base64…</style><style>RESUME_CSS</style></head><body><ResumePage marks={false}/></body></html>
  ```
  `blocksToDocument`: name→`name`; contact→`contact[]`; heading→new section `{heading, kind:"other"}`; role→new entry with `org`/`dates` split on the first tab, `title` from a following `job_title`; bullet→item `{bullet:true}` (marker stripped) on the current entry, else the section's `items`; paragraph→item `{bullet:false}`; blocks before any heading go into a heading-less first section.

- [ ] **Step 1: Write the failing tests.** `ResumePage.test.tsx` renders with `renderToStaticMarkup` (no DOM needed) a fixture document with two sections, one entry with two bullets and a `Tech:` line, a skills row, and a contact list:
  - `renders sections, entries and items in document order` — indexes of `Summary`, `Inncircles`, first bullet, `Tech:` and `Languages` increase.
  - `sets the entry header as org, place, dates and italic title` — contains `class="rz-org"`, `class="rz-dates"`, `class="rz-title"` in that order for the entry.
  - `renders user text literally` — a bullet `"<script>alert(1)</script> & 100% \\LaTeX"` appears escaped (`&lt;script&gt;`), never as a tag.
  - `marks every block with its key, block, op and state` — an item `{key:"line-op1", state:"reworded", opId:"op1", blockId:"7"}` yields `data-key="line-op1" data-block="7" data-op="op1" data-state="reworded"`; with `marks={false}` none of the `data-` attributes appear.
  - `breaks pages only between blocks` — every rendered block has class `rz-block` and `RESUME_CSS` contains `.rz-block{break-inside:avoid` (whitespace-insensitive).
  - `renderResumeHtml embeds fonts and css` — output starts with `<!doctype html>`, contains `data:font/woff2;base64,` twice and `RESUME_CSS`.
  In `document.test.ts`: `blocksToDocument builds a one-section document` (name, contact, heading, role "Google\tJun 2022", job_title, bullet → one section, one entry `{org:"Google", dates:"Jun 2022", title:…}` with one bullet item); `resolveDocument carries marks onto items` (a reworded bullet's item has `state:"reworded"`, `opId`, `key`, `blockId`).
- [ ] **Step 2: Run** `npx vitest run src/components/resume src/lib/tailor/document.test.ts` — expected: FAIL, modules not found.
- [ ] **Step 3: Implement** `page.ts`, `resumeCss.ts`, `ResumePage.tsx`, `resume-html.ts` (read the two woff2 files once with `fs.readFileSync` at module load, base64 them into `@font-face` for `font-family: "Source Serif 4"` with `font-weight: 200 900`, roman and italic), the `Item` marks and `blocksToDocument`; add the font files and license.
- [ ] **Step 4: Run** `npx vitest run src/components/resume src/lib/tailor && npm run typecheck` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(resume): ResumePage HTML template with print HTML and marks`.

---

### Task 2: docsvc `/print` with Chromium and drawn fallback

**Files:**
- Modify: `services/docsvc/requirements.txt` (add `playwright`, pinned to the current 1.x release at implementation time and recorded in the report)
- Create: `services/docsvc/app/printer.py`
- Modify: `services/docsvc/app/template_render.py` (move `document_to_blocks` here from `latex_render.py`; `latex_render.py` keeps a re-export until Task 5 deletes it)
- Modify: `services/docsvc/app/main.py` (add `/print`; leave `/render-template` in place until Task 5)
- Modify: `services/docsvc/Dockerfile` (after `pip install`: `RUN playwright install --with-deps chromium`; tectonic removal is Task 5)
- Test: `services/docsvc/tests/test_printer.py`

**Interfaces:**
- Consumes: `render_template(blocks)` and `document_to_blocks(doc)`; `Document` model.
- Produces:
  ```python
  # printer.py
  class PrintError(Exception): ...
  async def print_html(html: str, timeout: float = 15.0) -> bytes   # A4 PDF bytes via Chromium; raises PrintError
  async def shutdown() -> None                                        # closes the shared browser
  # One Chromium launched lazily and shared (asyncio.Lock around launch); a fresh context per call;
  # context.route("**/*", abort) before set_content; page.pdf(format="A4", prefer_css_page_size=True, print_background=True).
  # main.py
  class PrintRequest(BaseModel): html: str; document: Document; count_only: bool = False
  # POST /print -> {"pages": int, "renderer": "chromium" | "fallback", "file": str | None}
  #   - len(html) > 2_000_000 -> 413 detail "html over 2 MB"
  #   - try print_html once, on PrintError retry once, then render_template(document_to_blocks(document)) with renderer "fallback"
  #   - pages via pymupdf; file omitted (None) when count_only
  # app.add_event_handler("shutdown", printer.shutdown)
  ```
  Local dev: `.venv/bin/pip install -r requirements.txt && .venv/bin/playwright install chromium`; tests skip with `pytest.mark.skipif` when `playwright`'s chromium executable is missing (`from playwright.sync_api import sync_playwright` + try launch in a session fixture).

- [ ] **Step 1: Write the failing tests** in `test_printer.py` with a module-level `HTML` (a minimal A4 page with `@page{size:A4;margin:40pt}`, three `.rz-block` paragraphs with `break-inside:avoid`, one containing `<script>` escaped text and `100% & \LaTeX`) and `DOC` (a small `Document` dict):
  - `test_print_returns_an_a4_pdf` — 200, `renderer == "chromium"`, `pages == 1`, decoded file opens in pymupdf with page width within 1 pt of 595.28.
  - `test_count_only_returns_pages_without_a_file` — `file is None`, `pages == 1`.
  - `test_print_keeps_special_characters_as_text` — page text contains `<script>alert(1)</script>` and `100% & \LaTeX` literally.
  - `test_blocks_never_split_across_pages` — HTML with 80 blocks of four lines each: for every page, the first text line of the page is the first line of a block (each block starts with a marker like `B17:`).
  - `test_rejects_html_over_2mb` — 413.
  - `test_print_falls_back_to_drawn_renderer` — monkeypatch `printer.print_html` to raise `PrintError`; 200 with `renderer == "fallback"`, `pages >= 1`, and the fallback's PDF text contains the document's name.
- [ ] **Step 2: Run** `cd services/docsvc && .venv/bin/python -m pytest tests/test_printer.py -v` — expected: FAIL (import error).
- [ ] **Step 3: Implement** `printer.py`, the `/print` endpoint (async def), the `document_to_blocks` move, requirements and Dockerfile line; run `playwright install chromium` locally.
- [ ] **Step 4: Run** `cd services/docsvc && .venv/bin/python -m pytest -q` — expected: PASS (report whether the Chromium tests ran or skipped; they must run on the implementer's machine).
- [ ] **Step 5: Commit** — `feat(docsvc): print the HTML resume with Chromium, drawn fallback`.

---

### Task 3: Web routes and client for print and page count

**Files:**
- Modify: `src/lib/tailor/docsvc.ts` (add `printResume`; remove `renderTemplate`, `TemplateInput`, `TemplateBlock` stays for `blocksToDocument`)
- Modify: `src/app/api/download/route.ts` (body `{ document }`; returns `{ file, pages, renderer }`)
- Create: `src/app/api/pages/route.ts` (body `{ document }` → `{ pages, renderer }`)
- Modify: `src/lib/tailor/download.ts` (`downloadResume(document, filename, company)`; remove `downloadBlocks`, `templateInput`)
- Create: `src/lib/tailor/pages.ts`
- Delete: `src/lib/tailor/preview.ts`, `src/lib/tailor/preview.test.ts`, `src/app/api/preview/route.ts`
- Test: `src/lib/tailor/download.test.ts`, `src/lib/tailor/pages.test.ts`

**Interfaces:**
- Consumes: `renderResumeHtml` (Task 1); docsvc `/print` (Task 2).
- Produces:
  ```ts
  // docsvc.ts
  export type PrintResult = { file: string | null; pages: number; renderer: "chromium" | "fallback" };
  export const printResume = (input: { html: string; document: TemplateDocument; countOnly?: boolean }) => Promise<PrintResult>;
  // download.ts
  export const FALLBACK_NOTE = "Saved with the fallback layout; it may differ slightly from the preview.";
  export async function downloadResume(document: TemplateDocument, filename: string | null, company: string): Promise<{ name: string; pages: number | null; note: string | null }>;
  // pages.ts
  export async function fetchPageCount(document: TemplateDocument, signal?: AbortSignal): Promise<number>; // POST /api/pages; throws on !ok
  ```
  Both routes: 400 `"Nothing to download yet."` / `"Nothing to count yet."` when `document` is missing or has no name, contact and sections; 502 with the docsvc message on failure, as today.

- [ ] **Step 1: Write the failing tests**: in `download.test.ts` replace the `downloadBlocks` test with `reports the fallback layout in the download message` (mock `fetch` returning `{file, pages: 1, renderer: "fallback"}`; stub `URL.createObjectURL`, `document.createElement`; result `note === FALLBACK_NOTE`; with `renderer: "chromium"` note is `null`); in `pages.test.ts` `posts the document and returns the printer's count` and `throws with the server message on failure`.
- [ ] **Step 2: Run** `npx vitest run src/lib/tailor/download.test.ts src/lib/tailor/pages.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** the routes, client functions and deletions. `ResultScreen` and `ExactPreview` will not compile until Task 4; do Task 3 and Task 4 as separate commits but run typecheck only at the end of Task 4 (state this in the Task 3 report).
- [ ] **Step 4: Run** `npx vitest run src/lib/tailor` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): download and page count through the Chromium printer`.

---

### Task 4: Result screen renders `ResumePage` and uses the printed count

**Files:**
- Create: `src/components/resume/ResumePreview.tsx` (client)
- Create: `src/lib/tailor/usePrintedPages.ts`
- Modify: `src/components/result/ResultScreen.tsx` (document memo; preview; printed pages; download call; drop `exact`)
- Modify: `src/components/result/ResultHeader.tsx` (remove the exact toggle; status shows "checking pages…" while `pages === null`)
- Modify: `src/lib/tailor/review.ts` (`ReviewState.pages: number | null`, initial `null`; `measuredPages` unchanged)
- Modify: `src/lib/tailor/paginate.ts` (import `CONTENT_HEIGHT_PT`/`contentHeightFor` from `page.ts` instead of `template-metrics`)
- Delete: `src/components/result/ExactPreview.tsx`
- Modify: `scripts/result-check.mjs` (drop the exact-preview toggle check; keep the rest)
- Test: `src/lib/tailor/usePrintedPages.test.ts`, `src/lib/tailor/paginate.test.ts`, `src/lib/tailor/review.test.ts`

**Interfaces:**
- Consumes: `ResumePage`, `blocksToDocument`, `resolveDocument` with marks (Task 1); `fetchPageCount`, `downloadResume` (Task 3); `paginate(heights, pageHeight)`.
- Produces:
  ```tsx
  // ResumePreview.tsx — the A4 sheet(s) in the right pane
  export function ResumePreview(props: {
    document: TemplateDocument;
    activeOpId: string | null;
    highlightBlocks: string[] | null;   // blocks lit by a requirement row; others dimmed
    onSelect: (opId: string) => void;    // click on a marked block
    onVisiblePage?: (page: number) => void;
  }): JSX.Element;
  // Renders <ResumePage marks /> once into a hidden measuring column at the sheet's content width, reads each
  // .rz-block height, calls paginate(heights, contentHeightFor(width)), then renders the visible pages as
  // A4-proportioned sheets each holding its block range. Marks: [data-state="reworded"|"added"] highlighter,
  // [data-state="pending"] dashed coral, [data-op=activeOpId] outlined. Re-measures on ResizeObserver and document.fonts.ready.

  // usePrintedPages.ts
  export function usePrintedPages(document: TemplateDocument, delayMs = 800): { pages: number | null; checking: boolean };
  // Debounced fetchPageCount; an AbortController per request; a response whose request was superseded is ignored;
  // on error keeps the previous pages and sets checking=false.
  ```
  ```ts
  // document.ts (added here)
  export function linesToDocument(lines: RenderedLine[]): TemplateDocument; // grouped lines minus removed/pending → blocksToDocument
  ```
  `ResultScreen`: `const document = useMemo(() => outline ? resolveDocument(outline, documentLines) : linesToDocument(lines), …)`; dispatch `measuredPages` whenever `usePrintedPages(document).pages` changes; the header status reads "checking pages…" while `state.pages === null`; `downloadResume(document, filename, company)` and surface `note` in the existing download message area; `pagesBefore` stays `layout.pages`.

- [ ] **Step 1: Write the failing tests**: `usePrintedPages.test.ts` (vitest fake timers, `fetch` mocked): `debounces and returns the printer's count`; `ignores a stale page-count response` (first request resolves after the second; result is the second's count); `keeps the last count on error`. `paginate.test.ts`: existing cases pass against `page.ts` numbers. `review.test.ts`: `starts with pages null and adopts the first printed count as the allowance`. In `document.test.ts`: `builds a document when there is no outline` — `linesToDocument` on grouped lines with one removed and one pending line yields a document without them.
- [ ] **Step 2: Run** `npx vitest run src/lib/tailor/usePrintedPages.test.ts src/lib/tailor/paginate.test.ts src/lib/tailor/review.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** the hook, `ResumePreview`, `linesToDocument`, and the screen/header/review changes; delete `ExactPreview`; update `result-check.mjs`.
- [ ] **Step 4: Run** `npm run typecheck && npm test`, then with docsvc and the app running (`npm run docsvc`, `npm run dev`) open `/result` on the sample and on a real tailoring: the right pane shows template C, marks highlight, clicking a marked line opens its card, the header count matches the downloaded PDF's page count, and the download opens. Run `npm run check:result` — expected: all checks ✓.
- [ ] **Step 5: Commit** — `feat(result): live ResumePage preview and printed page count`.

---

### Task 5: Retire the LaTeX path and the measured replica; docs

**Files:**
- Delete: `services/docsvc/app/latex_render.py`, `services/docsvc/templates/rezz.tex`, `services/docsvc/tests/fixtures/owner_reference.tex`, `services/docsvc/tests/test_latex_render.py`, `services/docsvc/tests/test_latex_parity.py`, `shared/template.json`, `src/lib/tailor/template-metrics.ts`, `src/lib/tailor/template-metrics.test.ts`, `src/components/result/DefaultTemplateSheet.tsx`
- Modify: `services/docsvc/app/main.py` (remove `/render-template`, `RenderTemplateRequest`, `TemplateBlock`, the latex import; keep `render_template` for the fallback), `services/docsvc/Dockerfile` (remove the tectonic stage, warm-up and `COPY templates`; keep fonts and Playwright), `services/docsvc/README*`/comments that mention tectonic
- Modify: `src/components/rezz/ResumeSheet.tsx` (import `A4` from `page.ts`; `padding: pct(A4.margin / A4.width)` with a local `pct`), `src/app/layout.tsx` + `src/app/globals.css` (drop the Roboto font and `--font-sheet` if nothing else uses them; `grep` first), `src/lib/tailor/docsvc.ts` (drop `TemplateBlock` if unused)
- Modify docs: `docs/03-ux-result-screen.md` (Layout: two panes to come in plan 2; for now: centre is `ResumePage`, page count is the printer's, exact preview toggle gone), `docs/05-architecture.md` (render path: ResumePage → renderResumeHtml → docsvc /print → Chromium, drawn fallback; retire LaTeX paragraph), `CLAUDE.md` v1 override line (template is one HTML/CSS component printed by Chromium; rule unchanged), `docs/07-open-items.md` (page-fit guard closed: count is the printer's)
- Test: the whole suite on both sides

**Interfaces:** consumes everything above; produces nothing new.

- [ ] **Step 1: Delete and edit** as listed; grep for `latex`, `tectonic`, `template-metrics`, `template.json`, `render-template`, `renderTemplate`, `ExactPreview`, `DefaultTemplateSheet`, `font-sheet`, `font-roboto` across `src`, `services`, `scripts`, `docs`, `shared` and resolve every hit (delete, retarget or reword).
- [ ] **Step 2: Run** `npm run typecheck && npm test && (cd services/docsvc && .venv/bin/python -m pytest -q)` — expected: PASS on both sides with no skipped Chromium tests on the implementer's machine.
- [ ] **Step 3: Build the docsvc image** `docker build services/docsvc -t docsvc:print` and run `docker run --rm -p 8001:8001 -e DOCSVC_ALLOW_INSECURE=true docsvc:print` then `curl -sf localhost:8001/health` and one `POST /print` with the Task 2 fixture — expected: `renderer: "chromium"`. If Docker is unavailable on the machine, say so in the report; the Dockerfile edit still lands.
- [ ] **Step 4: Update the docs** as listed.
- [ ] **Step 5: Commit** — `chore: retire the LaTeX template, measured replica and PNG preview`.
