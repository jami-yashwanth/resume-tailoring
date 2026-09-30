# Schema Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace line-only labelling with a read-only, verbatim-verified extraction of the resume into entries, and set that document straight onto the LaTeX template's macros.

**Architecture:** Claude returns an `Outline` of parser block ids (plus verbatim substrings where one line holds two fields); `outline.ts` verifies it against the layout and rejects anything not copied from the file. The pipeline turns the outline into block labels for the existing planner/coverage machinery, and the Result screen resolves it against the user's decisions into a `TemplateDocument` that docsvc renders with `\resumeSubheading{org}{dates}{title}{place}`. Anything without an outline (old sessions, the sample fixture, a rejected answer) keeps today's flat-blocks path.

**Tech Stack:** TypeScript / Next 15 / zod / vitest (web); Python 3 / FastAPI / Pydantic / pytest / Tectonic (docsvc).

**Spec:** `docs/superpowers/specs/2026-09-30-schema-extraction.md`

## Global Constraints

- The model never returns text the code does not verify: every `Ref.text`, skill `label` and `items` must be a verbatim substring of its block's text with whitespace collapsed (tabs → one space), and split parts must cover the block exactly (spec §2).
- Nothing is normalised. Dates, titles, grades, contact details keep the user's spelling and punctuation.
- Every parser block appears exactly once in an accepted outline; a parser `bullet` may only sit in `bullets` or `lines`.
- A rejected answer is retried once; a second rejection or any error keeps the parser's labels (`source: "parser"`) and the flat-blocks render path. No path may produce a blank result.
- Section / entry / line order follows parser block order; the code sorts, the model is not trusted to.
- The owner's `rezz.tex` preamble stays byte-for-byte (its test guards it); new LaTeX only goes into the injected body.
- Model for extraction stays `models().structure` (`ANTHROPIC_STRUCTURE_MODEL`, default `claude-opus-5-5`), `tool_choice: {type: "auto"}` (Opus 5.5 rejects a forced tool), `strict: true` on the tool.
- Copy rules from CLAUDE.md: never "Never invents"; no ATS score.

## Review Focus

1. A role line merged with its dates by the parser ("Google\tJun 2022 – Present") must split into `org` and `dates` with the dates string untouched. → Task 1 `splits a tab-merged role line into org and dates without touching either`.
2. A resume with no section headings at all must still extract (one section, `heading: null`, kind `other`) and render without a `\section`. → Task 1 `accepts a resume with no headings`; Task 5 `test_section_without_heading_sets_no_section_title`.
3. A heading the pipeline renames (headingOps: "WORK HISTORY" → "Experience") must reach the document renamed. → Task 4 `applies a heading rename`.
4. A planner insert after the last skills row must render as a new skills row, never be lost. → Task 4 `an approved insert after a skills row becomes a row`.
5. A result stored before this change (no `outline`) and the `/result` sample fixture must download exactly as today. → Task 6 `sends flat blocks when there is no outline`.

---

### Task 1: Outline types, verification and labels

**Files:**
- Create: `src/lib/tailor/outline.ts`
- Create: `src/lib/tailor/outline.test.ts`
- Modify: `src/lib/tailor/types.ts` (append the outline types)

**Interfaces:**
- Consumes: `Layout`, `Block`, `BlockKind` from `types.ts`; `Label` from `structure.ts`.
- Produces (in `types.ts`):
  ```ts
  export type Ref = { block: string; text: string };
  export type SectionKind = "summary" | "experience" | "education" | "projects" | "skills" | "certifications" | "achievements" | "other";
  export type Entry = { org: Ref | null; title: Ref | null; dates: Ref | null; place: Ref | null; bullets: string[]; lines: string[] };
  export type SkillRow = { block: string; label: string | null; items: string };
  export type Section = { heading: string | null; kind: SectionKind; entries: Entry[]; skills: SkillRow[]; lines: string[] };
  export type Outline = { name: string | null; contact: string[]; sections: Section[] };
  ```
