# Result Editor Screen Implementation Plan (plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Result screen becomes two panes: the user's resume as collapsible, reorderable sections they can edit in place on the left, with every decision (Add it / Skip, rewordings with undo) shown where it lands; the live `ResumePage` preview on the right.

**Architecture:** Two additions to the review state, `edits` and `sectionOrder`, flow through the existing pipeline: whole-line edits become an `edited` line state in `buildLines`; field edits and section order apply in `resolveDocument`. The left pane renders from the same preview `TemplateDocument` the right pane renders, so the two can never disagree; the document's items already carry marks and block ids, and this plan adds the few optional ids the editor needs (entry field blocks, name/contact marks, outline index). Decision cards and the page-fit card are the existing components, placed inline.

**Tech Stack:** Next 15 / React 19 / Tailwind (project tokens) / vitest; Playwright screen check (`npm run check:result`).

**Spec:** `docs/superpowers/specs/2026-10-01-result-editor-design.md` (sections 1, 3, 4; section 2 shipped in plan 1).

## Global Constraints

- Rules: nothing added behind the user's back; Skip and Add it equal weight, nothing pre-selected, no re-asking after Skip; page count never grows without asking; never "Never invents"; English only.
- Edits are the user's own words: never sent to the model, never alter coverage (coverage reflects the plan; a touched requirement row says "You edited this line; tailor again to re-check").
- Edit keys: whole line = block id (`"12"`); entry header field = `"<block>:org|title|dates|place"`. An edit wins over the original and over a rewording of that line; undo removes the key. An empty or whitespace-only edit is not committed. Edits are not applied in Compare with original.
- `sectionOrder` holds outline section indices; Personal information (name, contact) is not a section and never moves; unknown or out-of-range indices are ignored and missing ones appended in document order.
- Marks and copy: highlighter for reworded, edited and added; dashed coral for pending; "Reworded · Undo", "Edited by you · Undo", "Added · Undo"; drafts show the question, the line, "Nothing is added unless you choose Add it", Skip / Add it, "Try another wording", "Why this line?".
- Status copy unchanged from plan 1 ("N to decide · N pages", "checking pages…", "page count unavailable", "(fallback layout)").
- Layout: left pane sections, right pane page; below 1100px the panes stack with sections above the page; nothing hidden at any width.
- Design per `.claude/skills/rezz-design/SKILL.md` (paper and highlighter; Bricolage Grotesque + Geist for UI; no generic-AI patterns); the resume itself stays in the template serif.
- `TemplateDocument` field names unchanged; any new fields optional and ignored by docsvc.
- Deviation from the spec, decided here: Move up / Move down are two icon buttons on the section row (visible on hover and focus, always in the tab order) rather than an overflow menu; one fewer click and simpler for screen readers.
- Every commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Editing a bullet that has a pending draft inserted after it: the draft stays after the edited bullet, and Add it still inserts there. → Task 1 `an edit keeps the inserts that follow the line`.
2. Edit, then Undo on a line that also has an applied rewording: undo returns to the reworded text, and a second undo (on the rewording) returns the original. → Task 1 `undoing an edit restores the rewording, not the original`.
3. A stored `sectionOrder` from a previous tailoring of a different resume (indices out of range): the screen still renders every section once. → Task 1 `ignores unknown section indices and appends missing ones`.
4. Committing an edit identical to the current text, or empty: nothing changes, no mark appears. → Task 2 `commitEdit ignores unchanged and empty text`.
5. Keyboard-only reorder and edit: Move up/down buttons are focusable with accessible names; Enter/Escape in the editor behave as specified. → Task 2 `renders move controls with accessible names`; Task 3 Playwright `edit, undo and reorder with the keyboard`.

---

### Task 1: Edits and section order through the data path

