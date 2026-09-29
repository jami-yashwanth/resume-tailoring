# Result screen revamp: design

Date: 29 Sep 2026 · Status: approved in conversation, awaiting spec review
Supersedes the layout and interaction parts of `docs/03-ux-result-screen.md`. That doc is updated to match as part of the implementation. Its principles, metrics and "deliberately not done" list still hold.

## Why

The current screen has four kinds of problem.

**Things it gets wrong:**
- An Add can't be undone, and neither can a Skip.
- Clicking a flagged line opens an explanation with no way to decide on that line.
- Below 1240px the margin is hidden, and with it the popover, Undo and the page-fit prompt. The resume can then grow a page without asking.

**Things that repeat or contradict each other:**
- The same pending question appears in four places: the header, the job panel, the margin and the bottom bar. Only the bottom bar lets you act on it.
- The job panel can list "Needs your OK" rows that have no decision behind them.
- Some requirement rows are clickable and some aren't, with no visible difference or reason given.

**Things that look wrong:**
- The preview shows double bullets ("• •"). `template_render.py` already strips the source bullet glyph, but the preview doesn't.
- Heavy boxes compete with the resume.
- The job panel's notes are cut off mid-sentence.
- The bottom bar puts the question and its buttons about 1,100px apart.

**The code behind it:**
- `ResultScreen.tsx` is 593 lines holding all state, the page-fit logic and the download.

## Decisions made

1. **Direction A2:** one review list you work down, beside the resume. It replaces the job panel's decision group, the margin marks, the popover and the bottom bar.
2. **Skin:** the drawn-ink skin (2px ink border, hard offset shadow, from `skin.ts`) is kept only for the header and for things you press: the wordmark, Download, Skip / Add it, Undo and the page-fit button. Cards, the review list and the summary use 1px `line` hairlines. The resume keeps `shadow-sheet`.
3. **Changing your mind:** decided items stay in the list as one-line rows with Undo. The resume shows no trace of a skipped line. The list never re-asks on its own; only the user's Undo brings a line back to undecided.

## Layout

The screen is designed at 1440px. Columns: summary 220px · resume up to 794px (A4 at true size, unchanged) · review list 300px. The summary and the review list are sticky within the scroll area.

### Header (the only chrome bar)

- Wordmark, then `{role} · {company}`, then one plain status: "3 to decide · 1 page", or "All decided · 1 page".
- "Compare with original" toggle. It is plain, without the ink skin, because it is a view switch rather than an action.
- One **Download resume** button: `secondary` while decisions are pending, primary when none are. There is no second Download anywhere.
- The bottom decision bar is removed.

### Left: summary

- "This job asks for N things", then "Covers X of N", then "Your original covered Y."
- The requirement rows come from `requirementRows()`. Every row either:
  - points at a line: clicking it outlines that line, dims the rest, and opens its card if it has one; or
  - is plain text with a one-line reason: "Not in your resume, no line to offer" (no drafted line survived), "You're in Bengaluru. We never change this." (knockout), or "Already in your resume" when there is nothing to point at.
- Groups: undecided requirements first, open by default. Then "N in your resume", "N you skipped", "N not in your resume" and "N we can't change", each collapsed.
- A note is one short line, capped at about 90 characters and cut at a word boundary. The planner's long note is only ever shown in full inside a card's "Why this line?".

### Centre: the resume

- `DefaultTemplateSheet`, unchanged apart from two things:
  1. Clicking a changed line opens its card in the review list, not a popover.
  2. The active line gets an ink outline.
- Pending lines are dashed `gap`; added and reworded lines are highlighted.
- Bullet glyphs: `buildLines` strips leading bullet characters from bullet text using the renderer's own set, `BULLET_CHARS = "•◦▪‣·-*"`, the same way the renderer does (`lstrip` of those characters plus spaces). The preview and the PDF then agree.

### Right: review list

In order:

1. **Page-fit card.** Shown only when the document is longer than `pagesAllowed` and growth hasn't been allowed.
   - Heading: "That line makes it 2 pages." Then: "Your resume was 1 page. Nothing is dropped unless you choose it."
   - Options, cheapest first: a shorter wording (only if one exists), up to two named lines to remove, then "Keep everything, allow 2 pages".
   - The first option is pre-selected. That's allowed here because this is a layout trade-off, not an honesty decision.
   - It sits at the top of the list and is visible at every width.
2. **Left to decide.**
   - Heading: "N left to decide".
   - One open card, the current decision:
     - tag "Needs your OK · 2 of 3";
     - the question "{Skill} isn't in your resume. Add this line to your {Employer} role?";
     - the drafted line;
     - "Recruiters may ask you about it. Nothing is added unless you choose Add it.";
     - **Skip / Add it**: identical `secondary` buttons, equal width, nothing pre-selected, labelled "Skip {skill} line" and "Add {skill} line to my resume";
     - below the buttons, "Try another wording (1 of 3)" and "Why this line?". The second expands the planner's reason, "Based on your line: …" and "The job says: …" inside the card.
   - Every other pending item is a one-line row "{Skill} · needs your OK". Clicking one opens it as the current card.
   - The current card is the one opened by clicking a line, a row or a summary requirement. Otherwise it is the first pending item in document order.