- Produces (in `outline.ts`):
  ```ts
  export const HEADING_MAX = 60;  // move here from structure.ts; structure.ts imports it
  export function collapse(text: string): string;              // tabs/newlines/runs of space → one space, trimmed
  export function coversExactly(blockText: string, parts: string[]): boolean;
  export type OutlineCheck = { ok: true; outline: Outline } | { ok: false; reason: string; missing: string[] };
  export function checkOutline(layout: Layout, outline: Outline): OutlineCheck;
  export function outlineLabels(outline: Outline): Label[];
  ```
  `coversExactly`: lowercase both and strip every non-alphanumeric character (Unicode letters count as alphanumeric: use `/[^\p{L}\p{N}]/gu`); each part must be non-empty after stripping and be found in the block at a position not yet consumed (search left to right, earliest unconsumed match); true only when every character of the block is consumed.
  `checkOutline` returns the *sorted* outline on success: sections by the smallest block index they reference, entries within a section likewise, `bullets`/`lines`/`contact` by block index. Reasons: `"unknown block <id>"`, `"block <id> used twice"`, `"text not in block <id>: <text>"`, `"block <id> not fully covered"`, `"bullet <id> used as a field"`, `"heading <id> too long"`, `"missing blocks"` (with `missing` filled).
  `outlineLabels`: name→`name`, contact→`contact`, heading→`heading`, any block in `org/title/dates/place`→`role`, `bullets`→`bullet`, `lines` and `skills`→`paragraph`.

- [ ] **Step 1: Write the failing tests** in `outline.test.ts`, reusing the `block()`/`layout()` helpers from `structure.test.ts` (copy them; the layout there has the CGPA case). Add a block `"9"` `role` `"Google\tJun 2022 – Present"` under a `"WORK HISTORY"` heading `"10"` and a skills block `"11"` `paragraph` `"Languages: Python, Go"` under heading `"12"` `"SKILLS"`. Tests:

```ts
describe("coversExactly", () => {
  it("splits a tab-merged role line into org and dates without touching either", () =>
    expect(coversExactly("Google\tJun 2022 – Present", ["Google", "Jun 2022 – Present"])).toBe(true));
  it("rejects a part that is not in the line", () =>
    expect(coversExactly("Google\tJun 2022 – Present", ["Google", "Jun 2022 – Now"])).toBe(false));
  it("rejects parts that leave words behind", () =>
    expect(coversExactly("Google, Bengaluru\tJun 2022 – Present", ["Google", "Jun 2022 – Present"])).toBe(false));
  it("ignores separators and case only", () =>
    expect(coversExactly("Languages: Python, Go", ["languages", "Python, Go"])).toBe(true));
});
describe("checkOutline", () => {
  it("accepts a good outline and sorts sections into document order", ...);   // give sections reversed; expect kinds in block order
  it("rejects an invented value", ...);                                          // dates text "2021 – Present" → ok false, reason startsWith "text not in block"
  it("rejects a missing block and names it", ...);                              // leave "8" out → missing ["8"]
  it("rejects a block placed twice", ...);
  it("rejects a parser bullet used as a header field", ...);                    // "8" as org
  it("rejects a heading over 60 characters", ...);
  it("accepts a resume with no headings", ...);                                 // one section heading null kind "other"
});
describe("outlineLabels", () => {
  it("labels header fields role, bullets bullet, skills and lines paragraph", ...);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/tailor/outline.test.ts` — expected: FAIL, module not found.
