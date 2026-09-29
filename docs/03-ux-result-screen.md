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

*(29 Sep 2026: rebuilt around one review list. The job panel's decision group, the margin marks, the popover and the bottom decision bar are gone; they showed the same question in four places and only the bar let you answer it. Design: `docs/superpowers/specs/2026-09-29-result-screen-revamp-design.md`.)*

- **Header (the only chrome bar):** wordmark, "Backend Engineer · Kosha Payments", one status ("3 to decide · 1 page"), **Compare with original**, and one **Download resume**: secondary while anything is undecided, primary once nothing is, and disabled while the page-fit card is waiting for an answer (the status then reads "Choose how it fits · 2 pages").
- **Left, summary (220px, sticky):** "Covers 6 of 9 · Your original covered 3", then the requirements. Every row either lights its lines in the resume or says in one short line why it cannot ("Not in your resume, no line to offer", "You're in Bengaluru. We never change this."). "Needs your OK" is open; "in your resume", "you skipped", "not in your resume" and "we can't change" are collapsed.
- **Centre, the resume (A4 page, always white):** 794px (A4 at 96dpi) where the viewport allows, scaled down but A4-proportioned where it does not, margin held at the renderer's 50pt. Reworded and added lines highlighted; "Not in your resume" lines dashed coral. Clicking a changed line opens its card on the right and outlines the line.
- **Right, the review list (300px, sticky):** the page-fit card when the document has outgrown what you agreed to; then "N left to decide" with the current card open (*"Kafka isn't in your resume. Add this line to your Razorfin role?"*, the line, "Recruiters may ask you about it. Nothing is added unless you choose Add it.", **Skip / Add it** equal, nothing pre-selected, "Try another wording", "Why this line?"); then **Decided** ("Kafka · Added · Undo"), **Reworded for you** ("Reworded · Undo") and **Removed to fit** ("Keep it").
- **Pages:** the preview breaks where the file breaks: `template_render.py` moves a block whole to the next page, and the preview applies that rule to measured block heights. The page count is the downloaded file's: undecided "Not in your resume" drafts and lines removed to fit are drawn on the preview but not counted. It is reported only after the webfont has loaded, and the first count (your own resume plus the automatic rewordings) is the length you are agreeing to.
- **Page fit:** when a change pushes the file past what you agreed to, the card offers, cheapest first: a shorter wording, a named line to remove, or allowing the extra page. Removing a line frees its space. Allowing a page agrees to that length only; growing again asks again. A removal is filed under the Add that caused the overflow, so undoing that Add brings the removed line back, even when a rewording sits further down the page.
- **Changing your mind:** every decision stays in the list with Undo until you download. Undo returns a line to undecided; the list never re-asks on its own.
- **Compare with original:** shows the uploaded wording; the review list stays visible but disabled ("Turn off compare to make changes.").
- **Narrower windows:** below 1240px the summary folds into a strip above the resume ("See requirements"); below 900px the review list moves above the resume. Nothing is hidden at any width.

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