3. **Decided.** One row per insert: "{Skill} · Added · Undo" or "{Skill} · Skipped · Undo".
4. **Reworded for you.** One row per rephrase: "Reworded · Undo", or "Your original · Use the rewording". Clicking the row opens "Why this line?" for it.
5. **Removed to fit.** One row per removal the user chose: "Removed to fit · Keep it".

When nothing is pending and there is no page-fit card, the list opens with "All decided. Covers X of N · 1 page."

### Narrower windows

- **900–1240px:** the summary folds into a strip above the resume, showing the coverage line plus a "See requirements" disclosure. The review list stays on the right.
- **Below 900px:** the review list moves above the resume, as a full-width stack.
- Nothing is hidden at any width. Mobile layouts stay out of scope, per CLAUDE.md; this only covers narrow desktop windows.

## Behaviour

| User does | Result |
| --- | --- |
| Add it / Skip | Decision stored. Row moves to Decided. Next pending card opens and its heading gets focus. Polite announcement: "Kafka line added. 1 decision left." |
| Undo on Added or Skipped | Decision cleared back to undecided. The item returns to Left to decide and opens as the current card. |
| Undo on Reworded | Rephrase set to `false`, so your original text is back. The row becomes "Your original · Use the rewording". |
| Undo an Add that caused a page-fit removal | Any removal the user chose to fit that Add is cleared too. It was only made to make room. |
| An Undo makes the resume too long again | The page-fit card returns and asks again. It never decides on its own. |
| Compare with original | Shows the uploaded wording. The review list stays visible but disabled, with "Turn off compare to make changes." |
| Refresh | Everything is restored from sessionStorage in the same shape as today (`decisions`, `wordings`, `pagesAllowed`, `growthAllowed`). |

## Code structure

**New pure modules, with no React:**

- `src/lib/tailor/review.ts`
  - `reviewReducer(state, action)`.
  - State: `{ decisions, wordings, pagesAllowed, growthAllowed, currentOpId, selectedRequirement, compare, removedFor }`. `removedFor` maps an insert op to the removals chosen to fit it, and is what drives the linked undo.
  - Actions: `decide`, `undo`, `nextWording`, `open`, `selectRequirement`, `choosePageFit`, `toggleCompare`, `measuredPages`.
  - Only `decisions`, `wordings`, `pagesAllowed`, `growthAllowed` and `removedFor` are persisted. `removedFor` is optional on load, so old sessions still parse.
- `reviewList(plan, state, pages)` returns `{ toDecide, current, decided, reworded, removed, pageFit, status, ready }`. It is the only source for the header status, the review list and the announcements.
- `requirementRows(plan, operations)` returns rows of `{ requirement, group, pointsTo: blockId[] | null, reason }`. It replaces `displayStatus`'s use in the panel and the `not_offered` patch made earlier today.
- `pageFitOptions` and `shorterWording` move here from `ResultScreen.tsx`.
- `src/lib/tailor/download.ts`: `downloadResume(lines, …)`, the fetch and file handling moved out of the component.

**Components in `src/components/result/`:**

- **Kept or rewritten:**
  - `ResultScreen`: layout and wiring only, target about 150 lines.
  - `ResultHeader`.
  - `SummaryPanel`, replacing `JobPanel`.
  - `ReviewList`, containing `DecisionCard`, `ItemRow` (decided, reworded and removed rows) and `PageFitCard`.
  - `DefaultTemplateSheet`, with the click wiring change only.
  - `ResultLoader`, unchanged.
- **Deleted:** `DecisionBar`, `ResultMargin`, `ChangePopover`, `PageFitPrompt`.
- **Not deleted:** `useMarginAnchors` and `rezz/MarginColumn`. The landing page still uses them.

**Unchanged:** the pipeline, planner, rules, `/api/download`, `template_render.py`, and the finish screen's `session.setFinish` payload.

## Testing

- **Unit tests (Vitest), written before the code:**
  - reducer: undo in each state; the page-fit-then-undo linked removal; overflow returning after an undo; loading a session that has no `removedFor`;
  - `reviewList`: grouping, current-card selection, status copy;
  - `requirementRows`: pointing and reason rules, knockouts, no drafted line;
  - `pageFitOptions`;
  - the bullet strip.
- **Existing tests:** `coverage`, `view` and `paginate` still pass. `displayStatus` tests are updated or removed with its panel use.
- **Playwright** (`scripts/screenshots.mjs`, extended):
  - widths 1440, 1240, 1100 and 880, in light and dark;
  - flow: pending → Add → Undo → Skip → page fit → ready → Download;
  - the run fails if Skip, Add it, Undo or the page-fit card can't be found at any width.
- **Accessibility:**
  - focus moves to the next card after each decision;
  - Escape collapses "Why this line?";
  - buttons name their skill;
  - each decision is announced once;
  - 44px targets.

## Out of scope

- Planner changes that would draft lines for more gaps.
- The finish screen.
- Any second template.
- Mobile.