- [ ] **Step 3: Implement** the types in `types.ts` and the functions in `outline.ts`. Move `HEADING_MAX` out of `structure.ts` and import it there.
- [ ] **Step 4: Run** `npx vitest run src/lib/tailor/outline.test.ts src/lib/tailor/structure.test.ts` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(tailor): outline types with verbatim verification`.

---

### Task 2: Extraction call with one retry

**Files:**
- Create: `src/lib/tailor/extract.ts`
- Create: `src/lib/tailor/extract.test.ts`

**Interfaces:**
- Consumes: `checkOutline`, `outlineLabels` (Task 1); `applyStructure` (`structure.ts`); `models`, `Usage`, `emptyUsage`, `addUsage` (`claude.ts`).
- Produces:
  ```ts
  export type ExtractResult = {
    layout: Layout;            // relabelled via applyStructure when source is "claude"
    outline: Outline | null;   // null when source is "parser"
    usage: Usage;              // summed over both attempts
    source: "claude" | "parser";
    attempts: number;          // 0, 1 or 2
  };
  export async function extractOutline(client: Anthropic, layout: Layout): Promise<ExtractResult>;
  ```
  zod tool schema `OutlineSchema` mirrors the `Outline` type exactly (tool name `extract_outline`, `max_tokens: 16000`, `strict: true`, `tool_choice: {type:"auto"}`, system prompt cached with `cache_control`). User message: one JSON line per block `{ id, text (tabs shown as " ⇥ "), style, parser: kind, section }`, preceded by `Sort every line of this resume with the extract_outline tool.` The retry is a second `messages.create` whose user content appends the assistant's tool call and a tool_result reading: `Your answer was rejected: <reason>. Every line must appear exactly once. Put any line you cannot place under the section it sits in, in that section's "lines". Missing: <ids>.`

  System prompt, exact copy:
  ```
  You sort the lines of a resume into its structure so it can be set in a clean template. You never write text of your own: every value you return is a line's id, or text copied exactly from one line.

  You are given every line with an id, its text, its formatting, the label a parser guessed from formatting alone, and the section the parser thinks it is in.

  Return:
  - name: the id of the candidate's name line, or null.
  - contact: ids of the lines under the name with email, phone, city, links.
  - sections, in document order. Each has a kind (summary, experience, education, projects, skills, certifications, achievements, other), the id of its heading line (null if the resume has no heading there), entries, skills rows, and loose lines.

  An entry is one job, degree, project or certificate. Its header fields are org (employer, school, project or issuer), title (job title, degree, tech stack), dates, and place (city or location). Each field is {block, text}: the id of the line and the exact text of that field copied from it. When one line holds two fields — "Google ⇥ Jun 2022 – Present" — return both fields from the same block with the exact text of each. Use null for a field the resume does not give. bullets are the ids of the points under the entry. lines are the ids of other detail under it: a grade, coursework, a description line.

  A skills row is {block, label, items}: one line of the skills section, with its category label (text before the colon, or null) and its items, both copied exactly.

  Rules:
  - Copy text exactly, including capitals, punctuation, dashes and spelling. Never fix, shorten, expand or reorder anything.
  - Every id appears exactly once across the whole answer. A line you cannot place goes in the lines of the section it sits in.
  - A line the parser marked bullet is a bullet or a line, never a header field.
  - Judge by what a line says and where it sits, not only by capitals or bold. "CGPA: 8.38" in capitals is a grade under a degree, so it is a line of that entry, not a heading.
  ```

- [ ] **Step 1: Write the failing tests** in `extract.test.ts` using the `fakeClient` pattern from `structure.test.ts` (extend it to accept a queue of responses: `vi.fn().mockResolvedValueOnce(a).mockResolvedValueOnce(b)`):
  - `applies a verified outline and relabels the layout` — good outline → `source "claude"`, `attempts 1`, block "5" kind `paragraph`, block "9" kind `role`, `outline.sections[…].entries[0].dates.text === "Jun 2022 – Present"`, `create.mock.calls[0][0].tool_choice` is `{type:"auto"}`.
  - `retries once with the missing ids and accepts the second answer` — first answer omits "8", second is good → `attempts 2`, `source "claude"`, second call's last message content contains `Missing: 8`.
  - `keeps the parser's labels after two rejections` — both bad → `source "parser"`, `outline null`, `layout` deep-equals input, usage summed (`input` 2400 when each response reports 1200).
  - `keeps the parser's labels when Claude declines or the call fails` — refusal, prose, rejected promise.
- [ ] **Step 2: Run** `npx vitest run src/lib/tailor/extract.test.ts` — expected: FAIL, module not found.
- [ ] **Step 3: Implement** `extract.ts` (`structureLayout` in `structure.ts` stays until Task 3 removes it).
- [ ] **Step 4: Run** `npx vitest run src/lib/tailor && npm run typecheck` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(tailor): extract the resume outline with Claude, verbatim-checked`.

---

### Task 3: Carry the outline through the pipeline and the session

**Files:**
- Modify: `src/lib/tailor/pipeline.ts:9,94-102` (import `extractOutline`; `TailorOutcome` gains `outline: Outline | null`; log `structure=<source>/<attempts>` in the stream route's existing `[tailor]` line)
- Modify: `src/lib/tailor/structure.ts` (delete `structureLayout`, `SYSTEM`, `describe`, `Labels`, `schemaFor`, `StructureResult`; keep `applyStructure`, `Label`)
- Modify: `src/lib/tailor/structure.test.ts` (delete the `structureLayout` describe block and `fakeClient`)
- Modify: `src/app/api/tailor/stream/route.ts:57` (`send("done", { layout, plan, outline })`)
- Modify: `src/lib/session.ts:28` (`StoredResult = { layout; plan; outline?: Outline | null }`)
- Modify: `src/components/result/ResultLoader.tsx` (pass `outline={state.outline ?? null}`; fallback sample has none)
- Modify: `src/components/result/ResultScreen.tsx:27-45` (accept `outline?: Outline | null`; unused until Task 6)
- Test: `src/lib/session.test.ts` (one case: a stored result without `outline` reads back with `outline` undefined and is still returned)

**Interfaces:**
- Consumes: `extractOutline` (Task 2).
- Produces: `TailorOutcome.outline`, `StoredResult.outline`, `ResultScreen` prop `outline`.

- [ ] **Step 1: Write the failing test** in `session.test.ts`: `it("reads a result saved before outlines existed")` — `setResult({layout, plan} as StoredResult)` then `getResult()!.outline` is `undefined` and `layout` round-trips.
- [ ] **Step 2: Run** `npx vitest run src/lib/session.test.ts` — expected: FAIL on the type (or PASS at runtime; the type change is the deliverable — `npm run typecheck` must pass after Step 3).
- [ ] **Step 3: Implement** the wiring. In `pipeline.ts` replace `structureLayout(client, parsed)` with `extractOutline(client, parsed)`, keep the `Promise.all` with `extractRequirements`, return `outline: extracted.outline`.
- [ ] **Step 4: Run** `npm run typecheck && npm test` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(tailor): carry the outline to the Result screen`.