**Files:**
- Modify: `src/lib/tailor/review.ts` (state, actions, persistence)
- Modify: `src/lib/tailor/view.ts` (`LineState` gains `"edited"`; `buildLines` applies edits)
- Modify: `src/lib/tailor/document.ts` (`DocumentOptions` gains `edits`, `sectionOrder`; expose ids)
- Modify: `src/lib/tailor/requirement-rows.ts` (edited-evidence note)
- Modify: `src/lib/session.ts` (`StoredDecisions` gains the two optional fields; it mirrors `Persisted`)
- Test: `review.test.ts`, `view.test.ts`, `document.test.ts`, `requirement-rows.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // review.ts
  export type Edits = Record<string, string>;                    // slot → user text
  ReviewState: + edits: Edits; + sectionOrder: number[];
  ReviewAction: + { type: "edit"; slot: string; text: string }   // ignored when text.trim() === ""
                + { type: "undoEdit"; slot: string }
                + { type: "moveSection"; index: number; to: number } // outline indices; no-op when out of range
  Persisted: + edits?: Edits; + sectionOrder?: number[];           // fromStored defaults {} and []
  // view.ts
  export type LineState = … | "edited";
  export function buildLines(layout, operations, decisions, compareWithOriginal = false, wordings = {}, group = true, edits: Edits = {}): RenderedLine[];
  // an edit on block id B yields the block's line with state "edited", text = edits[B], original = the text it replaced
  // (reworded text when a rewording is applied, else the block text); inserts after B unchanged; compare ignores edits.
  // document.ts
  export type DocumentOptions = { drafts?: boolean; edits?: Edits; sectionOrder?: number[] };
  TemplateEntry: + fields?: { org?: string; title?: string; dates?: string; place?: string }  // block id per present field
  TemplateSection: + outlineIndex?: number   // -1 for the synthetic leading section
  TemplateDocument: + nameMark?: Marks; + contactMarks?: Marks[]   // parallel to contact
  export function orderSections<T>(sections: T[], order: number[] | undefined): T[]; // pure, used by resolveDocument
  // requirement-rows.ts
  export function requirementRows(requirements, matches, operations, editedBlocks: Set<string> = new Set()): RequirementRow[];
  RequirementRow: + editedNote?: string  // "You edited this line; tailor again to re-check" when pointsTo ∩ editedBlocks ≠ ∅
  ```
  Field edits: `resolveDocument` reads `edits[`${ref.block}:${field}`]` for org/title/dates/place; `linesToDocument` has no fields, so only whole-line edits apply there (already via `buildLines`).

- [ ] **Step 1: Write the failing tests.**
  `review.test.ts`: `edit stores the text and undoEdit removes it`; `ignores an empty edit`; `moveSection reorders outline indices and ignores out-of-range`; `persists edits and sectionOrder and defaults them when absent`.
  `view.test.ts`: `an edit replaces the line with state edited and keeps the original`; `an edit wins over an applied rewording`; `undoing an edit restores the rewording, not the original` (build with the edit, then without it: text is the reworded text); `an edit keeps the inserts that follow the line`; `compare with original ignores edits`.
  `document.test.ts`: `applies field edits to org and dates on a split block` (edit `"9:dates"` only; org untouched); `orders sections by sectionOrder and keeps the leading section first`; `ignores unknown section indices and appends missing ones`; `exposes field block ids, outline index, name and contact marks`.
  `requirement-rows.test.ts`: `notes an edited evidence line`.
