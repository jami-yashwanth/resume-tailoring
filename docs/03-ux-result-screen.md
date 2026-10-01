# UX spec: the Result screen

The most important screen in Rezz. Built on the design canvas as `Desktop.dc.html` (interactive), with states in `WebGenerating`, `WebChanges` (ready) and `WebGaps` (finish).

## The screen's job

> "Show me my resume is better for this job, let me OK the risky bits, and let me download it, all in under 30 seconds."

Three moments: **see the value → make 0–3 decisions → finish.**

## Principles and evidence

| # | Principle | Evidence | For Rezz |
| --- | --- | --- | --- |
| 1 | Apply safe edits automatically; ask only about exceptions | Apple Proofread, VS Code auto-accept; NN/g: too many confirmations and people stop paying attention | Rewordings applied with undo only; only "Not in your resume" lines need a decision |
| 2 | Friction only where honesty is at stake | Microsoft HAX guidelines; Buçinca et al. 2021 (per-item decisions reduce rubber-stamping) | No "Add all" for unbacked lines; one small decision each |
| 3 | Show value before asking for effort | Google PAIR; goal-gradient effect | Lead with "Covers 6 of 9 (your original covered 3)" |
| 4 | Two levels of detail, no deeper | NN/g progressive disclosure | Level 1: the resume and the review list; level 2: "Why this line?" on a card or row |
| 5 | Explain with sources next to the claim | NN/g explainable AI; Linear "hover to see why" | "Based on your line: '…'" + the job phrase |
| 6 | Colour never the only signal | WCAG 1.4.1 | Colour + icon + text label; max 2 change types |
| 7 | No dark patterns at consent | India 2023 dark-pattern guidelines (unverified text) | Skip as prominent as Add it; no shaming copy; no re-asking after Skip |
| 8 | End on a high | Peak-end rule | A real "Your resume is ready" finish screen |

## Layout (desktop, 1440px)

*(1 Oct 2026: two panes. The requirements summary, the margin marks and the right-hand review list are gone; the resume itself, as sections, is where every decision is made. Design: `docs/superpowers/specs/2026-10-01-result-editor-design.md`. The 29 Sep single-list layout it replaces is in that spec's predecessor.)*

- **Header (the only chrome bar):** wordmark, "Backend Engineer · Kosha Payments", one status ("3 to decide · 1 page"; "checking pages…" while the printer counts; "page count unavailable" if it gives up), **Compare with original**, and one **Download resume**: secondary while anything is undecided, primary once nothing is, disabled while the count is unknown or the page-fit card is waiting.
- **Left pane, your resume as sections.** A coverage strip first: "Covers 6 of 9 · Your original covered 3 · See requirements" (the requirement rows open under it). Then the page-fit card when the file has outgrown what you agreed to. Then **Personal information** (name, contact) and one row per section in your order: a grip, the section's own heading, a count of what is waiting inside ("2 to decide · 1 reworded · 1 edited"), a chevron, and Move up / Move down. An open section shows each entry as labelled fields — Employer and Dates on one row, Title, Location — then its lines. Tap any of your own lines or fields to retype it in place: Enter commits, Escape cancels, leaving commits. A reworded line carries the highlighter and "Reworded · Undo"; a retyped one "Edited by you · Undo"; an added one "Added by you · Undo". A **"Not in your resume" draft is the decision card itself, sitting exactly where the line would join**: the question, the line, "Nothing is added unless you choose Add it", **Skip / Add it** at equal weight, "Try another wording", "Why this line?". Skipped drafts are listed once at the bottom with Undo. When nothing is left: "All decided. Covers 6 of 9 · 1 page."
- **Right pane, the page (A4, always white):** the live `ResumePage` (template C, serif single column), the same component Download prints, A4-proportioned and scaled to the pane. Reworded, edited and added lines highlighted; drafts dashed coral; lines removed to fit struck through. Clicking a marked line opens its section on the left and focuses its field or card.
- **Editing is yours, not the model's.** Your edits never go to the model and never change the coverage count; a requirement whose evidence you retyped says "You edited this line; tailor again to re-check". Section order and edits persist with your decisions until you download or start another tailoring.
- **Pages:** the page count is the printer's (docsvc `/print`, Chromium). Undecided drafts and lines removed to fit are not counted; the first count (your own resume plus the automatic rewordings) is the length you are agreeing to. Download waits for the count and never saves a file longer than agreed: it raises the page-fit card instead.
- **Page fit:** when a change pushes the file past what you agreed to, the card offers, cheapest first: a shorter wording, a named line to remove, or allowing the extra page. Removing a line frees its space. Allowing a page agrees to that length only; growing again asks again. A removal is filed under the Add that caused it, so undoing that Add brings the removed line back.
- **Changing your mind:** every decision and every edit stays undoable until you download. Undo returns a line to undecided; the screen never re-asks on its own.
- **Compare with original:** shows the uploaded wording, without rewordings or edits; the left pane is read-only ("Turn off compare to make changes.").
- **Narrower windows:** below 1100px the panes stack, sections above the page. Nothing is hidden at any width.

## States

1. **Tailoring** (~15 s): staged steps (read the job ✓, matched 6 ✓, rewording 7 lines…, checking it fits on 1 page), progress bar, faded resume placeholder.
2. **Review:** as above.
3. **Ready:** all decided; the list reads "All decided. Covers 7 of 9 · 1 page." and Download turns primary.
4. **Finish** (after download): file preview, "Your resume is ready for Kosha Payments", three checkable facts (7 of 9 requirements · 7 lines reworded · 1 line added by you), interview prep for each added line, "Tailor for another job".

## Deliberately not done

- No percentage match score; no score moving next to the decision buttons.
- No "Add all" for unbacked lines.
- No strike-through in the main view; no global disclaimer banner; no upsell pop-ups during review.

## Accessibility

- Icon + label + colour for every change type.
- Polite live region: "Kafka line added. 1 decision left."
- Buttons name the skill ("Add Kafka line to my resume"); every Undo is a button.
- Focus follows the review: to the next decision card; to "All decided" after the last one; to the open card (or "All decided") once a page-fit choice is made; to the reopened card after an Undo. Nothing is focused on first paint.
- The live region repeats a message said twice in a row.
- A "Not in your resume" line on the page is a button named "Needs your OK. Open this decision."; other changed lines are named "… Why this line changed."

## Metrics

| Metric | Target / warning |
| --- | --- |
| Taps to download | 1 with no flags; 1 + N with N flags |
| Median time to download | Under 30 s |
| Unbacked lines explicitly decided | 100%, enforced before they can be included |
| Add rate + time per decision | Adding nearly everything in under 1 s = rubber-stamping |
| Undo rate on reworded lines | Proxy for AI quality |
| Popovers opened | Whether explanations build trust |
| Post-task "Everything on this resume is true about me" | Trust / honesty signal |

## Still to verify from primary sources

Ladders recruiter eye-tracking (7.4 s), Apple HIG for generative AI, India CCPA/ASCI dark-pattern texts, Kivetz goal-gradient study.
