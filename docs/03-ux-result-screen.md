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
| 4 | Two levels of detail, no deeper | NN/g progressive disclosure | Level 1 clean resume with marks; level 2 popover |
| 5 | Explain with sources next to the claim | NN/g explainable AI; Linear "hover to see why" | "Based on your line: '…'" + the job phrase |
| 6 | Colour never the only signal | WCAG 1.4.1 | Colour + icon + text label; max 2 change types |
| 7 | No dark patterns at consent | India 2023 dark-pattern guidelines (unverified text) | Skip as prominent as Add it; no shaming copy; no re-asking after Skip |
| 8 | End on a high | Peak-end rule | A real "Your resume is ready" finish screen |

## Layout (desktop, 1440px)

- **Header:** wordmark, breadcrumb, **Compare with original** toggle, **Download resume** (secondary while decisions are pending, primary when ready).
- **Status bar:** "7 lines reworded · 2 need your OK", an undo message after each decision (polite live region), page meter "Page 1 of 1 · 92% full".
- **Left, "This job" (280px):** the gain ("Covers 6 of 9"), then requirements in three groups instead of one flat list. "Needs your OK" is open by default — it's the only group with a decision in it. "Already in your resume" and "Can't change" (e.g. "Based in Pune, on-site — You're in Bengaluru. We never change this.") sit collapsed behind a disclosure row, since there's nothing to do with them; expanding either reveals the same status rows: ✓ matched · ! needs your OK · – can't change. Clicking a requirement highlights its line and dims the rest, and auto-expands its group if collapsed.
- **Centre, the resume (620px sheet, always white):** reworded lines highlighted; "Not in your resume" lines dashed coral. Right margin (280px) shows small labels ("Reworded", "Needs your OK", "Added by you", "Removed to fit").
- **Popover on click:** reason, "Based on your line", "The job says", source tag, **Undo · Try another wording · Edit**.
- **Bottom decision bar:** one decision at a time, "1 of 2 · needs your OK": *"Kafka isn't in your resume. Add this line to your Razorfin role?"* + the line + "Recruiters may ask you about it. Nothing is added unless you choose Add it." Buttons **Skip / Add it**, equal.
- **After Add it:** the added line's popover opens with the page-fit choice (default: remove the least relevant line; alternatives: another line, or allow 2 pages).
- **Ready:** the bar becomes "Ready. Covers 7 of 9 requirements · 1 page." + Download.
- **Compare with original:** flips the whole resume to the uploaded version; hides marks, pending lines and popovers. Approved as is.

## States

1. **Tailoring** (~15 s): staged steps (read the job ✓, matched 6 ✓, rewording 7 lines…, checking it fits on 1 page), progress bar, faded resume placeholder.
2. **Review:** as above.
3. **Ready:** all decisions made.
4. **Finish** (after download): file preview, "Your resume is ready for Kosha Payments", three checkable facts (7 of 9 requirements · 7 lines reworded · 1 line added by you), interview prep for each added line, "Tailor for another job".

## Deliberately not done

- No percentage match score; no score moving next to the decision buttons.
- No "Add all" for unbacked lines.
- No strike-through in the main view; no global disclaimer banner; no upsell pop-ups during review.

## Accessibility

- Icon + label + colour for every change type.
- Polite live region: "Kafka line added. 1 decision left."
- Buttons name the skill ("Add Kafka line to my resume"); focus moves to the next pending decision; undo reachable by keyboard.

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