- [ ] **Step 2: Run** `npx vitest run src/lib/tailor/review.test.ts src/lib/tailor/view.test.ts src/lib/tailor/document.test.ts src/lib/tailor/requirement-rows.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** the four modules and the `session.ts` type.
- [ ] **Step 4: Run** `npx vitest run src/lib/tailor && npm run typecheck` — expected: PASS (ResultScreen compiles because the new parameters default).
- [ ] **Step 5: Commit** — `feat(review): user edits and section order through lines and document`.

---

### Task 2: The sections pane

**Files:**
- Create: `src/lib/tailor/sections.ts` (pure helpers)
- Create: `src/components/result/sections/SectionsPane.tsx`, `SectionRow.tsx`, `EntryCard.tsx`, `LineRow.tsx`, `EditableText.tsx`, `CoverageStrip.tsx`
- Modify: `src/components/result/DecisionCard.tsx` (accept `compact?: boolean` to drop the "N of M" position line when inline; otherwise unchanged)
- Test: `src/lib/tailor/sections.test.ts`, `src/components/result/sections/SectionsPane.test.tsx` (renderToStaticMarkup)

**Interfaces:**
- Consumes: preview `TemplateDocument` (with `drafts: true`, marks, `fields`, `outlineIndex`, `nameMark`, `contactMarks`), `ReviewList` data (`toDecide`, `decided`, `reworded`, `removed`, `pageFit`), `Edits`, `ReviewState.compare`, `DecisionCard`, `PageFitCard`, `SummaryPanel`.
- Produces:
  ```ts
  // sections.ts
  export type SectionCounts = { toDecide: number; reworded: number; edited: number };
  export function sectionCounts(section: TemplateSection): SectionCounts;          // from item/skill marks: pending → toDecide; reworded; edited
  export function countsLabel(c: SectionCounts): string | null;                     // "2 to decide · 1 reworded · 1 edited" or null
  export function sectionName(section: TemplateSection): string;                    // heading text, else a title-cased kind ("Experience"), "Other" last resort
  export function findOpSection(doc: TemplateDocument, opId: string): number | null; // index into doc.sections, or null (personal)
  export function commitEdit(args: { slot: string; current: string; next: string; original: string }): ReviewAction | null;
  // next.trim()==="" or next===current → null; next===original → {type:"undoEdit"}; else {type:"edit", slot, text: next}
  export function moveTargets(order: number[], index: number): { up: number | null; down: number | null };

  // SectionsPane.tsx
  export function SectionsPane(props: {
    document: TemplateDocument;              // the preview document
    list: ReviewListData;                     // for decision cards and page fit
    items: Map<string, ReviewItem>;           // opId → item (toDecide ∪ decided ∪ reworded ∪ removed)
    state: Pick<ReviewState, "compare" | "whyOpen" | "currentOpId" | "edits">;
    coverage: Coverage; rows: RequirementRow[]; selectedRequirement: string | null;
    open: Record<string, boolean>; onToggle: (key: string) => void;   // section open state lives in ResultScreen
    focusKey: string | null;                                           // item key or field slot to focus once
    onEdit: (action: ReviewAction) => void;                            // from commitEdit
    onDecide, onUndo, onNextWording, onWhy, onChoosePageFit, onSelectRequirement, onMoveSection: (index: number, to: number) => void;
  }): JSX.Element;
  ```
  Structure: `CoverageStrip` (one line + "See requirements" toggling `SummaryPanel` rows) → `PageFitCard` when `list.pageFit` → "Personal information" (name, contact as `LineRow`s, not movable) → one `SectionRow` per `document.sections` in order (grip, name, `countsLabel`, chevron; Move up / Move down icon buttons with `aria-label="Move Experience up"`, disabled at the ends, hidden for the leading synthetic section) → open sections render `lead`, entries as `EntryCard` (header fields as labelled `EditableText`s: "Employer", "Title", "Dates", "Location"; then items), `skills` rows (label + items as one editable line), `items`. A pending item renders `DecisionCard compact` for `items.get(opId)`; an `added`/`reworded`/`edited`/`removed` item renders `LineRow` with its mark text and Undo (`onUndo(opId)` or `onEdit({type:"undoEdit", slot})`); unchanged items render `LineRow` editable. `EditableText`: click or Enter opens a textarea pre-filled with the current text; Enter commits, Escape cancels, blur commits; disabled when `state.compare` (with the "Turn off compare to make changes." note once at the top of the pane). Field label: small uppercase Geist, token colours.

- [ ] **Step 1: Write the failing tests.**
  `sections.test.ts`: `counts pending, reworded and edited marks`; `countsLabel joins present counts and is null when none`; `sectionName prefers the heading`; `findOpSection locates a pending draft`; `commitEdit ignores unchanged and empty text`; `commitEdit returns undoEdit when the text equals the original`; `moveTargets at the ends`.
  `SectionsPane.test.tsx` (static markup): `renders personal information first and sections in document order with counts`; `renders a pending draft as a decision card where it lands`; `renders move controls with accessible names`; `marks an edited line "Edited by you"`; `is read-only in compare mode`.
- [ ] **Step 2: Run** `npx vitest run src/lib/tailor/sections.test.ts src/components/result/sections` — expected: FAIL.
- [ ] **Step 3: Implement** helpers and components. Keep each component under ~150 lines; `EditableText` owns its textarea state only.
- [ ] **Step 4: Run** `npx vitest run src/lib/tailor src/components && npm run typecheck` — expected: PASS.
- [ ] **Step 5: Commit** — `feat(result): sections pane with inline decisions and editing`.

---

### Task 3: Two-pane Result screen, preview marks, screen check, docs

**Files:**
- Modify: `src/components/result/ResultScreen.tsx` (layout, state plumbing, open/focus, edits into `buildLines`/documents, section order, delete right list)
- Modify: `src/components/result/ResultHeader.tsx` (no change expected; verify status copy)
- Modify: `src/components/resume/ResumePreview.tsx` (`[data-state="edited"]` highlighter; `onSelect` unchanged)
- Delete: `src/components/result/ReviewList.tsx` (its pieces live in the pane); keep `DecisionCard`, `PageFitCard`, `SummaryPanel`, `WhyThisLine`, `ItemRow` if still imported, else delete
- Modify: `scripts/result-check.mjs` (two-pane selectors; new flows)
- Modify: `docs/03-ux-result-screen.md` (Layout: the two panes as built), `docs/07-open-items.md`
- Test: existing suites; `npm run check:result`

**Interfaces:**
- Consumes: Task 1 state/actions; Task 2 `SectionsPane`, `findOpSection`.
- `ResultScreen` wiring: `lines = buildLines(layout, operations, decisions, compare, wordings, true, compare ? {} : state.edits)`; `documentLines` likewise with `group=false`; `previewDocument = resolveDocument(outline, documentLines, { drafts: true, edits, sectionOrder })` (or `linesToDocument` fallback); `fileDocument` the same without drafts; `editedBlocks = new Set(Object.keys(state.edits).map(k => k.split(":")[0]))` into `requirementRows`; `open` state: `Record<string, boolean>` initialised with every section open whose counts.toDecide > 0, else the first; `onSelect(opId)` from the preview: `findOpSection` → set open, set `focusKey = line-${opId}`, dispatch `open`/`why` as today; Download gate, page-fit, compare, status as in plan 1.
- Layout classes: `grid [grid-template-columns:minmax(0,1fr)_minmax(0,1.25fr)] gap-8` with `max-[1100px]:[grid-template-columns:minmax(0,1fr)]` and the page pane second; left pane sticky/scrollable at ≥1100px as the old summary was.
- `result-check.mjs` flows at 1440/1240/1100/880: open Work experience, edit a bullet (type, Enter) → "Edited by you · Undo" appears and the preview shows the new text; Undo restores; Move Education up → order changes in both panes; Add it on an inline draft → the draft becomes "Added · Undo" and the preview line is highlighted; Skip removes it; Download disabled while "checking pages…"; download reaches /done. Keep the existing page-fit and width checks.

- [ ] **Step 1: Wire the screen** (no new unit tests beyond adjusting any that import `ReviewList`); run `npm run typecheck && npm test`.
- [ ] **Step 2: Extend** `result-check.mjs`; with docsvc and the app running from the worktree on free ports, run `npm run check:result` — expected: all checks ✓ at four widths. Fix what it finds.
- [ ] **Step 3: Update** the two docs. Commit — `feat(result): two-pane editor screen`.
- [ ] **Step 4: Verify by eye** at 1440 and 880: open `/result?demo`, confirm the pane order, marks, a draft card inline, and that the right pane re-renders on edit. Screenshots to `screenshots/` (git-ignored).