---

### Task 4: Resolve the outline against the user's decisions

**Files:**
- Create: `src/lib/tailor/document.ts`
- Create: `src/lib/tailor/document.test.ts`
- Modify: `src/lib/tailor/view.ts:134-139` (`buildLines(layout, operations, decisions, compareWithOriginal = false, wordings = {}, group = true)`; `group === false` skips `groupRoles` on both return paths)

**Interfaces:**
- Consumes: `Outline`, `Ref`, `SkillRow` (Task 1); `RenderedLine` (`view.ts`).
- Produces:
  ```ts
  export type TemplateEntry = { org: string | null; title: string | null; dates: string | null; place: string | null; bullets: string[]; lines: string[] };
  export type TemplateSection = { heading: string | null; kind: SectionKind; entries: TemplateEntry[]; skills: { label: string | null; items: string }[]; lines: string[] };
  export type TemplateDocument = { name: string | null; contact: string[]; sections: TemplateSection[] };
  export function resolveDocument(outline: Outline, lines: RenderedLine[]): TemplateDocument;
  export function splitSkillRow(text: string, label: string | null): { label: string | null; items: string };
  ```
  `lines` must be built with `group = false`. For a whole-block slot (name, contact, heading, bullets, lines, skills) the value is every `RenderedLine` with that `blockId` whose state is not `removed` or `pending`, in order — so a rephrase yields the reworded text, an approved insert appends after its anchor in the same list, a removal drops it. A slot whose block resolves to nothing is dropped (a removed bullet vanishes; a removed heading becomes `null`). Header fields (`org/title/dates/place`) use `ref.text` (never reworded by rule). `splitSkillRow(text, label)`: if `label` and `text` starts with `label` followed by optional spaces and `:` → `{label, items: rest.trim()}`, else `{label: null, items: text}`; an inserted line after a skills row is a row with `label: null`. Texts go through `cleanText(kind, text)` already inside `buildLines`, so `document.ts` does not strip bullets again.

- [ ] **Step 1: Write the failing tests** in `document.test.ts` (build `lines` by hand with the `line()` helper from `download.test.ts`, extended with `blockId`, `kind`, `state`):
  - `fills entry fields from refs and bullets from decided lines` (reworded bullet text appears, original does not).
  - `an approved insert after a bullet lands after it; a pending or skipped one does not`.
  - `a removed bullet vanishes`.
  - `applies a heading rename` (heading block has a `reworded` line "Experience" → `heading === "Experience"`).
  - `an approved insert after a skills row becomes a row` (`{label: null, items: "Kubernetes"}` after `{label: "Languages", items: "Python, Go"}`).
  - `splitSkillRow keeps the label only when the reworded text still starts with it`.
  - in `view.test.ts`: `buildLines with group=false leaves role lines unfolded`.
- [ ] **Step 2: Run** `npx vitest run src/lib/tailor/document.test.ts src/lib/tailor/view.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** `document.ts` and the `group` parameter.
- [ ] **Step 4: Run** `npx vitest run src/lib/tailor` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(tailor): resolve the outline into a template document`.

---

### Task 5: docsvc renders a document onto the template macros

