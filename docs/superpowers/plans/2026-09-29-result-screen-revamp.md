# Result Screen Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Result screen's job panel, margin marks, popover and bottom decision bar with one review list beside the resume (direction A2), where every decision can be made and undone, at every window width.

**Architecture:** All screen behaviour moves into pure, unit-tested modules in `src/lib/tailor/`:
- a reducer (`review.ts`);
- a selector that builds the review list (`review-list.ts`);
- a selector for the summary rows (`requirement-rows.ts`);
- the download (`download.ts`).

React components become thin views over those modules. `ResultScreen.tsx` shrinks to layout and wiring.

**Tech Stack:** Next.js 15 (App Router, client components), React 19, Tailwind CSS v4, Vitest 5 (node environment, no DOM), Playwright 1.63 for browser checks, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-09-29-result-screen-revamp-design.md`. Read it before starting. Read `.claude/skills/rezz-design/SKILL.md` before any UI task.

## Before you start

The working tree on `feat/result-screen-revamp` carries the owner's own uncommitted changes, including in files this plan edits: `ResultScreen.tsx`, `JobPanel.tsx`, `coverage.ts`, `view.ts` and others. **Do not start Task 1 until the owner has committed or stashed that work.** Otherwise the first `git add` sweeps their changes into a commit of yours. Ask them.

Commands used throughout:
- Unit tests: `npx vitest run <file>` (all: `npm test`)
- Types: `npx tsc --noEmit -p .`
- Lint: `npm run lint`
- App: `npm run dev` (serves on port 3001 by default, see `scripts/ports.mjs`)

Every commit message ends with:
```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Global Constraints

**Decisions and consent:**
- Add it / Skip: exactly two options, identical `secondary` buttons, equal width, nothing pre-selected. No "Add all".
- Never re-ask after a Skip on the app's own initiative. Only the user's Undo returns a line to undecided.
- The page count never grows without asking. The page-fit card is visible at every width.

**Copy:**
- No 0–100 score anywhere. Counts only: "Covers X of N".
- The phrase "Never invents" must not appear.
- Plain English, second person, sentence case. No exclamation marks, no emoji.
- Buttons name their skill for screen readers: "Skip {skill} line", "Add {skill} line to my resume".

**Styling:**
- The drawn-ink skin (`box`, `offset` from `src/components/rezz/skin.ts`, and the `Button` component) is used only in the header and on things you press.
- Cards, the review list and the summary use `border border-line` hairlines and `rounded-lg`.
- The resume keeps `shadow-sheet`.
- `highlighter` is only ever the background behind changed text, and the primary button's offset.
- Colour is never the only signal: every status carries an icon plus a word.

**Accessibility:**
- 44px minimum tap targets (`min-h-11`).
- One polite live region, announcing each decision once.
- Focus moves to the next decision card after each decision.

**Scope:**
- Web only. Narrow desktop windows (≥ 880px) must work; mobile is out of scope.
- `/api/download`, `template_render.py`, the planner and the pipeline are not changed.

## Review Focus

1. **A 2-page resume with no decisions shows a page-fit card on load.** Today the first page count is reported before the webfont lands, so `pagesAllowed` can lock at 1 while the document is 2 pages. Fixed in Task 7 (count reported only after fonts are ready) and pinned by the "asks nothing" check in Task 8.
2. **An old saved session** (no `removedFor`, possibly `growthAllowed: true`) must load without throwing, and without losing decisions. Pinned in Task 3.
3. **A double-click or held Enter on Add it must answer one question, not two.** Re-keying the buttons is not enough: the second click lands on the *new* card's button under the cursor. So `DecisionCard` ignores presses in the first 350ms after a new card appears (Task 6), and the double-click check in Task 8 pins it.
4. **Undoing an Add whose page-fit removal the user chose** brings the removed line back. **"Keep it" on a removal alone** does not touch other decisions. Pinned in Task 3.
5. **A requirement answered by two drafted lines, one skipped and one still open,** must stay "to decide" and point at the open one. Pinned in Task 2.

---

## File map

| File | Status | Responsibility |
| --- | --- | --- |
| `src/lib/tailor/view.ts` | modify | adds `stripBullet`, `cleanText`; `buildLines` strips bullet glyphs |
| `src/lib/tailor/text.ts` | create | `shorten()` (moved from `planner.ts` so client code can import it without the SDK) |
| `src/lib/tailor/planner.ts` | modify | imports and re-exports `shorten` from `text.ts` |
| `src/lib/tailor/requirement-rows.ts` | create | `requirementRows()`: summary rows, what each points at, why |
| `src/lib/tailor/review.ts` | create | `ReviewState`, `ReviewAction`, `createReviewReducer`, `fromStored`, `toStored` |
| `src/lib/session.ts` | modify | `StoredDecisions.removedFor?` |
| `src/lib/tailor/review-list.ts` | create | `reviewList()`, `pageFitOptions()`, `withDecisions()`, announcements |
| `src/lib/tailor/download.ts` | create | `downloadBlocks`, `downloadName`, `safeName`, `downloadResume` |
| `src/components/rezz/Button.tsx` | modify | adds `size="sm"` |
| `src/components/result/WhyThisLine.tsx` | create | expandable reason and sources, plus `TextAction` |
| `src/components/result/DecisionCard.tsx` | create | the current decision |
| `src/components/result/ItemRow.tsx` | create | decided, reworded and removed rows with Undo |
| `src/components/result/PageFitCard.tsx` | create | "That line makes it 2 pages." |
| `src/components/result/ReviewList.tsx` | create | the right column |
| `src/components/result/SummaryPanel.tsx` | create | the left column / narrow strip |
| `src/components/result/ResultHeader.tsx` | create | the one chrome bar |
| `src/components/result/DefaultTemplateSheet.tsx` | modify | `className` prop, ink outline, page count only after fonts |
| `src/components/result/ResultScreen.tsx` | rewrite | layout and wiring only |
| `src/components/result/{DecisionBar,ResultMargin,ChangePopover,PageFitPrompt,JobPanel}.tsx` | delete | replaced |
| `src/lib/tailor/coverage.ts` (+ test) | modify | delete `displayStatus` / `DisplayStatus` (only `JobPanel` used them) |
| `scripts/result-check.mjs` | create | Playwright flow check at 4 widths |
| `scripts/screenshots.mjs` | modify | toggle's new name |
| `package.json` | modify | `check:result` script |
| `docs/03-ux-result-screen.md` | modify | layout section matches the new screen |

---

### Task 1: Strip bullet glyphs in the preview

The renderer (`services/docsvc/app/template_render.py`, line ~200) already does `text.lstrip("•◦▪‣·-*" + " ").strip()` for bullets. The preview doesn't, so a bullet whose text starts with "•" shows "• •". Make the preview strip exactly what the renderer strips.

**Files:**
- Modify: `src/lib/tailor/view.ts`
- Test: `src/lib/tailor/view.test.ts`

**Interfaces:**
- Produces:
  - `stripBullet(text: string): string`
  - `cleanText(kind: BlockKind, text: string): string`, which strips only when `kind === "bullet"`.
  - `buildLines` now returns stripped `text` / `original` for bullet lines.

- [ ] **Step 1: Write the failing tests.** Append to `src/lib/tailor/view.test.ts`, and add `cleanText, stripBullet` to the existing import from `./view`:

```ts
describe("stripBullet", () => {
  it("drops a leading bullet glyph the way the renderer does", () => {
    expect(stripBullet("• Worked on APIs")).toBe("Worked on APIs");
    expect(stripBullet("•  ▪ Did two things")).toBe("Did two things");
    expect(stripBullet("Plain line")).toBe("Plain line");
  });

  it("strips only bullets, never paragraphs", () => {
    expect(cleanText("bullet", "- Led a team")).toBe("Led a team");
    expect(cleanText("paragraph", "- not a bullet")).toBe("- not a bullet");
  });
});

describe("buildLines bullet text", () => {
  const bulleted: Layout = {
    ...layout,
    blocks: layout.blocks.map((b) => (b.id === "b6" ? { ...b, text: "• Worked on backend APIs for payments." } : b)),
  };

  it("shows a bullet once, not twice", () => {
    const line = buildLines(bulleted, [], {}).find((l) => l.blockId === "b6");
    expect(line?.text).toBe("Worked on backend APIs for payments.");
  });

  it("strips a rewording that arrives with its own glyph", () => {
    const lines = buildLines(bulleted, [op({ text: "• Designed REST APIs." })], {});
    const line = lines.find((l) => l.blockId === "b6");
    expect(line?.text).toBe("Designed REST APIs.");
    expect(line?.original).toBe("Worked on backend APIs for payments.");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npx vitest run src/lib/tailor/view.test.ts`
Expected: FAIL, with `stripBullet is not a function` (or an import error).

- [ ] **Step 3: Implement.** In `src/lib/tailor/view.ts`, add this below `inheritRun`:

```ts
/**
 * The renderer's own bullet set (`BULLET_CHARS` in template_render.py), so the
 * preview strips exactly what the PDF strips. A resume whose bullets carry a
 * typed "•" otherwise shows two: the text's and the list's.
 */
const BULLET_CHARS = "•◦▪‣·-*";

export function stripBullet(text: string): string {
  let start = 0;
  while (start < text.length && (BULLET_CHARS.includes(text[start]) || text[start] === " ")) {
    start += 1;
  }
  return text.slice(start).trim();
}

/** Bullet text without its glyph; every other kind untouched. */
export function cleanText(kind: BlockKind, text: string): string {
  return kind === "bullet" ? stripBullet(text) : text;
}
```

Then, inside `buildLines`, make these four changes:
- in `base`, `text: block.text,` becomes `text: cleanText(block.kind, block.text),`
- in the rephrase branch, `const text = wordingFor(rephrase, wordings);` becomes `const text = cleanText(block.kind, wordingFor(rephrase, wordings));`
- in the rephrase branch, `original: block.text,` becomes `original: cleanText(block.kind, block.text),`
- in the insert loop, `const text = wordingFor(insert, wordings);` becomes `const text = cleanText(block.kind, wordingFor(insert, wordings));`

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npx vitest run src/lib/tailor/view.test.ts`
Expected: PASS, all tests including the pre-existing ones.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/tailor/view.ts src/lib/tailor/view.test.ts
git commit -m "Strip typed bullet glyphs in the preview, as the renderer does

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Summary rows that always point somewhere or say why

This replaces `displayStatus` for the left column. Every row either names the lines it points at, or carries a one-line reason. This fixes "Needs your OK with nothing to decide" and the unexplained clickable/non-clickable rows.

**Files:**
- Create: `src/lib/tailor/text.ts`
- Modify: `src/lib/tailor/planner.ts`
- Create: `src/lib/tailor/requirement-rows.ts`
- Test: `src/lib/tailor/requirement-rows.test.ts`

Note: `src/lib/tailor/requirements.ts` already exists and is the job-posting extractor. Do not confuse it with this new file.

**Interfaces:**
- Consumes: `Requirement`, `Match`, `PlannedOp` from `./types` (`PlannedOp.approved?: boolean` carries the decision).
- Produces:

```ts
export type RequirementGroup = "to_decide" | "covered" | "skipped" | "not_offered" | "cannot_change";
export type RequirementRow = {
  requirement: Requirement;
  group: RequirementGroup;
  /** Covered because the user added a line, not because they already had it. */
  added: boolean;
  /** Block ids to light up, or null when there is nothing to point at. */
  pointsTo: string[] | null;
  /** Shown under the label when there is nothing to point at, or for a knockout. */
  reason: string | null;
  /** The undecided drafted line to open, for "to_decide" rows. */
  opId: string | null;
};
export function requirementRows(requirements: Requirement[], matches: Match[], operations: PlannedOp[]): RequirementRow[];
```
- Also: `shorten(note: string | undefined, limit?: number): string | undefined` exported from `./text`.

- [ ] **Step 1: Move `shorten` out of the planner.** Create `src/lib/tailor/text.ts` and move the whole `shorten` function into it, doc comment included. It's currently at `src/lib/tailor/planner.ts` around lines 170–187.

```ts
/**
 * Keep a note to one sentence.
 *
 * The left panel gives each requirement two lines. A model that writes four
 * sentences of reasoning is not wrong, just in the wrong place, so the caption
 * is cut rather than the plan rejected.
 */
export function shorten(note: string | undefined, limit = 90): string | undefined {
  if (!note) return undefined;
  const first = note.trim().split(/(?<=[.!?])\s+/)[0] ?? note.trim();
  if (first.length <= limit) return first;
  const cut = first.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  // Always break on a word. A mid-word cut reads as a rendering bug, which is
  // the last impression this product can afford to give.
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
```

In `planner.ts`:
- delete that function;
- add `import { shorten } from "./text";` with the other imports;
- add `export { shorten };` just below the imports, so `planner.test.ts` keeps working. Client code must import from `./text` instead, because `planner.ts` pulls in the Anthropic SDK.

Run: `npx vitest run src/lib/tailor/planner.test.ts`
Expected: PASS.

- [ ] **Step 2: Write the failing tests.** Create `src/lib/tailor/requirement-rows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { requirementRows } from "./requirement-rows";
import type { Match, PlannedOp, Requirement } from "./types";

const req = (id: string, label: string, knockout = false): Requirement => ({
  id, label, wording: `${label}, please`, kind: "skill", importance: "must", knockout,
});

const draft = (id: string, requirement: string, block: string, approved?: boolean): PlannedOp => ({
  id, op: "insert_after", block, text: `Worked with ${requirement}.`, alternatives: [],
  claim: "added_by_user", value: 5, requirements: [requirement], evidence: [],
  needsDecision: true, approved,
});

const rephrase = (id: string, requirement: string, block: string): PlannedOp => ({
  id, op: "rephrase", block, text: "Reworded.", alternatives: [], claim: "reworded",
  value: 5, requirements: [requirement], evidence: [block], needsDecision: false,
});

const rowFor = (id: string, rows: ReturnType<typeof requirementRows>) =>
  rows.find((r) => r.requirement.id === id)!;

describe("requirementRows", () => {
  it("never makes a knockout clickable, and says why", () => {
    const rows = requirementRows(
      [req("r9", "Pune location", true)],
      [{ requirementId: "r9", status: "cannot_change", evidence: ["b1"], note: "You're in Bengaluru. We never change this." }],
      [],
    );
    expect(rowFor("r9", rows)).toMatchObject({
      group: "cannot_change", pointsTo: null, reason: "You're in Bengaluru. We never change this.",
    });
  });

  it("gives a knockout with no note a default reason", () => {
    const rows = requirementRows([req("r9", "Pune location", true)], [], []);
    expect(rowFor("r9", rows).reason).toBe("Shown as it is. We never change this.");
  });

  it("points a matched requirement at its evidence and its rewordings", () => {
    const rows = requirementRows(
      [req("r5", "REST APIs")],
      [{ requirementId: "r5", status: "matched", evidence: ["b6", "b11"] }],
      [rephrase("o4", "r5", "b6")],
    );
    expect(rowFor("r5", rows)).toMatchObject({ group: "covered", added: false, pointsTo: ["b6", "b11"], reason: null });
  });

  it("explains a match with nothing to point at instead of making a dead button", () => {
    const rows = requirementRows([req("r2", "Spring Boot")], [{ requirementId: "r2", status: "matched", evidence: [] }], []);
    expect(rowFor("r2", rows)).toMatchObject({ group: "covered", pointsTo: null, reason: "Already in your resume." });
  });

  it("puts an undecided drafted line in to_decide, pointing at it", () => {
    const kafka: Match = { requirementId: "r3", status: "needs_ok", evidence: [] };
    const rows = requirementRows([req("r3", "Apache Kafka")], [kafka], [draft("o1", "r3", "b7")]);
    expect(rowFor("r3", rows)).toMatchObject({ group: "to_decide", pointsTo: ["b7"], opId: "o1", reason: null });
  });

  it("counts an added line as covered by you", () => {
    const rows = requirementRows([req("r3", "Apache Kafka")], [], [draft("o1", "r3", "b7", true)]);
    expect(rowFor("r3", rows)).toMatchObject({ group: "covered", added: true, pointsTo: ["b7"] });
  });

  it("files a skipped line as skipped, not as still owed", () => {
    const rows = requirementRows([req("r3", "Apache Kafka")], [], [draft("o1", "r3", "b7", false)]);
    expect(rowFor("r3", rows)).toMatchObject({ group: "skipped", pointsTo: null, reason: "You skipped this line." });
  });

  it("keeps asking while one of two drafted lines is still open", () => {
    const rows = requirementRows(
      [req("r3", "Apache Kafka")],
      [],
      [draft("o1", "r3", "b7", false), draft("o2", "r3", "b8")],
    );
    expect(rowFor("r3", rows)).toMatchObject({ group: "to_decide", pointsTo: ["b8"], opId: "o2" });
  });

  it("never lists a gap with no drafted line as needing your OK", () => {
    const rows = requirementRows(
      [req("r6", "Microservices")],
      [{ requirementId: "r6", status: "needs_ok", evidence: [], note: "We've drafted a line for you to review." }],
      [],
    );
    expect(rowFor("r6", rows)).toMatchObject({
      group: "not_offered", pointsTo: null, reason: "Not in your resume, no line to offer.",
    });
  });

  it("cuts a long knockout note to one short line", () => {
    const long = "You're based in Bengaluru and this role is on-site in Pune five days a week, which we will never change for you. More text.";
    const rows = requirementRows(
      [req("r9", "Pune", true)],
      [{ requirementId: "r9", status: "cannot_change", evidence: [], note: long }],
      [],
    );
    expect(rowFor("r9", rows).reason!.length).toBeLessThanOrEqual(91);
    expect(rowFor("r9", rows).reason!.endsWith("…")).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail.**

Run: `npx vitest run src/lib/tailor/requirement-rows.test.ts`
Expected: FAIL, with "Failed to resolve import ./requirement-rows".

- [ ] **Step 4: Implement.** Create `src/lib/tailor/requirement-rows.ts`:

```ts
import { shorten } from "./text";
import type { Match, PlannedOp, Requirement } from "./types";

/**
 * What the summary column shows for each requirement, given the decisions so far.
 *
 * Every row either points at lines in the resume or says, in one short line,
 * why it cannot. The old panel made some rows buttons and some not with nothing
 * to tell them apart, and listed "Needs your OK" for requirements with no
 * drafted line behind them — a question the screen had no way to ask.
 */

export type RequirementGroup = "to_decide" | "covered" | "skipped" | "not_offered" | "cannot_change";

export type RequirementRow = {
  requirement: Requirement;
  group: RequirementGroup;
  /** Covered because the user added a line, not because they already had it. */
  added: boolean;
  /** Block ids to light up, or null when there is nothing to point at. */
  pointsTo: string[] | null;
  /** Shown under the label when there is nothing to point at, or for a knockout. */
  reason: string | null;
  /** The undecided drafted line to open, for "to_decide" rows. */
  opId: string | null;
};

export function requirementRows(
  requirements: Requirement[],
  matches: Match[],
  operations: PlannedOp[],
): RequirementRow[] {
  return requirements.map((requirement) => {
    const match = matches.find((m) => m.requirementId === requirement.id);
    const touching = operations.filter((op) => op.requirements.includes(requirement.id));
    const answering = touching.filter((op) => op.needsDecision);

    const row = (
      group: RequirementGroup,
      blocks: string[],
      reason: string | null,
      extra: Partial<Pick<RequirementRow, "added" | "opId">> = {},
    ): RequirementRow => ({
      requirement,
      group,
      added: extra.added ?? false,
      pointsTo: blocks.length ? [...new Set(blocks)] : null,
      reason,
      opId: extra.opId ?? null,
    });

    // A knockout is shown, never changed, and never a control.
    if (requirement.knockout || match?.status === "cannot_change") {
      return row("cannot_change", [], shorten(match?.note) ?? "Shown as it is. We never change this.");
    }

    if (match?.status === "matched") {
      const blocks = [
        ...match.evidence,
        ...touching.filter((op) => !op.needsDecision).map((op) => op.block),
      ];
      return row("covered", blocks, blocks.length ? null : "Already in your resume.");
    }

    const approved = answering.filter((op) => op.approved === true);
    if (approved.length) return row("covered", approved.map((op) => op.block), null, { added: true });

    const open = answering.filter((op) => op.approved === undefined);
    if (open.length) return row("to_decide", open.map((op) => op.block), null, { opId: open[0].id });

    if (answering.length) return row("skipped", [], "You skipped this line.");

    return row("not_offered", [], "Not in your resume, no line to offer.");
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `npx vitest run src/lib/tailor/requirement-rows.test.ts src/lib/tailor/planner.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/tailor/text.ts src/lib/tailor/planner.ts src/lib/tailor/requirement-rows.ts src/lib/tailor/requirement-rows.test.ts
git commit -m "Add summary rows that always point at a line or say why not

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The review reducer

Everything the user can do on the screen, as one pure reducer. The key new behaviours:
- Undo on any decision.
- Linked undo: undoing an Add restores the lines removed to make room for it.
- "Allow N pages" raises the allowance to the current count, so a *further* growth asks again.

**Files:**
- Create: `src/lib/tailor/review.ts`
- Modify: `src/lib/session.ts` (`StoredDecisions`)
- Test: `src/lib/tailor/review.test.ts`

**Interfaces:**
- Consumes: `PlannedOp` (`./types`); `Decisions`, `Wordings` (`./view`).
- Produces:

```ts
export type ReviewState = {
  decisions: Decisions;
  wordings: Wordings;
  pagesAllowed: number | null;
  growthAllowed: boolean;
  removedFor: Record<string, string[]>;
  currentOpId: string | null;
  whyOpen: boolean;
  selectedRequirement: string | null;
  compare: boolean;
  pages: number;
};
export type ReviewAction =
  | { type: "decide"; opId: string; approved: boolean }
  | { type: "undo"; opId: string }
  | { type: "nextWording"; opId: string }
  | { type: "open"; opId: string | null }
  | { type: "why"; opId: string }
  | { type: "selectRequirement"; requirementId: string; opId: string | null }
  | { type: "choosePageFit"; optionId: string; causedBy: string | null }
  | { type: "toggleCompare" }
  | { type: "measuredPages"; pages: number };
export type Persisted = { decisions: Decisions; wordings: Wordings; pagesAllowed: number | null; growthAllowed: boolean; removedFor?: Record<string, string[]> };
export function createReviewReducer(operations: PlannedOp[]): (state: ReviewState, action: ReviewAction) => ReviewState;
export function fromStored(stored: Persisted | null): ReviewState;
export function toStored(state: ReviewState): Persisted;
```
- Page-fit option ids (produced by Task 4, consumed here): `"remove:<opId>"`, `"shorter:<opId>:<wordingIndex>"`, `"grow"`.

- [ ] **Step 1: Write the failing tests.** Create `src/lib/tailor/review.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { type ReviewState, createReviewReducer, fromStored, toStored } from "./review";
import type { PlannedOp } from "./types";

const base: Omit<PlannedOp, "id" | "op" | "block"> = {
  text: "Text.", alternatives: [], claim: "reworded", value: 5, requirements: [], evidence: [], needsDecision: false,
};
const ops: PlannedOp[] = [
  { ...base, id: "ins1", op: "insert_after", block: "b7", claim: "added_by_user", needsDecision: true, requirements: ["r3"] },
  { ...base, id: "ins2", op: "insert_after", block: "b8", claim: "added_by_user", needsDecision: true, requirements: ["r6"] },
  { ...base, id: "reph", op: "rephrase", block: "b6", evidence: ["b6"] },
  { ...base, id: "rem", op: "remove", block: "b13", text: undefined, value: 1 },
  { ...base, id: "rem2", op: "remove", block: "b14", text: undefined, value: 2 },
];
const reduce = createReviewReducer(ops);
const start = (over: Partial<ReviewState> = {}): ReviewState => ({ ...fromStored(null), ...over });

describe("decide", () => {
  it("records the answer and lets the list pick the next card", () => {
    const next = reduce(start({ currentOpId: "ins1", whyOpen: true }), { type: "decide", opId: "ins1", approved: true });
    expect(next.decisions.ins1).toBe(true);
    expect(next.currentOpId).toBeNull();
    expect(next.whyOpen).toBe(false);
  });
});

describe("undo", () => {
  it("puts an added line back to undecided and opens it", () => {
    const next = reduce(start({ decisions: { ins1: true } }), { type: "undo", opId: "ins1" });
    expect(next.decisions.ins1).toBeUndefined();
    expect(next.currentOpId).toBe("ins1");
  });

  it("puts a skipped line back to undecided", () => {
    const next = reduce(start({ decisions: { ins1: false } }), { type: "undo", opId: "ins1" });
    expect(next.decisions.ins1).toBeUndefined();
  });

  it("toggles a rewording between the user's words and the rewording", () => {
    const undone = reduce(start(), { type: "undo", opId: "reph" });
    expect(undone.decisions.reph).toBe(false);
    const redone = reduce(undone, { type: "undo", opId: "reph" });
    expect(redone.decisions.reph).toBeUndefined();
  });

  it("brings back the lines removed to make room for an Add that is undone", () => {
    let state = start({ decisions: { ins1: true }, pages: 2, pagesAllowed: 1 });
    state = reduce(state, { type: "choosePageFit", optionId: "remove:rem", causedBy: "ins1" });
    expect(state.decisions.rem).toBe(true);
    expect(state.removedFor).toEqual({ ins1: ["rem"] });

    state = reduce(state, { type: "undo", opId: "ins1" });
    expect(state.decisions.ins1).toBeUndefined();
    expect(state.decisions.rem).toBeUndefined();
    expect(state.removedFor).toEqual({});
  });

  it("keeps one removed line without touching anything else", () => {
    const state = start({
      decisions: { ins1: true, rem: true, rem2: true },
      removedFor: { ins1: ["rem", "rem2"] },
    });
    const next = reduce(state, { type: "undo", opId: "rem" });
    expect(next.decisions).toEqual({ ins1: true, rem: undefined, rem2: true });
    expect(next.removedFor).toEqual({ ins1: ["rem2"] });
  });

  it("ignores an id it does not know", () => {
    const state = start();
    expect(reduce(state, { type: "undo", opId: "nope" })).toBe(state);
  });
});

describe("page fit", () => {
  it("uses the chosen shorter wording", () => {
    const next = reduce(start(), { type: "choosePageFit", optionId: "shorter:ins1:2", causedBy: "ins1" });
    expect(next.wordings.ins1).toBe(2);
  });

  it("raises the allowance to the current length, so further growth asks again", () => {
    const next = reduce(start({ pages: 2, pagesAllowed: 1 }), { type: "choosePageFit", optionId: "grow", causedBy: null });
    expect(next.pagesAllowed).toBe(2);
    expect(next.growthAllowed).toBe(true);
  });

  it("records a removal with no known cause without linking it", () => {
    const next = reduce(start(), { type: "choosePageFit", optionId: "remove:rem", causedBy: null });
    expect(next.decisions.rem).toBe(true);
    expect(next.removedFor).toEqual({});
  });
});

describe("measuredPages", () => {
  it("takes the first measurement as the allowance and never lowers or raises it after", () => {
    let state = reduce(start(), { type: "measuredPages", pages: 2 });
    expect(state).toMatchObject({ pages: 2, pagesAllowed: 2 });
    state = reduce(state, { type: "measuredPages", pages: 3 });
    expect(state).toMatchObject({ pages: 3, pagesAllowed: 2 });
  });
});

describe("open, why, select, compare, wording", () => {
  it("opens a card with its explanation closed", () => {
    expect(reduce(start({ whyOpen: true }), { type: "open", opId: "ins2" })).toMatchObject({ currentOpId: "ins2", whyOpen: false });
  });

  it("toggles why for the same line and opens it fresh for another", () => {
    const once = reduce(start(), { type: "why", opId: "reph" });
    expect(once).toMatchObject({ currentOpId: "reph", whyOpen: true });
    expect(reduce(once, { type: "why", opId: "reph" }).whyOpen).toBe(false);
    expect(reduce(once, { type: "why", opId: "ins1" })).toMatchObject({ currentOpId: "ins1", whyOpen: true });
  });

  it("selects a requirement, opens its line, and deselects on a second click", () => {
    const picked = reduce(start(), { type: "selectRequirement", requirementId: "r3", opId: "ins1" });
    expect(picked).toMatchObject({ selectedRequirement: "r3", currentOpId: "ins1" });
    expect(reduce(picked, { type: "selectRequirement", requirementId: "r3", opId: "ins1" }).selectedRequirement).toBeNull();
  });

  it("flips compare and closes any explanation", () => {
    expect(reduce(start({ whyOpen: true }), { type: "toggleCompare" })).toMatchObject({ compare: true, whyOpen: false });
  });

  it("steps to the next wording", () => {
    const once = reduce(start(), { type: "nextWording", opId: "ins1" });
    expect(reduce(once, { type: "nextWording", opId: "ins1" }).wordings.ins1).toBe(2);
  });
});

describe("storage", () => {
  it("loads a session saved before removedFor existed", () => {
    const state = fromStored({ decisions: { ins1: true }, wordings: { ins1: 1 }, pagesAllowed: 1, growthAllowed: true });
    expect(state).toMatchObject({ decisions: { ins1: true }, wordings: { ins1: 1 }, pagesAllowed: 1, growthAllowed: true, removedFor: {} });
  });

  it("starts empty with nothing stored", () => {
    expect(fromStored(null)).toMatchObject({ decisions: {}, pagesAllowed: null, compare: false, currentOpId: null });
  });

  it("stores only what should survive a refresh", () => {
    const stored = toStored(start({ decisions: { ins1: true }, currentOpId: "ins2", compare: true }));
    expect(Object.keys(stored).sort()).toEqual(["decisions", "growthAllowed", "pagesAllowed", "removedFor", "wordings"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npx vitest run src/lib/tailor/review.test.ts`
Expected: FAIL, with "Failed to resolve import ./review".

- [ ] **Step 3: Implement.** Create `src/lib/tailor/review.ts`:

```ts
import type { PlannedOp } from "./types";
import type { Decisions, Wordings } from "./view";

/**
 * Everything the user can do on the Result screen, as one pure reducer.
 *
 * It used to be eleven `useState`s in the component, which is how an Add came
 * to have no Undo and a removal made to fit an Add outlived the Add. Every
 * change the user can make is one action here, tested without a browser.
 */

export type ReviewState = {
  decisions: Decisions;
  wordings: Wordings;
  /** The length the user has agreed to. Set from the first measurement. */
  pagesAllowed: number | null;
  /** The user has allowed the document to grow at least once. */
  growthAllowed: boolean;
  /** Lines removed to make room for an insert, keyed by that insert's id —
   *  so undoing the Add brings back what it pushed out. */
  removedFor: Record<string, string[]>;
  /** The card the user opened; null lets the list pick the first pending one. */
  currentOpId: string | null;
  /** Whether "Why this line?" is expanded for `currentOpId`. */
  whyOpen: boolean;
  selectedRequirement: string | null;
  compare: boolean;
  /** Pages the preview last measured. */
  pages: number;
};

export type ReviewAction =
  | { type: "decide"; opId: string; approved: boolean }
  | { type: "undo"; opId: string }
  | { type: "nextWording"; opId: string }
  | { type: "open"; opId: string | null }
  | { type: "why"; opId: string }
  | { type: "selectRequirement"; requirementId: string; opId: string | null }
  | { type: "choosePageFit"; optionId: string; causedBy: string | null }
  | { type: "toggleCompare" }
  | { type: "measuredPages"; pages: number };

/** What survives a refresh. `removedFor` is optional so older sessions load. */
export type Persisted = {
  decisions: Decisions;
  wordings: Wordings;
  pagesAllowed: number | null;
  growthAllowed: boolean;
  removedFor?: Record<string, string[]>;
};

export function fromStored(stored: Persisted | null): ReviewState {
  return {
    decisions: stored?.decisions ?? {},
    wordings: stored?.wordings ?? {},
    pagesAllowed: stored?.pagesAllowed ?? null,
    growthAllowed: stored?.growthAllowed ?? false,
    removedFor: stored?.removedFor ?? {},
    currentOpId: null,
    whyOpen: false,
    selectedRequirement: null,
    compare: false,
    pages: 1,
  };
}

export function toStored(state: ReviewState): Persisted {
  return {
    decisions: state.decisions,
    wordings: state.wordings,
    pagesAllowed: state.pagesAllowed,
    growthAllowed: state.growthAllowed,
    removedFor: state.removedFor,
  };
}

export function createReviewReducer(operations: PlannedOp[]) {
  const byId = new Map(operations.map((op) => [op.id, op]));

  return function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
    switch (action.type) {
      case "decide":
        return {
          ...state,
          decisions: { ...state.decisions, [action.opId]: action.approved },
          currentOpId: null,
          whyOpen: false,
        };
      case "undo":
        return undo(state, byId.get(action.opId));
      case "nextWording":
        return {
          ...state,
          wordings: { ...state.wordings, [action.opId]: (state.wordings[action.opId] ?? 0) + 1 },
        };
      case "open":
        return { ...state, currentOpId: action.opId, whyOpen: false };
      case "why": {
        const same = state.currentOpId === action.opId;
        return { ...state, currentOpId: action.opId, whyOpen: same ? !state.whyOpen : true };
      }
      case "selectRequirement": {
        const same = state.selectedRequirement === action.requirementId;
        return {
          ...state,
          selectedRequirement: same ? null : action.requirementId,
          currentOpId: !same && action.opId ? action.opId : state.currentOpId,
          whyOpen: false,
        };
      }
      case "choosePageFit":
        return choosePageFit(state, action.optionId, action.causedBy);
      case "toggleCompare":
        return { ...state, compare: !state.compare, whyOpen: false };
      case "measuredPages":
        return { ...state, pages: action.pages, pagesAllowed: state.pagesAllowed ?? action.pages };
    }
  };
}

function undo(state: ReviewState, op: PlannedOp | undefined): ReviewState {
  if (!op) return state;
  const decisions = { ...state.decisions };

  if (op.op === "rephrase") {
    // Undo shows the user's own words; undoing that takes the rewording again.
    decisions[op.id] = decisions[op.id] === false ? undefined : false;
    return { ...state, decisions };
  }

  if (op.op === "remove") {
    // "Keep it": the line stays, and no insert is owed it any more.
    decisions[op.id] = undefined;
    const removedFor: Record<string, string[]> = {};
    for (const [cause, ids] of Object.entries(state.removedFor)) {
      const kept = ids.filter((id) => id !== op.id);
      if (kept.length) removedFor[cause] = kept;
    }
    return { ...state, decisions, removedFor };
  }

  // An insert: back to undecided, and whatever was dropped to fit it returns.
  decisions[op.id] = undefined;
  for (const id of state.removedFor[op.id] ?? []) decisions[id] = undefined;
  const removedFor = { ...state.removedFor };
  delete removedFor[op.id];
  return { ...state, decisions, removedFor, currentOpId: op.id, whyOpen: false };
}

function choosePageFit(state: ReviewState, optionId: string, causedBy: string | null): ReviewState {
  const [kind, id, index] = optionId.split(":");

  if (kind === "remove" && id) {
    const removedFor = causedBy
      ? { ...state.removedFor, [causedBy]: [...(state.removedFor[causedBy] ?? []), id] }
      : state.removedFor;
    return { ...state, decisions: { ...state.decisions, [id]: true }, removedFor };
  }

  if (kind === "shorter" && id && index !== undefined) {
    return { ...state, wordings: { ...state.wordings, [id]: Number(index) } };
  }

  if (kind === "grow") {
    // Agreeing to this length is not agreeing to any length: growing again asks again.
    return { ...state, growthAllowed: true, pagesAllowed: state.pages };
  }

  return state;
}
```

In `src/lib/session.ts`, add one field to `StoredDecisions`, after `growthAllowed`:

```ts
  /** Lines removed to make room for an insert, keyed by that insert. Absent in
   *  sessions saved before 29 Sep 2026, which is why it is optional. */
  removedFor?: Record<string, string[]>;
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npx vitest run src/lib/tailor/review.test.ts && npx tsc --noEmit -p .`
Expected: PASS; tsc exits 0.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/tailor/review.ts src/lib/tailor/review.test.ts src/lib/session.ts
git commit -m "Add the review reducer: undo for every decision, linked page-fit undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The review list selector

One function builds everything the right column, the header status and the announcements show, so they cannot disagree.

**Files:**
- Create: `src/lib/tailor/review-list.ts`
- Test: `src/lib/tailor/review-list.test.ts`

**Interfaces:**
- Consumes:
  - `ReviewState` (Task 3);
  - `buildLines`, `wordingFor`, `wordingOptions`, `anchorLabel`, `cleanText`, `LineState`, `Wordings` (`./view`, with `cleanText` from Task 1);
  - `Layout`, `PlannedOp`, `TailorPlan` (`./types`).
- Produces:

```ts
export type ItemState = LineState | "skipped";
export type ReviewItem = {
  op: PlannedOp; state: ItemState; skill: string | null; where: string | null; text: string;
  wordingIndex: number; wordingCount: number;
  reason: string | null; sources: string[]; jobSays: string[];
};
export type PageFitOption = { id: string; label: string; quote?: string; verb: string };
export type PageFit = { causedBy: string | null; pages: number; allowed: number; options: PageFitOption[] };
export type ReviewList = {
  toDecide: ReviewItem[]; current: ReviewItem | null; position: number; totalDecisions: number;
  decided: ReviewItem[]; reworded: ReviewItem[]; removed: ReviewItem[];
  pageFit: PageFit | null; status: string; ready: boolean;
};
export function withDecisions(operations: PlannedOp[], decisions: Decisions): PlannedOp[];
export function reviewList(plan: TailorPlan, layout: Layout, state: ReviewState): ReviewList;
export function pageFitOptions(args: { operations: PlannedOp[]; layout: Layout; wordings: Wordings; changedOpId?: string; pages: number }): PageFitOption[];
export function decisionAnnouncement(skill: string | null, approved: boolean, left: number): string;
export function undoAnnouncement(item: ReviewItem): string;
```

- [ ] **Step 1: Write the failing tests.** Create `src/lib/tailor/review-list.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fromStored, type ReviewState } from "./review";
import { decisionAnnouncement, pageFitOptions, reviewList, undoAnnouncement, withDecisions } from "./review-list";
import type { Layout, PlannedOp, TailorPlan } from "./types";

const block = (id: string, kind: Layout["blocks"][number]["kind"], text: string) => ({
  id, kind, text, section: "EXPERIENCE", style: null, lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0,
});
const layout: Layout = {
  format: "docx", pages: 1, fonts: [], warnings: [],
  blocks: [
    block("b5", "role", "Razorfin · Software Engineer, Backend\tAug 2024 – present"),
    block("b6", "bullet", "Worked on backend APIs for payments."),
    block("b7", "bullet", "Helped refactor the refunds module."),
    block("b8", "bullet", "• Built a nightly reconciliation job."),
    block("b13", "bullet", "Wrote unit tests."),
  ],
};
const base: Omit<PlannedOp, "id" | "op" | "block"> = {
  text: "Text.", alternatives: [], claim: "reworded", value: 5, requirements: [], evidence: [], needsDecision: false,
};
const ins1: PlannedOp = {
  ...base, id: "ins1", op: "insert_after", block: "b7", claim: "added_by_user", needsDecision: true,
  requirements: ["r3"], text: "Worked with Apache Kafka for event streaming and message processing.",
  alternatives: ["Used Kafka for event streaming.", "Worked with Apache Kafka for streaming events in production."],
  reason: "Kafka is a must-have for this role.",
};
// Listed before ins1 on purpose: the list must follow the document, not the plan.
const ins2: PlannedOp = {
  ...base, id: "ins2", op: "insert_after", block: "b8", claim: "added_by_user", needsDecision: true,
  requirements: ["r6"], text: "• Built payment service as part of a microservices architecture.",
};
const reph: PlannedOp = { ...base, id: "reph", op: "rephrase", block: "b6", text: "Designed REST APIs for payments.", evidence: ["b6"] };
const rem: PlannedOp = { ...base, id: "rem", op: "remove", block: "b13", text: undefined, value: 1 };

const plan: TailorPlan = {
  company: "Kosha Payments", role: "Backend Engineer",
  requirements: [
    { id: "r3", label: "Apache Kafka", wording: "Apache Kafka in production", kind: "skill", importance: "must", knockout: false },
    { id: "r6", label: "Microservices", wording: "Microservices experience", kind: "skill", importance: "must", knockout: false },
  ],
  matches: [],
  operations: [ins2, reph, ins1, rem],
  coverage: { covered: 0, total: 2, originalCovered: 0 },
};
const state = (over: Partial<ReviewState> = {}): ReviewState => ({ ...fromStored(null), pagesAllowed: 1, ...over });

describe("reviewList", () => {
  it("lists what is left to decide in document order and opens the first", () => {
    const list = reviewList(plan, layout, state());
    expect(list.toDecide.map((i) => i.op.id)).toEqual(["ins1", "ins2"]);
    expect(list.current?.op.id).toBe("ins1");
    expect(list).toMatchObject({ position: 1, totalDecisions: 2, status: "2 to decide · 1 page", ready: false });
  });

  it("opens the card the user chose", () => {
    expect(reviewList(plan, layout, state({ currentOpId: "ins2" })).current?.op.id).toBe("ins2");
  });

  it("falls back to the first pending card when the chosen one is not pending", () => {
    expect(reviewList(plan, layout, state({ currentOpId: "reph" })).current?.op.id).toBe("ins1");
  });

  it("describes a card in words that make sense on their own", () => {
    const item = reviewList(plan, layout, state()).current!;
    expect(item).toMatchObject({
      skill: "Apache Kafka", where: "Razorfin", wordingIndex: 0, wordingCount: 3,
      reason: "Kafka is a must-have for this role.", jobSays: ["Apache Kafka in production"], sources: [],
    });
  });

  it("strips a typed bullet from a drafted line", () => {
    const item = reviewList(plan, layout, state()).toDecide[1];
    expect(item.text).toBe("Built payment service as part of a microservices architecture.");
  });

  it("moves answered lines to decided, added or skipped", () => {
    const list = reviewList(plan, layout, state({ decisions: { ins1: true, ins2: false } }));
    expect(list.decided.map((i) => [i.op.id, i.state])).toEqual([["ins1", "added"], ["ins2", "skipped"]]);
    expect(list).toMatchObject({ toDecide: [], current: null, status: "All decided · 1 page", ready: true });
  });

  it("counts position from the decisions already made", () => {
    expect(reviewList(plan, layout, state({ decisions: { ins1: true } })).position).toBe(2);
  });

  it("shows a rewording, and the user's own line once undone", () => {
    expect(reviewList(plan, layout, state()).reworded[0]).toMatchObject({
      state: "reworded", text: "Designed REST APIs for payments.", sources: ["Worked on backend APIs for payments."],
    });
    expect(reviewList(plan, layout, state({ decisions: { reph: false } })).reworded[0]).toMatchObject({
      state: "reverted", text: "Worked on backend APIs for payments.",
    });
  });

  it("lists a removal only once the user chose it", () => {
    expect(reviewList(plan, layout, state()).removed).toEqual([]);
    expect(reviewList(plan, layout, state({ decisions: { rem: true } })).removed[0]).toMatchObject({
      state: "removed", text: "Wrote unit tests.",
    });
  });

  it("asks nothing about length while the document fits", () => {
    expect(reviewList(plan, layout, state({ pages: 1, pagesAllowed: 1 })).pageFit).toBeNull();
  });

  it("asks about length when the document outgrows what was agreed, and is not ready", () => {
    const list = reviewList(plan, layout, state({ decisions: { ins1: true, ins2: false }, pages: 2, pagesAllowed: 1 }));
    expect(list.pageFit).toMatchObject({ causedBy: "ins1", pages: 2, allowed: 1 });
    expect(list.pageFit!.options.map((o) => o.id)).toEqual(["shorter:ins1:1", "remove:rem", "grow"]);
    expect(list.ready).toBe(false);
  });

  it("never asks about length while comparing", () => {
    expect(reviewList(plan, layout, state({ pages: 2, pagesAllowed: 1, compare: true })).pageFit).toBeNull();
  });

  it("says so when there is nothing to do at all", () => {
    const empty = { ...plan, operations: [] };
    expect(reviewList(empty, layout, state())).toMatchObject({
      status: "Your resume already covers what this job asks for.", ready: true,
    });
  });

  it("says nothing is left to decide when only rewordings were made", () => {
    const onlyReworded = { ...plan, operations: [reph] };
    expect(reviewList(onlyReworded, layout, state({ pages: 2, pagesAllowed: 2 })).status).toBe("Nothing to decide · 2 pages");
  });
});

describe("pageFitOptions", () => {
  it("offers the cheapest ways out first and always the extra page last", () => {
    const operations = withDecisions(plan.operations, { ins1: true });
    const options = pageFitOptions({ operations, layout, wordings: {}, changedOpId: "ins1", pages: 2 });
    expect(options.map((o) => o.label)).toEqual([
      "Say it more briefly", "Remove the least relevant line", "Keep everything, allow 2 pages",
    ]);
    expect(options[0].quote).toBe("Used Kafka for event streaming.");
    expect(options[1].quote).toBe("Wrote unit tests.");
  });

  it("offers only the extra page when nothing else would help", () => {
    const options = pageFitOptions({ operations: [], layout, wordings: {}, pages: 3 });
    expect(options).toEqual([{ id: "grow", label: "Keep everything, allow 3 pages", verb: "Allow 3 pages" }]);
  });
});

describe("announcements", () => {
  it("names the skill and what remains", () => {
    expect(decisionAnnouncement("Apache Kafka", true, 1)).toBe("Apache Kafka line added. 1 decision left.");
    expect(decisionAnnouncement(null, false, 0)).toBe("Line skipped. No decisions left.");
    expect(decisionAnnouncement("Kubernetes", false, 2)).toBe("Kubernetes line skipped. 2 decisions left.");
  });

  it("says what an undo did", () => {
    const list = reviewList(plan, layout, state({ decisions: { ins1: true, rem: true } }));
    expect(undoAnnouncement(list.decided[0])).toBe("Apache Kafka line is back to decide.");
    expect(undoAnnouncement(list.reworded[0])).toBe("Rewording undone. Your original line is back.");
    expect(undoAnnouncement(list.removed[0])).toBe("Line kept.");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npx vitest run src/lib/tailor/review-list.test.ts`
Expected: FAIL, with "Failed to resolve import ./review-list".

- [ ] **Step 3: Implement.** Create `src/lib/tailor/review-list.ts`:

```ts
import type { ReviewState } from "./review";
import type { Layout, PlannedOp, TailorPlan } from "./types";
import {
  type Decisions,
  type LineState,
  type Wordings,
  anchorLabel,
  buildLines,
  cleanText,
  wordingFor,
  wordingOptions,
} from "./view";

/**
 * The review list: what is left to decide, what was decided, what was
 * reworded, and whether the document still fits.
 *
 * The one source for the right column, the header status and every
 * announcement. The old screen worked "needs your OK" out in four places and
 * they disagreed.
 */

export type ItemState = LineState | "skipped";

export type ReviewItem = {
  op: PlannedOp;
  state: ItemState;
  /** What the line is about, e.g. "Apache Kafka". */
  skill: string | null;
  /** The employer whose role the line joins, e.g. "Razorfin". */
  where: string | null;
  /** The words on the page now. */
  text: string;
  wordingIndex: number;
  wordingCount: number;
  reason: string | null;
  /** The user's own lines this change is built from. */
  sources: string[];
  /** The job's own words for what this answers. */
  jobSays: string[];
};

export type PageFitOption = {
  id: string;
  label: string;
  /** The line itself, in the user's own words. */
  quote?: string;
  /** The button's verb once this option is chosen. */
  verb: string;
};

export type PageFit = {
  /** The change that pushed the document over, when there is one. */
  causedBy: string | null;
  pages: number;
  allowed: number;
  options: PageFitOption[];
};

export type ReviewList = {
  toDecide: ReviewItem[];
  current: ReviewItem | null;
  /** 1-based: which decision this is, counting those already made. */
  position: number;
  totalDecisions: number;
  decided: ReviewItem[];
  reworded: ReviewItem[];
  removed: ReviewItem[];
  pageFit: PageFit | null;
  status: string;
  ready: boolean;
};

export function withDecisions(operations: PlannedOp[], decisions: Decisions): PlannedOp[] {
  return operations.map((op) => ({ ...op, approved: decisions[op.id] }));
}

export function reviewList(plan: TailorPlan, layout: Layout, state: ReviewState): ReviewList {
  const operations = withDecisions(plan.operations, state.decisions);
  const blockIndex = new Map(layout.blocks.map((b, i) => [b.id, i]));
  const blockOf = (id: string) => layout.blocks.find((b) => b.id === id);
  // Array.prototype.sort is stable, so two ops on one block keep the plan's order.
  const sorted = [...operations].sort(
    (a, b) => (blockIndex.get(a.block) ?? 0) - (blockIndex.get(b.block) ?? 0),
  );

  const item = (op: PlannedOp, itemState: ItemState): ReviewItem => {
    const block = blockOf(op.block);
    const kind = block?.kind ?? "paragraph";
    const ownWords = op.op === "remove" || itemState === "reverted";
    const options = wordingOptions(op);
    const count = Math.max(1, options.length);
    const asked = plan.requirements.filter((r) => op.requirements.includes(r.id));
    return {
      op,
      state: itemState,
      skill: asked.length ? asked.map((r) => r.label).join(" and ") : null,
      where: anchorLabel(layout, op.block),
      text: cleanText(kind, ownWords ? (block?.text ?? "") : wordingFor(op, state.wordings)),
      wordingIndex: (((state.wordings[op.id] ?? 0) % count) + count) % count,
      wordingCount: options.length,
      reason: op.reason ?? null,
      sources: op.evidence
        .map((id) => blockOf(id))
        .filter((b): b is NonNullable<typeof b> => Boolean(b))
        .map((b) => cleanText(b.kind, b.text)),
      jobSays: asked.map((r) => r.wording),
    };
  };

  const toDecide = sorted
    .filter((op) => op.needsDecision && op.approved === undefined)
    .map((op) => item(op, "pending"));
  const decided = sorted
    .filter((op) => op.needsDecision && op.approved !== undefined)
    .map((op) => item(op, op.approved ? "added" : "skipped"));
  const reworded = sorted
    .filter((op) => op.op === "rephrase")
    .map((op) => item(op, op.approved === false ? "reverted" : "reworded"));
  const removed = sorted
    .filter((op) => op.op === "remove" && op.approved === true)
    .map((op) => item(op, "removed"));

  const current = toDecide.find((i) => i.op.id === state.currentOpId) ?? toDecide[0] ?? null;
  const totalDecisions = toDecide.length + decided.length;

  let pageFit: PageFit | null = null;
  if (!state.compare && state.pagesAllowed !== null && state.pages > state.pagesAllowed) {
    const lines = buildLines(layout, operations, state.decisions, false, state.wordings);
    const lastChanged = [...lines].reverse().find((l) => l.state === "added" || l.state === "reworded");
    pageFit = {
      causedBy: lastChanged?.opId ?? null,
      pages: state.pages,
      allowed: state.pagesAllowed,
      options: pageFitOptions({
        operations,
        layout,
        wordings: state.wordings,
        changedOpId: lastChanged?.opId,
        pages: state.pages,
      }),
    };
  }

  const pagesText = `${state.pages} page${state.pages === 1 ? "" : "s"}`;
  const status = toDecide.length
    ? `${toDecide.length} to decide · ${pagesText}`
    : totalDecisions
      ? `All decided · ${pagesText}`
      : reworded.length
        ? `Nothing to decide · ${pagesText}`
        : "Your resume already covers what this job asks for.";

  return {
    toDecide,
    current,
    position: decided.length + 1,
    totalDecisions,
    decided,
    reworded,
    removed,
    pageFit,
    status,
    ready: toDecide.length === 0 && pageFit === null,
  };
}

/** A shorter way of saying the same thing, if the planner offered one. */
function shorterWording(options: string[], current: number): number | null {
  const now = options[current]?.length ?? 0;
  let best: number | null = null;
  options.forEach((text, index) => {
    if (index === current || text.length >= now) return;
    if (best === null || text.length < options[best].length) best = index;
  });
  return best;
}

/**
 * The ways out of "this no longer fits", cheapest to the user first.
 *
 * "Swap first, grow last" — but every swap is one of the user's own lines, so
 * each one is named, quoted, and chosen rather than applied.
 */
export function pageFitOptions({
  operations,
  layout,
  wordings,
  changedOpId,
  pages,
}: {
  operations: PlannedOp[];
  layout: Layout;
  wordings: Wordings;
  changedOpId?: string;
  pages: number;
}): PageFitOption[] {
  const options: PageFitOption[] = [];

  const changed = operations.find((op) => op.id === changedOpId);
  if (changed) {
    const list = wordingOptions(changed);
    const shorter = shorterWording(list, wordings[changed.id] ?? 0);
    if (shorter !== null) {
      options.push({
        id: `shorter:${changed.id}:${shorter}`,
        label: "Say it more briefly",
        quote: list[shorter],
        verb: "Use the shorter wording",
      });
    }
  }

  operations
    .filter((op) => op.op === "remove" && op.approved === undefined)
    .sort((a, b) => a.value - b.value)
    .slice(0, 2)
    .forEach((op, index) => {
      const block = layout.blocks.find((b) => b.id === op.block);
      options.push({
        id: `remove:${op.id}`,
        label: index === 0 ? "Remove the least relevant line" : "Remove a different line",
        quote: block ? cleanText(block.kind, block.text) : undefined,
        verb: "Remove that line",
      });
    });

  options.push({ id: "grow", label: `Keep everything, allow ${pages} pages`, verb: `Allow ${pages} pages` });
  return options;
}

/** "Kafka line added. 1 decision left." — the spec's polite announcement. */
export function decisionAnnouncement(skill: string | null, approved: boolean, left: number): string {
  const what = `${skill ? `${skill} line` : "Line"} ${approved ? "added" : "skipped"}.`;
  const rest = left === 0 ? "No decisions left." : `${left} decision${left === 1 ? "" : "s"} left.`;
  return `${what} ${rest}`;
}

export function undoAnnouncement(item: ReviewItem): string {
  switch (item.state) {
    case "added":
    case "skipped":
      return `${item.skill ? `${item.skill} line` : "That line"} is back to decide.`;
    case "reworded":
      return "Rewording undone. Your original line is back.";
    case "reverted":
      return "Reworded line restored.";
    case "removed":
      return "Line kept.";
    default:
      return "";
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npx vitest run src/lib/tailor/review-list.test.ts && npx tsc --noEmit -p .`
Expected: PASS; tsc exits 0.

If `"shorter:ins1:1"` fails: `wordingOptions(ins1)` is `[text, alt0, alt1]`, and `alt0` ("Used Kafka for event streaming.") is the shortest, at index 1. Check the fixture before touching the code.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/tailor/review-list.ts src/lib/tailor/review-list.test.ts
git commit -m "Add the review list selector the whole screen reads from

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Move the download out of the component

**Files:**
- Create: `src/lib/tailor/download.ts`
- Test: `src/lib/tailor/download.test.ts`

**Interfaces:**
- Consumes: `RenderedLine` (`./view`).
- Produces:

```ts
export function downloadBlocks(lines: RenderedLine[]): { kind: BlockKind; text: string }[];
export function safeName(value: string): string;
export function downloadName(filename: string | null, company: string): string;
export async function downloadResume(lines: RenderedLine[], filename: string | null, company: string): Promise<{ name: string; pages: number | null }>;
```
- `downloadResume` throws `Error` with a user-facing message on failure.

- [ ] **Step 1: Write the failing tests.** Create `src/lib/tailor/download.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { downloadBlocks, downloadName, safeName } from "./download";
import type { RenderedLine } from "./view";

const line = (key: string, state: RenderedLine["state"], text: string): RenderedLine => ({
  key, blockId: key, kind: "bullet", section: null, style: null, text, state,
  runs: [], size: 10.5, spaceBefore: 0, align: "left", ruleBelow: false,
});

describe("downloadBlocks", () => {
  it("sends what the user kept and nothing they did not agree to", () => {
    const blocks = downloadBlocks([
      line("a", "unchanged", "Kept."),
      line("b", "pending", "Not decided."),
      line("c", "removed", "Dropped to fit."),
      line("d", "added", "Added by you."),
      line("e", "reverted", "Your words."),
    ]);
    expect(blocks).toEqual([
      { kind: "bullet", text: "Kept." },
      { kind: "bullet", text: "Added by you." },
      { kind: "bullet", text: "Your words." },
    ]);
  });
});

describe("file names", () => {
  it("removes characters no file system accepts", () => {
    expect(safeName('Kosha: "Payments"/India')).toBe("Kosha Payments India");
    expect(safeName("   ")).toBe("resume");
  });

  it("names the file after the upload and the company", () => {
    expect(downloadName("priya_resume.docx", "Kosha Payments")).toBe("priya_resume — Kosha Payments.pdf");
    expect(downloadName(null, "Kosha")).toBe("resume — Kosha.pdf");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npx vitest run src/lib/tailor/download.test.ts`
Expected: FAIL, with "Failed to resolve import ./download".

- [ ] **Step 3: Implement.** Create `src/lib/tailor/download.ts`. The fetch body is moved as-is from `ResultScreen.tsx` `download()`, lines ~171–236:

```ts
import type { BlockKind } from "./types";
import type { RenderedLine } from "./view";

/**
 * The tailored document as the renderer receives it.
 *
 * v1 override (28 Sep 2026, see CLAUDE.md): the client resolves the final
 * content, so a skipped or undecided line cannot reach the file by a later
 * accident of state. Only (kind, text) crosses the wire.
 */
export function downloadBlocks(lines: RenderedLine[]): { kind: BlockKind; text: string }[] {
  return lines
    .filter((line) => line.state !== "removed" && line.state !== "pending")
    .map((line) => ({ kind: line.kind, text: line.text }));
}

/** Nothing from a job posting goes into a filename unfiltered. */
export function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim() || "resume";
}

export function downloadName(filename: string | null, company: string): string {
  return `${safeName(filename ?? "resume").replace(/\.(docx|pdf)$/i, "")} — ${safeName(company)}.pdf`;
}

/** Render the resume, save it, and say what was saved. Throws a message a person can read. */
export async function downloadResume(
  lines: RenderedLine[],
  filename: string | null,
  company: string,
): Promise<{ name: string; pages: number | null }> {
  const response = await fetch("/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: downloadBlocks(lines) }),
  });

  // Read the status before the body: a gateway's HTML 502 used to surface to
  // the user as "Unexpected token '<'".
  if (!response.ok) {
    let message = "Could not write your file.";
    try {
      message = (await response.json()).error ?? message;
    } catch {
      /* Not JSON. The status is all we know, and the default says it. */
    }
    throw new Error(message);
  }

  const body = await response.json();
  if (typeof body.file !== "string") throw new Error("Could not write your file.");

  const bytes = Uint8Array.from(atob(body.file), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const name = downloadName(filename, company);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  // In the document and revoked a tick later: a detached anchor and an
  // immediate revoke is a known way to lose the file in some browsers.
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { name, pages: typeof body.pages === "number" ? body.pages : null };
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npx vitest run src/lib/tailor/download.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/tailor/download.ts src/lib/tailor/download.test.ts
git commit -m "Move the download out of the Result screen component

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The new components

Load the `rezz-design` skill first. These components are views over Tasks 2–4, and have no logic of their own. There is no DOM test environment in this repo, so this task is verified by the type checker and lint; behaviour is verified in Task 8.

**Files:**
- Modify: `src/components/rezz/Button.tsx` (add size `sm`)
- Create: `src/components/result/WhyThisLine.tsx`
- Create: `src/components/result/DecisionCard.tsx`
- Create: `src/components/result/ItemRow.tsx`
- Create: `src/components/result/PageFitCard.tsx`
- Create: `src/components/result/ReviewList.tsx`
- Create: `src/components/result/SummaryPanel.tsx`
- Create: `src/components/result/ResultHeader.tsx`

**Interfaces:**
- Consumes:
  - `ReviewItem`, `ReviewList as ReviewListData`, `PageFit` (Task 4);
  - `RequirementRow`, `RequirementGroup` (Task 2);
  - `ReviewState` (Task 3);
  - `Coverage` (`@/lib/tailor/types`);
  - `shorten` (`@/lib/tailor/text`).
- Produces the component props used by Task 7:

```ts
ReviewList({ list, state, coverage, notice, className, onDecide, onUndo, onNextWording, onOpen, onWhy, onChoosePageFit })
SummaryPanel({ rows, coverage, selected, onSelect, className })  // onSelect(requirementId: string, opId: string | null)
ResultHeader({ role, company, status, compare, onToggleCompare, ready, onDownload, canDownload, downloading })
```

- [ ] **Step 1: Add `sm` to Button.** In `src/components/rezz/Button.tsx`:
  - change `type Size = "md" | "lg";` to `type Size = "sm" | "md" | "lg";`
  - add the first entry of `sizes`:

```ts
  /* Row-level actions (Undo, Keep it) in a 300px column. Still 44px tall. */
  sm: "min-h-11 px-3 text-[13px] leading-[18px]",
```

- [ ] **Step 2: Create `src/components/result/WhyThisLine.tsx`:**

```tsx
"use client";

import { type ButtonHTMLAttributes, useEffect } from "react";
import type { ReviewItem } from "@/lib/tailor/review-list";

/**
 * "Why this line?" — the reason, the user's own line it came from, and the
 * job's exact words. Level two of two; the spec allows no deeper. It opens
 * inside the card or row it explains, so it can never sit beside the wrong line.
 */
export function WhyThisLine({ item, onClose }: { item: ReviewItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const added = item.op.claim === "added_by_user";

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 text-sm leading-[21px]">
      {item.reason ? <p className="m-0">{item.reason}</p> : null}
      {item.sources.length > 0 && (
        <Quotes label={`Based on your line${item.sources.length > 1 ? "s" : ""}`} items={item.sources} />
      )}
      {item.jobSays.length > 0 && <Quotes label="The job says" items={item.jobSays} />}
      <span className={`font-mark text-[11px] leading-4 ${added ? "text-gap" : "text-verified"}`}>
        {added ? "— not in your resume" : "— your own words, reworded"}
      </span>
    </div>
  );
}

function Quotes({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <span className="mb-[3px] block font-mark text-[11px] leading-4 text-ink-muted">{label}</span>
      {items.map((text, index) => (
        <q
          key={`${index}-${text.slice(0, 16)}`}
          className="mt-1 block rounded-md bg-paper-sunken px-3 py-2 text-[13px] leading-5 text-ink-muted [quotes:none]"
        >
          {text}
        </q>
      ))}
    </div>
  );
}

/** A quiet text action: underlined, never a drawn button, still 44px to tap. */
export function TextAction({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 font-ui
                 text-[13px] font-medium leading-[18px] text-ink underline underline-offset-[3px]
                 disabled:cursor-not-allowed disabled:opacity-45"
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Create `src/components/result/DecisionCard.tsx`:**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/rezz/Button";
import type { ReviewItem } from "@/lib/tailor/review-list";
import { TextAction, WhyThisLine } from "./WhyThisLine";

/**
 * The one decision in front of the user.
 *
 * Skip and Add it are identical markup, side by side, nothing pre-selected —
 * a product rule, so it is expressed as one button twice rather than two styles
 * that happen to match today. A press in the first 350ms of a new card is
 * ignored, so a double click or a held Enter cannot answer the next question
 * too; focus is moved to the new question on purpose.
 */
export function DecisionCard({
  item,
  position,
  total,
  whyOpen,
  onDecide,
  onNextWording,
  onWhy,
}: {
  item: ReviewItem;
  position: number;
  total: number;
  whyOpen: boolean;
  onDecide: (opId: string, approved: boolean) => void;
  onNextWording: (opId: string) => void;
  onWhy: (opId: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previous = useRef<string | null>(null);
  const shownAt = useRef(0);
  const id = item.op.id;

  useEffect(() => {
    // Only on the way from one question to the next — not on first paint.
    if (previous.current !== null && previous.current !== id) headingRef.current?.focus();
    previous.current = id;
    shownAt.current = performance.now();
  }, [id]);

  /* A new card appears exactly where the last one was, so the second half of
     a double click (or a held Enter) lands on its buttons. Anything faster
     than a person can read the question is not an answer to it. */
  const answer = (approved: boolean) => {
    if (performance.now() - shownAt.current < 350) return;
    onDecide(id, approved);
  };

  const label = item.skill ?? "this";

  return (
    <section aria-labelledby={`decision-${id}`} className="rounded-lg border border-gap bg-paper-raised p-4">
      <span className="block font-mark text-[11.5px] leading-4 text-gap">
        Needs your OK · {position} of {total}
      </span>
      <h3
        id={`decision-${id}`}
        ref={headingRef}
        tabIndex={-1}
        className="m-0 mt-1 text-[15px] font-semibold leading-[22px] outline-offset-4"
      >
        {item.skill ? `${item.skill} isn't in your resume.` : "This line isn't in your resume."}{" "}
        {item.where ? `Add this line to your ${item.where} role?` : "Add it?"}
      </h3>
      <p className="m-0 mt-2 rounded-md bg-paper-sunken px-3 py-2 text-sm leading-[21px]">{item.text}</p>
      <p className="m-0 mt-2 text-[13px] leading-[19px] text-ink-muted">
        Recruiters may ask you about it. Nothing is added unless you choose Add it.
      </p>

      <div key={id} className="mt-3 grid grid-cols-2 gap-3">
        <Button variant="secondary" aria-label={`Skip ${label} line`} onClick={() => answer(false)}>
          Skip
        </Button>
        <Button variant="secondary" aria-label={`Add ${label} line to my resume`} onClick={() => answer(true)}>
          Add it
        </Button>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4">
        {item.wordingCount > 1 && (
          <TextAction onClick={() => onNextWording(id)}>
            Try another wording ({item.wordingIndex + 1} of {item.wordingCount})
          </TextAction>
        )}
        <TextAction aria-expanded={whyOpen} onClick={() => onWhy(id)}>
          {whyOpen ? "Hide why" : "Why this line?"}
        </TextAction>
      </div>
      {whyOpen && <WhyThisLine item={item} onClose={() => onWhy(id)} />}
    </section>
  );
}
```

- [ ] **Step 4: Create `src/components/result/ItemRow.tsx`:**

```tsx
"use client";

import { Check, Minus, PenLine } from "lucide-react";
import { Button } from "@/components/rezz/Button";
import type { ItemState, ReviewItem } from "@/lib/tailor/review-list";
import { shorten } from "@/lib/tailor/text";
import { WhyThisLine } from "./WhyThisLine";

/**
 * One decided, reworded or removed line: a single row with the way back.
 * Nothing here re-asks on its own — the row only changes when the user presses
 * its button.
 */
const COPY: Partial<
  Record<ItemState, { tag: string; Icon: typeof Check; tone: string; action: string; aria: (what: string) => string }>
> = {
  added: { tag: "Added", Icon: Check, tone: "text-verified", action: "Undo", aria: (w) => `Undo adding ${w} line` },
  skipped: { tag: "Skipped", Icon: Minus, tone: "text-ink-muted", action: "Undo", aria: (w) => `Undo skipping ${w} line` },
  reworded: { tag: "Reworded", Icon: PenLine, tone: "text-ink", action: "Undo", aria: (w) => `Undo rewording: ${w}` },
  reverted: {
    tag: "Your original", Icon: Minus, tone: "text-ink-muted", action: "Use the rewording",
    aria: (w) => `Use the rewording again: ${w}`,
  },
  removed: { tag: "Removed to fit", Icon: Minus, tone: "text-ink-muted", action: "Keep it", aria: (w) => `Keep this line: ${w}` },
};

export function ItemRow({
  item,
  open,
  onWhy,
  onUndo,
}: {
  item: ReviewItem;
  open: boolean;
  onWhy: (opId: string) => void;
  onUndo: (opId: string) => void;
}) {
  const copy = COPY[item.state];
  if (!copy) return null;

  const snippet = shorten(item.text, 48) ?? "";
  const decision = item.op.needsDecision;
  const [lead, rest] = decision ? [item.skill ?? "Line", copy.tag] : [copy.tag, snippet];

  return (
    <li className="rounded-lg border border-line bg-paper-raised">
      <div className="flex items-center gap-2 pl-3 pr-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onWhy(item.op.id)}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0
                     text-left text-[13px] leading-[18px] text-ink"
        >
          <copy.Icon aria-hidden className={`h-4 w-4 flex-none ${copy.tone}`} strokeWidth={1.5} />
          <span className="min-w-0 truncate">
            <span className="font-semibold">{lead}</span> · {rest}
          </span>
        </button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-none"
          aria-label={copy.aria(decision ? (item.skill ?? "this") : snippet)}
          onClick={() => onUndo(item.op.id)}
        >
          {copy.action}
        </Button>
      </div>
      {open && (
        <div className="px-3 pb-3">
          <WhyThisLine item={item} onClose={() => onWhy(item.op.id)} />
        </div>
      )}
    </li>
  );
}
```

If `PenLine` is not exported by the installed `lucide-react` (check `node_modules/lucide-react/dist/lucide-react.d.ts`), use `Pencil` instead.

- [ ] **Step 5: Create `src/components/result/PageFitCard.tsx`** (the old `PageFitPrompt`'s choice logic, no longer absolutely positioned):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/rezz/Button";
import type { PageFit } from "@/lib/tailor/review-list";

/**
 * "Swap first, grow last" — but ask.
 *
 * A default is right here and wrong in the decision card: this is a layout
 * trade-off with a sensible answer, while Add it / Skip is a question about
 * honesty. Do not copy the pre-selected radio into the card.
 */
export function PageFitCard({ pageFit, onChoose }: { pageFit: PageFit; onChoose: (optionId: string) => void }) {
  const [chosen, setChosen] = useState(pageFit.options[0]?.id ?? "");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The document moved under the reader, so say so where they are looking.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const current = pageFit.options.find((o) => o.id === chosen) ?? pageFit.options[0];
  if (!current) return null;
  const { pages, allowed } = pageFit;

  return (
    <section aria-labelledby="page-fit-heading" className="rounded-lg border border-gap bg-paper-raised p-4 text-sm leading-[21px]">
      <h3
        id="page-fit-heading"
        ref={headingRef}
        tabIndex={-1}
        className="m-0 text-[15px] font-semibold leading-[22px] outline-offset-4"
      >
        {pageFit.causedBy ? `That line makes it ${pages} pages.` : `Your resume now runs to ${pages} pages.`}
      </h3>
      <p className="m-0 mt-1 text-[13px] leading-[19px] text-ink-muted">
        Your resume was {allowed} page{allowed === 1 ? "" : "s"}. Nothing is dropped unless you choose it.
      </p>

      <fieldset className="m-0 mt-3 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">How to make it fit</legend>
        {pageFit.options.map((option) => (
          <label
            key={option.id}
            className={`grid min-h-11 cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-start gap-2.5 rounded-md
                        px-2 py-2 transition-colors duration-150
                        ${chosen === option.id ? "bg-paper-sunken" : "hover:bg-paper-sunken"}`}
          >
            <input
              type="radio"
              name="page-fit"
              value={option.id}
              checked={chosen === option.id}
              onChange={() => setChosen(option.id)}
              className="mt-1 h-4 w-4 accent-[var(--ink)]"
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.quote ? (
                <q className="mt-0.5 block text-[13px] leading-5 text-ink-muted [quotes:none]">{option.quote}</q>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-3">
        <Button variant="secondary" onClick={() => onChoose(current.id)}>
          {current.verb}
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create `src/components/result/ReviewList.tsx`:**

```tsx
"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { ReviewState } from "@/lib/tailor/review";
import type { ReviewItem, ReviewList as ReviewListData } from "@/lib/tailor/review-list";
import type { Coverage } from "@/lib/tailor/types";
import { DecisionCard } from "./DecisionCard";
import { ItemRow } from "./ItemRow";
import { PageFitCard } from "./PageFitCard";

/**
 * The right column: the one place anything on this screen is decided or undone.
 *
 * It replaces the job panel's "Needs your OK" group, the margin marks, the
 * popover and the bottom bar — four places that each showed part of the same
 * question, and only one of which let you answer it.
 */
const groupHeading = "m-0 text-[13px] font-semibold leading-[18px] text-ink-muted";

export function ReviewList({
  list,
  state,
  coverage,
  notice,
  className = "",
  onDecide,
  onUndo,
  onNextWording,
  onOpen,
  onWhy,
  onChoosePageFit,
}: {
  list: ReviewListData;
  state: ReviewState;
  coverage: Coverage;
  /** Sample / missing file / download error, shown above everything else. */
  notice?: ReactNode;
  className?: string;
  onDecide: (opId: string, approved: boolean) => void;
  onUndo: (opId: string) => void;
  onNextWording: (opId: string) => void;
  onOpen: (opId: string) => void;
  onWhy: (opId: string) => void;
  onChoosePageFit: (optionId: string) => void;
}) {
  const whyFor = (opId: string) => state.whyOpen && state.currentOpId === opId;
  const pages = `${state.pages} page${state.pages === 1 ? "" : "s"}`;

  return (
    <section aria-label="Your review" className={`flex flex-col gap-3 p-1 font-ui ${className}`}>
      {notice}
      {state.compare && (
        <p className="m-0 rounded-lg border border-line bg-paper-raised p-3 text-[13px] leading-[19px] text-ink-muted">
          Turn off compare to make changes.
        </p>
      )}

      <fieldset
        disabled={state.compare}
        className={`m-0 flex min-w-0 flex-col gap-3 border-0 p-0 ${state.compare ? "opacity-50" : ""}`}
      >
        {list.pageFit && (
          <PageFitCard
            key={`${list.pageFit.pages}-${list.pageFit.allowed}`}
            pageFit={list.pageFit}
            onChoose={onChoosePageFit}
          />
        )}

        {list.toDecide.length > 0 ? (
          <>
            <h2 className={groupHeading}>{list.toDecide.length} left to decide</h2>
            {list.current && (
              <DecisionCard
                item={list.current}
                position={list.position}
                total={list.totalDecisions}
                whyOpen={whyFor(list.current.op.id)}
                onDecide={onDecide}
                onNextWording={onNextWording}
                onWhy={onWhy}
              />
            )}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {list.toDecide
                .filter((item) => item !== list.current)
                .map((item) => (
                  <li key={item.op.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(item.op.id)}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border border-line
                                 bg-paper-raised px-3 text-left text-[13px] leading-[18px] text-ink
                                 transition-colors duration-150 hover:bg-paper-sunken"
                    >
                      <CircleAlert aria-hidden className="h-4 w-4 flex-none text-gap" strokeWidth={1.5} />
                      <span>
                        <span className="font-semibold">{item.skill ?? "A line"}</span> · needs your OK
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        ) : (
          !list.pageFit && (
            <p className="m-0 rounded-lg border border-line bg-paper-raised p-4 text-[15px] font-semibold leading-[22px]">
              All decided. Covers {coverage.covered} of {coverage.total} · {pages}.
            </p>
          )
        )}

        <Group title="Decided" items={list.decided} whyFor={whyFor} onWhy={onWhy} onUndo={onUndo} />
        <Group title="Reworded for you" items={list.reworded} whyFor={whyFor} onWhy={onWhy} onUndo={onUndo} />
        <Group title="Removed to fit" items={list.removed} whyFor={whyFor} onWhy={onWhy} onUndo={onUndo} />
      </fieldset>
    </section>
  );
}

function Group({
  title,
  items,
  whyFor,
  onWhy,
  onUndo,
}: {
  title: string;
  items: ReviewItem[];
  whyFor: (opId: string) => boolean;
  onWhy: (opId: string) => void;
  onUndo: (opId: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <h2 className={groupHeading}>{title}</h2>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <ItemRow key={item.op.id} item={item} open={whyFor(item.op.id)} onWhy={onWhy} onUndo={onUndo} />
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Create `src/components/result/SummaryPanel.tsx`:**

```tsx
"use client";

import { Check, ChevronDown, CircleAlert, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import type { RequirementGroup, RequirementRow } from "@/lib/tailor/requirement-rows";
import type { Coverage } from "@/lib/tailor/types";

/**
 * The gain, and what the job asked for. Every row either lights its lines in
 * the resume or says in one short line why it cannot — a button that lights
 * nothing, or a row that looks like one and is not, is what this replaced.
 *
 * Wide, it is a sticky column. Below 1240px it folds into a strip above the
 * resume with the list behind "See requirements", so nothing is hidden.
 */
const COLLAPSED: Exclude<RequirementGroup, "to_decide">[] = ["covered", "skipped", "not_offered", "cannot_change"];

const TITLE: Record<Exclude<RequirementGroup, "to_decide">, (n: number) => string> = {
  covered: (n) => `${n} in your resume`,
  skipped: (n) => `${n} you skipped`,
  not_offered: (n) => `${n} not in your resume`,
  cannot_change: (n) => `${n} we can't change`,
};

const ICON: Record<RequirementGroup, { Icon: typeof Check; tone: string; label: string }> = {
  to_decide: { Icon: CircleAlert, tone: "text-gap", label: "Needs your OK" },
  covered: { Icon: Check, tone: "text-verified", label: "In your resume" },
  skipped: { Icon: Minus, tone: "text-ink-muted", label: "Skipped" },
  not_offered: { Icon: Minus, tone: "text-ink-muted", label: "Not in your resume" },
  cannot_change: { Icon: Minus, tone: "text-ink-muted", label: "Can't change" },
};

export function SummaryPanel({
  rows,
  coverage,
  selected,
  onSelect,
  className = "",
}: {
  rows: RequirementRow[];
  coverage: Coverage;
  selected: string | null;
  onSelect: (requirementId: string, opId: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [listOpen, setListOpen] = useState(false);

  // A requirement selected inside a collapsed group should stay visible.
  useEffect(() => {
    const group = rows.find((r) => r.requirement.id === selected)?.group;
    if (group && group !== "to_decide") setOpen((o) => ({ ...o, [group]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const toDecide = rows.filter((r) => r.group === "to_decide");

  const row = (r: RequirementRow) => {
    const icon = ICON[r.group];
    const label = r.group === "covered" && r.added ? "Added by you" : icon.label;
    const body = (
      <>
        <icon.Icon aria-hidden className={`mt-0.5 h-4 w-4 flex-none ${icon.tone}`} strokeWidth={1.5} />
        <span className="min-w-0">
          {r.requirement.label}
          <span className="sr-only"> — {label}</span>
          {r.reason ? (
            <small className="mt-0.5 block text-[12.5px] leading-[17px] text-ink-muted">{r.reason}</small>
          ) : null}
        </span>
      </>
    );
    const grid = "grid w-full grid-cols-[16px_minmax(0,1fr)] gap-2.5 px-2 py-2.5 text-[14px] leading-5";
    return (
      <li key={r.requirement.id} className="border-b border-line last:border-b-0">
        {r.pointsTo ? (
          <button
            type="button"
            aria-pressed={selected === r.requirement.id}
            onClick={() => onSelect(r.requirement.id, r.opId)}
            className={`${grid} min-h-11 cursor-pointer border-0 text-left text-ink transition-colors duration-150
                        hover:bg-paper-sunken ${selected === r.requirement.id ? "bg-paper-sunken" : "bg-transparent"}`}
          >
            {body}
          </button>
        ) : (
          <div className={`${grid} text-ink-muted`}>{body}</div>
        )}
      </li>
    );
  };

  return (
    <aside aria-label="What this job asks for" className={`rounded-lg border border-line bg-paper-raised p-4 font-ui ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="m-0 text-[13px] font-semibold leading-[18px] text-ink-muted">
            This job asks for {coverage.total} thing{coverage.total === 1 ? "" : "s"}
          </h2>
          <p className="m-0 mt-1 text-[26px] font-semibold leading-[30px] tracking-[-0.03em] tabular-nums">
            Covers {coverage.covered} of {coverage.total}
          </p>
          <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
            Your original covered {coverage.originalCovered}
            {coverage.covered === coverage.originalCovered ? " too" : ""}.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={listOpen}
          onClick={() => setListOpen((v) => !v)}
          className="hidden min-h-11 cursor-pointer items-center gap-1 border-0 bg-transparent px-2 text-[13px]
                     font-semibold text-ink underline underline-offset-[3px] max-[1240px]:inline-flex"
        >
          {listOpen ? "Hide requirements" : "See requirements"}
        </button>
      </div>

      <div className={listOpen ? "" : "max-[1240px]:hidden"}>
        {toDecide.length > 0 && (
          <div className="mt-4">
            <h3 className="m-0 px-2 text-[13px] font-semibold leading-[18px] text-ink-muted">Needs your OK</h3>
            <ul className="m-0 mt-1 list-none border-t border-line p-0">{toDecide.map(row)}</ul>
          </div>
        )}
        {COLLAPSED.map((group) => {
          const items = rows.filter((r) => r.group === group);
          if (!items.length) return null;
          const isOpen = open[group] ?? false;
          return (
            <div key={group} className="mt-3">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((o) => ({ ...o, [group]: !isOpen }))}
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent
                           px-2 text-left text-[13px] font-semibold leading-[18px] text-ink-muted"
              >
                {TITLE[group](items.length)}
                <ChevronDown
                  aria-hidden
                  className={`h-4 w-4 flex-none transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                  strokeWidth={1.5}
                />
              </button>
              {isOpen && <ul className="m-0 list-none border-t border-line p-0">{items.map(row)}</ul>}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 8: Create `src/components/result/ResultHeader.tsx`:**

```tsx
"use client";

import { Button } from "@/components/rezz/Button";
import { Wordmark } from "@/components/rezz/Wordmark";
import { box, offset } from "@/components/rezz/skin";

/**
 * The one bar of chrome, and the only place on this screen the drawn-ink skin
 * sits on something you do not press. One Download: secondary while anything is
 * undecided, primary once nothing is.
 */
export function ResultHeader({
  role,
  company,
  status,
  compare,
  onToggleCompare,
  ready,
  onDownload,
  canDownload,
  downloading,
}: {
  role: string;
  company: string;
  status: string;
  compare: boolean;
  onToggleCompare: () => void;
  ready: boolean;
  onDownload: () => void;
  canDownload: boolean;
  downloading: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-ink bg-paper-raised px-8 py-3 max-[900px]:px-4">
      <span className={`inline-flex flex-none items-center ${box} rounded-md bg-paper-raised px-3 py-1.5 ${offset}`}>
        <Wordmark />
      </span>
      <h1 className="m-0 min-w-0 truncate text-[15px] font-semibold leading-[21px]">
        {role} · {company}
      </h1>
      {/* Not a live region: the screen's sr-only region announces decisions. */}
      <p className="m-0 text-sm leading-5 text-ink-muted">{compare ? "Showing your original wording" : status}</p>

      <div className="ml-auto flex items-center gap-4">
        <button
          type="button"
          aria-pressed={compare}
          onClick={onToggleCompare}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2
                     font-ui text-sm font-medium leading-5 text-ink transition-colors duration-150 hover:bg-paper-sunken"
        >
          <span
            aria-hidden
            className={`relative h-4 w-7 flex-none rounded-full transition-colors duration-150 ${compare ? "bg-ink" : "bg-line-strong"}`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-paper-raised transition-all duration-150 ${compare ? "left-[14px]" : "left-0.5"}`}
            />
          </span>
          Compare with original
        </button>
        <Button variant={ready ? "primary" : "secondary"} onClick={onDownload} disabled={!canDownload || downloading}>
          {downloading ? "Writing your file…" : "Download resume"}
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 9: Verify types and lint.**

Run: `npx tsc --noEmit -p . && npm run lint`
Expected: both exit 0. The old components still exist and still compile, because nothing imports the new ones yet.

- [ ] **Step 10: Commit.**

```bash
git add src/components/rezz/Button.tsx src/components/result/WhyThisLine.tsx src/components/result/DecisionCard.tsx src/components/result/ItemRow.tsx src/components/result/PageFitCard.tsx src/components/result/ReviewList.tsx src/components/result/SummaryPanel.tsx src/components/result/ResultHeader.tsx
git commit -m "Add the review list, summary panel and header components

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wire the new screen and delete the old one

**Files:**
- Modify: `src/components/result/DefaultTemplateSheet.tsx`
- Rewrite: `src/components/result/ResultScreen.tsx`
- Delete: `src/components/result/DecisionBar.tsx`, `ResultMargin.tsx`, `ChangePopover.tsx`, `PageFitPrompt.tsx`, `JobPanel.tsx`
- Modify: `src/lib/tailor/coverage.ts`, `src/lib/tailor/coverage.test.ts` (remove `displayStatus`)
- Modify: `scripts/screenshots.mjs` (toggle name)

**Interfaces:**
- Consumes everything from Tasks 2–6.
- `DefaultTemplateSheet` gains `className?: string`. `onPageCount` is now called only once fonts are ready (Review Focus #1).

- [ ] **Step 1: Change `DefaultTemplateSheet`.** In `src/components/result/DefaultTemplateSheet.tsx`:

1. Add `className` to the props, both in the destructuring and in the type (`/** Grid placement from the screen, e.g. order at narrow widths. */ className?: string;`), and use it on the column div:
   `<div ref={columnRef} className={`relative flex flex-col gap-8 ${className ?? ""}`}>`.
   The column div must stay a direct child of the scroll grid, because the visible-page observer uses `column.parentElement` as its root. That is why this is a prop and not a wrapper div.
2. In `Line`, change `outline-line-strong` to `outline-ink` in the `active` class.
3. Report the page count only after the webfont has landed. Add state, and replace the existing fonts/`onPageCount` effects with these:

```tsx
  /* The first measurement is taken before the webfont lands, and fallback
     metrics wrap differently. Reporting it let the screen lock in "1 page" for
     a resume that is 2, then ask the user about a page they never added. */
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    const host = measureRef.current;
    if (!host) return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    let cancelled = false;
    const done = () => {
      if (cancelled) return;
      measure();
      setFontsReady(true);
    };
    if (document.fonts) document.fonts.ready.then(done);
    else done();
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    if (fontsReady) onPageCount?.(pages.length);
  }, [fontsReady, pages.length, onPageCount]);
```

- [ ] **Step 2: Rewrite `src/components/result/ResultScreen.tsx`:**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { session } from "@/lib/session";
import { coverageOf } from "@/lib/tailor/coverage";
import { downloadResume } from "@/lib/tailor/download";
import { requirementRows } from "@/lib/tailor/requirement-rows";
import { createReviewReducer, fromStored, toStored } from "@/lib/tailor/review";
import { decisionAnnouncement, reviewList, undoAnnouncement, withDecisions } from "@/lib/tailor/review-list";
import type { Layout, TailorPlan } from "@/lib/tailor/types";
import { buildLines } from "@/lib/tailor/view";
import { DefaultTemplateSheet } from "./DefaultTemplateSheet";
import { ResultHeader } from "./ResultHeader";
import { ReviewList } from "./ReviewList";
import { SummaryPanel } from "./SummaryPanel";

/**
 * The Result screen: see the value → make 0–3 decisions → finish.
 *
 * Layout and wiring only. What the user can do lives in `review.ts`, what the
 * screen shows in `review-list.ts` and `requirement-rows.ts`, both tested
 * without a browser. The design is docs/superpowers/specs/2026-09-29-result-screen-revamp-design.md.
 */
export function ResultScreen({
  layout,
  plan,
  company,
  role,
  resume = null,
  filename = null,
  sample = false,
}: {
  layout: Layout;
  plan: TailorPlan;
  company: string;
  role: string;
  /** The user's file, held in the browser. Absent when showing the sample. */
  resume?: string | null;
  filename?: string | null;
  sample?: boolean;
}) {
  const router = useRouter();
  const reducer = useMemo(() => createReviewReducer(plan.operations), [plan.operations]);
  /* Read once, in the initialiser: this only mounts in the browser (the loader
     renders a placeholder until the session is read), and hydrating in an
     effect raced the effect that persists. */
  const [state, dispatch] = useReducer(reducer, null, () => fromStored(session.getDecisions()));
  const [announcement, setAnnouncement] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    session.setDecisions(toStored(state));
  }, [state]);

  const operations = useMemo(() => withDecisions(plan.operations, state.decisions), [plan.operations, state.decisions]);
  const lines = useMemo(
    () => buildLines(layout, operations, state.decisions, state.compare, state.wordings),
    [layout, operations, state.decisions, state.compare, state.wordings],
  );
  const list = reviewList(plan, layout, state);
  const coverage = coverageOf(plan.requirements, plan.matches, operations);
  const rows = requirementRows(plan.requirements, plan.matches, operations);
  const highlightBlocks = rows.find((r) => r.requirement.id === state.selectedRequirement)?.pointsTo ?? null;

  const onPageCount = useCallback((pages: number) => dispatch({ type: "measuredPages", pages }), []);

  function decide(opId: string, approved: boolean) {
    const item = list.toDecide.find((i) => i.op.id === opId);
    dispatch({ type: "decide", opId, approved });
    setAnnouncement(decisionAnnouncement(item?.skill ?? null, approved, list.toDecide.length - 1));
  }

  function undo(opId: string) {
    const item = [...list.decided, ...list.reworded, ...list.removed].find((i) => i.op.id === opId);
    dispatch({ type: "undo", opId });
    setAnnouncement(item ? undoAnnouncement(item) : "");
  }

  function choosePageFit(optionId: string) {
    dispatch({ type: "choosePageFit", optionId, causedBy: list.pageFit?.causedBy ?? null });
    setAnnouncement(
      optionId.startsWith("remove:")
        ? "Line removed to fit."
        : optionId.startsWith("shorter:")
          ? "Using a shorter wording."
          : `Keeping everything. Your resume is now ${state.pages} pages.`,
    );
  }

  /** A changed line on the page opens its card, or its row's explanation. */
  function focusLine(opId: string) {
    if (list.toDecide.some((i) => i.op.id === opId)) dispatch({ type: "open", opId });
    else dispatch({ type: "why", opId });
  }

  async function download() {
    if (!resume) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      // Always the tailored version, whatever the compare toggle shows.
      const final = buildLines(layout, operations, state.decisions, false, state.wordings);
      const saved = await downloadResume(final, filename, company);
      session.setFinish({
        filename: saved.name,
        company,
        role,
        pages: saved.pages ?? state.pages,
        pagesBefore: layout.pages,
        covered: coverage.covered,
        total: coverage.total,
        originalCovered: coverage.originalCovered,
        reworded: list.reworded.filter((i) => i.state === "reworded").length,
        removed: list.removed.length,
        added: list.decided.filter((i) => i.state === "added").map((i) => i.text),
        operations,
      });
      router.push("/done");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not write your file.");
    } finally {
      setDownloading(false);
    }
  }

  const notice =
    downloadError || sample || !resume ? (
      <p
        role={downloadError ? "alert" : undefined}
        className={`m-0 rounded-lg border p-3 text-[13px] leading-[19px] ${
          downloadError ? "border-gap bg-gap-soft font-semibold text-gap" : "border-line bg-paper-raised text-ink-muted"
        }`}
      >
        {downloadError ??
          (sample ? (
            <>
              Showing a saved sample tailoring. <a href="/upload">Tailor your own resume</a> to download a file.
            </>
          ) : (
            <>
              Your decisions are safe, but this browser no longer has your file, so we can&rsquo;t write the
              download. <a href="/upload">Upload it again</a> to finish.
            </>
          ))}
      </p>
    ) : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ResultHeader
        role={role}
        company={company}
        status={list.status}
        compare={state.compare}
        onToggleCompare={() => dispatch({ type: "toggleCompare" })}
        ready={list.ready}
        onDownload={download}
        canDownload={Boolean(resume)}
        downloading={downloading}
      />

      {/* 220 · up to 794 (A4 at 96dpi, the page template_render.py draws) · 300.
          Below 1240 the summary folds into a strip above; below 900 the review
          list moves above the resume. Nothing is ever hidden. */}
      <div
        className="grid flex-1 content-start justify-center gap-8 overflow-y-auto bg-paper-sunken px-8 py-8
                   [grid-template-columns:220px_minmax(0,794px)_300px]
                   max-[1240px]:[grid-template-columns:minmax(0,1fr)_300px]
                   max-[900px]:[grid-template-columns:minmax(0,1fr)] max-[900px]:gap-4 max-[900px]:p-4"
      >
        <SummaryPanel
          className="self-start min-[1241px]:sticky min-[1241px]:top-0 max-[1240px]:col-span-2 max-[900px]:col-span-1"
          rows={rows}
          coverage={coverage}
          selected={state.selectedRequirement}
          onSelect={(requirementId, opId) => dispatch({ type: "selectRequirement", requirementId, opId })}
        />

        <DefaultTemplateSheet
          className="max-[900px]:order-3"
          layout={layout}
          lines={lines}
          activeOpId={state.currentOpId ?? list.current?.op.id ?? null}
          highlightBlocks={highlightBlocks}
          onSelect={focusLine}
          onPageCount={onPageCount}
        />

        <ReviewList
          className="self-start min-[901px]:sticky min-[901px]:top-0 min-[901px]:max-h-[calc(100dvh-8rem)]
                     min-[901px]:overflow-y-auto max-[900px]:order-2"
          list={list}
          state={state}
          coverage={coverage}
          notice={notice}
          onDecide={decide}
          onUndo={undo}
          onNextWording={(opId) => dispatch({ type: "nextWording", opId })}
          onOpen={(opId) => dispatch({ type: "open", opId })}
          onWhy={(opId) => dispatch({ type: "why", opId })}
          onChoosePageFit={choosePageFit}
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Delete the replaced components and `displayStatus`.**

```bash
git rm src/components/result/DecisionBar.tsx src/components/result/ResultMargin.tsx src/components/result/ChangePopover.tsx src/components/result/PageFitPrompt.tsx src/components/result/JobPanel.tsx
```

In `src/lib/tailor/coverage.ts`, delete the `DisplayStatus` type, the `displayStatus` function and its doc comment (everything after `pendingDecisions`). In `src/lib/tailor/coverage.test.ts`:
- remove `displayStatus` from the import;
- delete the whole `describe("displayStatus", …)` block.

Then confirm nothing else uses what was deleted:

Run: `grep -rn "displayStatus\|DisplayStatus\|JobPanel\|DecisionBar\|ResultMargin\|ChangePopover\|PageFitPrompt" src scripts`
Expected: no output.

- [ ] **Step 4: Update the screenshot script's toggle name.** In `scripts/screenshots.mjs`, change `name: /Compare wording/` to `name: /Compare with original/`.

- [ ] **Step 5: Verify.**

Run: `npm test && npx tsc --noEmit -p . && npm run lint`
Expected: all pass.

Then run `npm run dev`, open `http://localhost:3001/result` (it falls back to the sample fixture), and click through: Add it, Undo, Skip, Undo, then Compare with original. The app should throw no console errors.

- [ ] **Step 6: Commit.**

```bash
git add -A src/components/result src/lib/tailor/coverage.ts src/lib/tailor/coverage.test.ts scripts/screenshots.mjs
git commit -m "Rebuild the Result screen around one review list

Replaces the job panel's decision group, margin marks, popover and bottom
bar. Every decision can be undone, and the page-fit question shows at every
width. The page count is reported only after the webfont lands.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Browser check at four widths

This is a Playwright script that fails loudly if any control is missing at any width. That's the class of bug where the margin (and Undo, and page fit) vanished below 1240px.

**Files:**
- Create: `scripts/result-check.mjs`
- Modify: `package.json` (`"check:result": "node scripts/result-check.mjs"` in `scripts`)

**Interfaces:**
- Consumes the accessible names produced in Task 6:
  - "Skip {skill} line", "Add {skill} line to my resume";
  - "Undo adding {skill} line", "Undo skipping {skill} line";
  - "Download resume";
  - the page-fit heading "… makes it N pages." / "… runs to N pages."; the "Allow N pages" button;
  - the "All decided" text.

- [ ] **Step 1: Write the check.** Create `scripts/result-check.mjs`:

```js
/**
 * Drive the Result screen through a whole review at four window widths and
 * fail if any control is missing. Run the app first (`npm run dev`), then
 * `npm run check:result`. Screenshots land in screenshots/ (gitignored).
 *
 * Exists because the old margin — and with it Undo and the page-fit question —
 * silently disappeared below 1240px, and no test could see it.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { frontendPort, repoRoot } from "./ports.mjs";

const BASE = process.env.BASE ?? `http://localhost:${frontendPort}`;
const OUT = path.join(repoRoot, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const fixture = JSON.parse(fs.readFileSync(path.join(repoRoot, "fixtures/sample-plan.json"), "utf8"));
const WIDTHS = [1440, 1240, 1100, 880];
const failures = [];

function check(ok, what) {
  if (!ok) failures.push(what);
  console.log(`  ${ok ? "✓" : "✗"} ${what}`);
}

/** The sample, padded with repeated bullets until it runs past one page. */
function longLayout(layout) {
  const bullets = layout.blocks.filter((b) => b.kind === "bullet");
  const extra = Array.from({ length: 40 }, (_, i) => ({ ...bullets[i % bullets.length], id: `pad${i}` }));
  return { ...layout, blocks: [...layout.blocks, ...extra] };
}

async function openResult(browser, width, { layout = fixture.layout, decisions = null, theme = "light" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
  await context.addInitScript(
    ([result, stored, mode]) => {
      sessionStorage.setItem("rezz.result", result);
      sessionStorage.setItem("rezz.resume", "UEsDBBQAAAAI");
      sessionStorage.setItem("rezz.filename", "priya_resume.docx");
      if (stored && !sessionStorage.getItem("rezz.decisions")) sessionStorage.setItem("rezz.decisions", stored);
      const apply = () => document.documentElement?.setAttribute("data-theme", mode);
      apply();
      document.addEventListener("readystatechange", apply);
    },
    [JSON.stringify({ layout, plan: fixture.plan }), decisions ? JSON.stringify(decisions) : null, theme],
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(`page error at ${width}px: ${e.message}`));
  await page.goto(`${BASE}/result`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
  return { context, page };
}

async function visible(locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible());
}

const browser = await chromium.launch();

for (const width of WIDTHS) {
  console.log(`\n${width}px`);

  for (const theme of ["light", "dark"]) {
    const shot = await openResult(browser, width, { theme });
    await shot.page.screenshot({ path: path.join(OUT, `result-${width}-${theme}.png`) });
    await shot.context.close();
  }

  // ── A whole review ───────────────────────────────────────────────────────
  {
    const { context, page } = await openResult(browser, width);
    const add = page.getByRole("button", { name: /^Add .+ line to my resume$/ });
    const skip = page.getByRole("button", { name: /^Skip .+ line$/ });
    check((await visible(add)) && (await visible(skip)), "Skip and Add it are on screen");

    const before = await page.getByRole("button", { name: /^Undo (adding|skipping) .+ line$/ }).count();
    await add.first().dblclick();
    await page.waitForTimeout(450);
    const after = await page.getByRole("button", { name: /^Undo (adding|skipping) .+ line$/ }).count();
    check(after - before === 1, "a double click answers one question, not two");

    const undoAdd = page.getByRole("button", { name: /^Undo adding .+ line$/ });
    check(await visible(undoAdd), "an added line has Undo");
    await undoAdd.first().click();
    await page.waitForTimeout(450); // the undone line reopens as a new card
    check((await undoAdd.count()) === 0 && (await visible(add)), "Undo puts the line back to decide");

    await skip.first().click();
    await page.waitForTimeout(450);
    const undoSkip = page.getByRole("button", { name: /^Undo skipping .+ line$/ });
    check(await visible(undoSkip), "a skipped line has Undo");

    for (let i = 0; i < 10 && (await add.count()); i++) {
      await add.first().click();
      await page.waitForTimeout(450); // longer than the card's 350ms guard
    }
    const download = page.getByRole("button", { name: "Download resume" });
    check((await download.count()) === 1, "exactly one Download button");
    check(await visible(page.getByText(/^All decided\./)), "the list says all decided");
    await page.screenshot({ path: path.join(OUT, `result-${width}-ready.png`) });

    await page.route("**/api/download", (route) =>
      route.fulfill({ json: { file: Buffer.from("%PDF-1.4").toString("base64"), pages: 1 } }),
    );
    await download.click();
    const reached = await page.waitForURL("**/done", { timeout: 5000 }).then(() => true, () => false);
    check(reached, "Download goes to the finish screen");
    await context.close();
  }

  // ── Page fit: the resume outgrew what the user agreed to ─────────────────
  {
    const { context, page } = await openResult(browser, width, {
      layout: longLayout(fixture.layout),
      decisions: { decisions: {}, wordings: {}, pagesAllowed: 1, growthAllowed: false },
    });
    const heading = page.getByRole("heading", { name: /(makes it|runs to) \d+ pages\./ });
    check(await visible(heading), "the page-fit card is on screen");
    await page.screenshot({ path: path.join(OUT, `result-${width}-page-fit.png`) });
    await page.getByRole("button", { name: /^Allow \d+ pages$/ }).click();
    await page.waitForTimeout(200);
    check(!(await visible(heading)), "allowing the pages closes the card");
    await context.close();
  }

  // ── No false alarm: a long resume nobody has touched asks nothing ────────
  {
    const { context, page } = await openResult(browser, width, { layout: longLayout(fixture.layout) });
    const heading = page.getByRole("heading", { name: /(makes it|runs to) \d+ pages\./ });
    check(!(await visible(heading)), "a long resume with no decisions asks nothing about length");
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.log(`\n${failures.length} failed:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\nAll checks passed.");
```

Add to `package.json` `scripts`: `"check:result": "node scripts/result-check.mjs",`

- [ ] **Step 2: Run it against the app.**

Run, in two shells: `npm run dev`, then `npm run check:result`.
Expected: every line ✓ at all four widths, then "All checks passed.", exit 0.

**If it fails, fix the code, not the check.** The likely causes:
- a control hidden by a `max-[…]:hidden` class;
- a click swallowed by the 350ms guard because a wait was shortened;
- the page-fit card appearing on the untouched long resume. That means the `fontsReady` gate from Task 7 Step 1 isn't working; check that `onPageCount` isn't called anywhere else.

- [ ] **Step 3: Look at the screenshots.** Open `screenshots/result-*.png` and check each against the spec's Layout section:
- hairline cards;
- the ink skin only on the header and the buttons;
- no clipped button shadows or focus rings in the review list (it has `p-1` for this);
- the resume white in dark mode.

Fix anything that's off, then re-run Step 2.

- [ ] **Step 4: Commit.**

```bash
git add scripts/result-check.mjs package.json
git commit -m "Add a browser check for the Result screen at four widths

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Bring the UX spec in line, refresh the graph

`docs/03-ux-result-screen.md` is the product spec, and it still describes the bottom bar and the margin.

**Files:**
- Modify: `docs/03-ux-result-screen.md`

- [ ] **Step 1: Replace the `## Layout (desktop, 1440px)` section** from its heading down to, but not including, `## States`. Use this text:

```markdown
## Layout (desktop, 1440px)

*(29 Sep 2026: rebuilt around one review list. The job panel's decision group, the margin marks, the popover and the bottom decision bar are gone; they showed the same question in four places and only the bar let you answer it. Design: `docs/superpowers/specs/2026-09-29-result-screen-revamp-design.md`.)*

- **Header (the only chrome bar):** wordmark, "Backend Engineer · Kosha Payments", one status ("3 to decide · 1 page"), **Compare with original**, and one **Download resume**: secondary while anything is undecided, primary once nothing is.
- **Left, summary (220px, sticky):** "Covers 6 of 9 · Your original covered 3", then the requirements. Every row either lights its lines in the resume or says in one short line why it cannot ("Not in your resume, no line to offer", "You're in Bengaluru. We never change this."). "Needs your OK" is open; "in your resume", "you skipped", "not in your resume" and "we can't change" are collapsed.
- **Centre, the resume (A4 page, always white):** 794px (A4 at 96dpi) where the viewport allows, scaled down but A4-proportioned where it does not, margin held at the renderer's 50pt. Reworded and added lines highlighted; "Not in your resume" lines dashed coral. Clicking a changed line opens its card on the right and outlines the line.
- **Right, the review list (300px, sticky):** the page-fit card when the document has outgrown what you agreed to; then "N left to decide" with the current card open (*"Kafka isn't in your resume. Add this line to your Razorfin role?"*, the line, "Recruiters may ask you about it. Nothing is added unless you choose Add it.", **Skip / Add it** equal, nothing pre-selected, "Try another wording", "Why this line?"); then **Decided** ("Kafka · Added · Undo"), **Reworded for you** ("Reworded · Undo") and **Removed to fit** ("Keep it").
- **Pages:** the preview breaks where the file breaks: `template_render.py` moves a block whole to the next page, and the preview applies that rule to measured block heights. The page count is reported only after the webfont has loaded, and the first count is the length you are agreeing to.
- **Page fit:** when a change pushes the document past what you agreed to, the card offers, cheapest first: a shorter wording, a named line to remove, or allowing the extra page. Allowing a page agrees to that length only; growing again asks again. Undoing an Add brings back any line removed to fit it.
- **Changing your mind:** every decision stays in the list with Undo until you download. Undo returns a line to undecided; the list never re-asks on its own.
- **Compare with original:** shows the uploaded wording; the review list stays visible but disabled ("Turn off compare to make changes.").
- **Narrower windows:** below 1240px the summary folds into a strip above the resume ("See requirements"); below 900px the review list moves above the resume. Nothing is hidden at any width.
```

Then, in `## States`, change item 3 to: `3. **Ready:** all decided; the list reads "All decided. Covers 7 of 9 · 1 page." and Download turns primary.`

And in `## Accessibility`, change the last bullet to: `- Buttons name the skill ("Add Kafka line to my resume"); focus moves to the next decision card; every Undo is a button.`

- [ ] **Step 2: Refresh the knowledge graph** (a CLAUDE.md rule after code changes).

Run: `graphify update .`
Expected: completes without error.

- [ ] **Step 3: Final verification.**

Run: `npm test && npx tsc --noEmit -p . && npm run lint`, then (with `npm run dev` running) `npm run check:result`.
Expected: all pass, "All checks passed."

- [ ] **Step 4: Commit.**

```bash
git add docs/03-ux-result-screen.md
git commit -m "Bring the Result screen UX spec in line with the review list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