**Files:**
- Modify: `services/docsvc/app/models.py` (append `SkillRowModel`, `EntryModel`, `SectionModel`, `Document` Pydantic models mirroring Task 4's `TemplateDocument`; field names identical)
- Modify: `services/docsvc/app/latex_render.py` (add `document_to_latex(doc: dict) -> str`, `document_to_blocks(doc: dict) -> list[dict]`; split `render_latex` into `render_latex_source(body: str, timeout) -> bytes` used by `render_latex(blocks)` and new `render_latex_document(doc)`)
- Modify: `services/docsvc/app/main.py:121-176` (`RenderTemplateRequest.blocks: list[TemplateBlock] | None = None`, `document: Document | None = None`; 422 when neither; with a document: LaTeX from `render_latex_document`, fallback and images from `document_to_blocks`)
- Test: `services/docsvc/tests/test_latex_render.py`

**Interfaces:**
- Consumes: JSON shape of `TemplateDocument` (Task 4).
- Produces: `POST /render-template` accepting `{document, images?}` with the same response as today.
  `document_to_latex` output, per part (all text through `escape`):
  - header: `\begin{center}` / `\textbf{\Huge NAME} \\` / `\small c1 $|$ c2` (contact strings joined; each contact string further split on `·`, `|`, tab as `blocks_to_latex` does) / `\end{center}`; no name and no contact → nothing.
  - section: `\section{HEADING}` when heading is not null; nothing when null.
  - entries: open `\resumeSubHeadingList` once per section that has entries. Entry with `title` or `place`: `\resumeSubheading{org}{dates}{title}{place}` (null → empty braces). Entry with neither: the existing one-line inline `tabular*` with `org` and `dates`. Then, if the entry has `lines` or `bullets`: nested `\resumeSubHeadingList`, each line `\resumeItem{TEXT}`, each bullet `\resumeItem{\textbullet\ TEXT}` (strip a leading marker with `_BULLET_PREFIX`), `\resumeSubHeadingListEnd`. Close the outer list after the last entry.
  - skills: `\resumeSubHeadingList`, per row `\item \small{\textbf{LABEL}{: ITEMS}}` or `\item \small{ITEMS}` when label is null, `\resumeSubHeadingListEnd`.
  - section lines: plain `TEXT` paragraphs, each on its own line separated by a blank line.
  `document_to_blocks`: name → `name`; each contact → `contact`; heading → `heading`; entry → `role` with text `" · ".join(filter(None,[org, place])) + ("\t"+dates if dates else "")`, then `job_title` = title when present, then `paragraph` per line, `bullet` `"• "+text` per bullet; skill row → `paragraph` `"LABEL: ITEMS"` or `ITEMS`; section lines → `paragraph`.

- [ ] **Step 1: Write the failing tests** (a module-level `DOC` fixture with a name, two contacts, an Experience section with one full entry (two bullets, one line), an Education entry with `title` and no `place`, a Projects entry with only `org` and `dates`, a Skills section with a labelled and an unlabelled row, a Summary section with one loose line, and a section with `heading: None`):
  - `test_document_becomes_the_template_macros` — asserts `\resumeSubheading{Google}{Jun 2022 – Present}{Software Engineer}{Bengaluru}`, `\resumeItem{\textbullet\ Shipped X.}`, `\resumeItem{CGPA: 8.38}`, `\item \small{\textbf{Languages}{: Python, Go}}`, `\item \small{Kubernetes}`, opened lists equal closed lists.
  - `test_entry_with_only_org_and_dates_inlines_the_references_tabular`.
  - `test_section_without_heading_sets_no_section_title` — `\section` count equals number of non-null headings.
  - `test_document_to_blocks_matches_the_flat_shape` — first blocks are `name`, `contact`, `contact`, `heading`, `role` with text `"Google · Bengaluru\tJun 2022 – Present"`, `job_title` `"Software Engineer"`.
  - `test_render_template_endpoint_accepts_a_document` — `TestClient` POST `{document: DOC, images: true}` → 200, `pages >= 1`, `len(images) == pages`; POST `{}` → 422.
  - `test_document_compiles_to_a_readable_pdf` (`@needs_tectonic`) — text of page 1 contains `Software Engineer` and `Python, Go`.
- [ ] **Step 2: Run** `cd services/docsvc && python -m pytest tests/test_latex_render.py -v` — expected: FAIL, import error.
- [ ] **Step 3: Implement** models, renderer functions and the endpoint change.
- [ ] **Step 4: Run** `cd services/docsvc && python -m pytest -q` — expected: PASS (parity tests untouched; preamble test unchanged).
- [ ] **Step 5: Commit** — `feat(docsvc): render a structured document onto the template`.

---

### Task 6: Download and exact preview send the document

**Files:**
- Modify: `src/lib/tailor/docsvc.ts:79-95` (`export type TemplateInput = { blocks: TemplateBlock[] } | { document: TemplateDocument }`; `renderTemplate(input: TemplateInput, options)` spreads `input` into the body)
- Modify: `src/app/api/download/route.ts`, `src/app/api/preview/route.ts` (body may carry `blocks` or `document`; 400 when neither has content; pass through)
- Modify: `src/lib/tailor/download.ts` (add `export function templateInput(lines: RenderedLine[], outline: Outline | null): TemplateInput` — document via `resolveDocument` when `outline`, else `{blocks: downloadBlocks(lines)}`; `downloadResume(lines, filename, company, outline: Outline | null = null)` posts `templateInput(...)`)
- Modify: `src/lib/tailor/preview.ts` (`fetchExactPreview(lines, outline, signal?)` posts `templateInput(...)`)
- Modify: `src/components/result/ExactPreview.tsx` (prop `outline`; `contentKey = JSON.stringify(templateInput(lines, outline))`)
- Modify: `src/components/result/ResultScreen.tsx:74,129-130,233` (build `final` and the preview's lines with `group = false` when `outline` is set — the sheet keeps grouped lines; pass `outline` to `ExactPreview` and `downloadResume`)
- Test: `src/lib/tailor/download.test.ts`, `src/lib/tailor/preview.test.ts`

**Interfaces:**
- Consumes: `resolveDocument`, `TemplateDocument` (Task 4); `Outline` (Task 1).
- Produces: `templateInput`, `TemplateInput`.

- [ ] **Step 1: Write the failing tests**: in `download.test.ts` `sends flat blocks when there is no outline` (`templateInput(lines, null)` deep-equals `{blocks: downloadBlocks(lines)}`) and `sends a document when there is an outline` (`"document" in result`, and its first section's first bullet is the kept line's text); in `preview.test.ts` `posts the document when an outline is given` (mock `fetch`, assert body has a `document` key).
- [ ] **Step 2: Run** `npx vitest run src/lib/tailor/download.test.ts src/lib/tailor/preview.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run** `npm run typecheck && npm test` — expected: PASS. Then with docsvc running (`npm run docsvc`, `npm run dev`), tailor a real PDF end to end and confirm the exact preview shows `org`/`dates` on one line with the title beneath, and the download matches.
- [ ] **Step 5: Commit** — `feat(result): download and preview through the structured document`.

---

### Task 7: Extraction check script and docs

**Files:**
- Create: `scripts/extract-check.ts`
- Modify: `package.json` (devDependency `tsx`; script `"check:extract": "tsx scripts/extract-check.ts"`)
- Modify: `docs/05-architecture.md` (pipeline: "reading_resume" now extracts an outline; describe the verbatim check and fallback in one paragraph, link the spec)
- Modify: `CLAUDE.md` AI section: one line — "The LLM structures the parsed resume into an outline and never returns text the code has not verified against the file (`src/lib/tailor/outline.ts`)."

**Interfaces:**
- Consumes: `docsvc.parseResume`, `extractOutline`, `resolveCredentials`/`createClient` from `src/lib/anthropic.ts`.
- Produces: `npm run check:extract <resume.pdf|docx>` printing `source`, `attempts`, token usage, then the outline as an indented tree (`§ EXPERIENCE (experience)` / `  Google — Software Engineer — Jun 2022 – Present — Bengaluru` / `    • bullet…`) and, on `source: "parser"`, the last rejection reason. Exit code 1 when `source` is `"parser"`, so a corpus run can be scripted.

- [ ] **Step 1: Write the script** (needs `.env` with Claude credentials and docsvc up; no unit test — it is the manual eval harness).
- [ ] **Step 2: Run** `npm run check:extract prototypes/in-place-editing/samples/priya_resume.docx` — expected: exit 0, tree printed with at least one entry carrying `dates`.
- [ ] **Step 3: Update** the two docs.
- [ ] **Step 4: Run** `npm run typecheck` — expected: PASS.
- [ ] **Step 5: Commit** — `chore: extraction check script and docs for outline extraction`.
