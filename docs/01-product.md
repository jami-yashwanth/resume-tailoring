# Product

## What Rezz is

An India-first AI resume tailor. The user uploads their **own** resume once (Word, PDF, LaTeX or LinkedIn PDF). For every job they add, Rezz gives back ~~their own file, in their own design~~ reworded for that job, rendered into v1's one default template — see the promise section and decision log below.

"Rezz" is the product name. "Sach" was an earlier working name and is no longer used. The product is **English only**.

## The promise

**Nothing added behind your back · No fake ATS score · No auto-renew · Your own design**

*(v1 override, 28 Sep 2026: "Your own design" doesn't hold while results render into one fixed template — see below. Decided 29 Sep 2026: the promise strip's fourth item reads **"One clean template"** for v1 — the landing page's "One clean template, no gallery" phrasing is confirmed where the longer form fits. "Your own design" returns when in-place editing ships.)*

- Rewordings of the user's own facts are applied automatically and can be undone.
- A line with a skill that isn't in the user's resume (e.g. Kafka) is drafted and shown as **"Not in your resume"**. It goes in only if the user taps **Add it**. Exactly two options: **Add it / Skip**, equal visual weight, nothing pre-selected.
- No 0–100 "ATS score". Show checkable facts instead: "Covers 7 of 9 job requirements (your original covered 3)", parse check, keywords found.
- Passes are paid once by UPI and never renew.
- The user's design is kept. Rezz never moves their resume into its own template without asking. **v1 override (28 Sep 2026):** suspended for now — see the decision log below and `CLAUDE.md`.

Earlier wording was "Never invents". It changed on 28 Sep 2026 when the Add it flow was decided; don't use "Never invents" or "We added nothing you didn't do" anywhere.

## Why this can win

- ~13 of 15 mainstream tools (Teal, Rezi, Kickresume, Enhancv, Huntr, Careerflow, Jobright, Simplify, Indeed, Naukri, Zety, Resume.io…) re-import the resume into their own templates. Only Jobscan claims to keep layout (untested). **Tailoring the user's own file in place is an open gap** — v1 doesn't claim this gap yet (see decision log, 28 Sep 2026), it's the differentiator to return to once in-place editing is solved.
- No tool asks before inserting a skill the user lacks. Scoring-first tools insert keywords in one click; honesty advice sits in blogs.
- Users distrust the category: invented skills, fake ATS scores, generic AI voice, billing traps. Rezz answers each one directly.

## Who it's for (in order)

1. Working professionals with 1–6 years' experience switching jobs (IT, analytics, product, ops). Loudest pain, some already pay Naukri, apply on laptops.
2. Final-year students and freshers (about 1.1 crore graduates a year).
3. Later: government/PSU biodata formats, colleges and staffing firms (B2B).

## Workflow goal: as little human effort as possible

- First time: upload the resume. That's it.
- Every job: add the job (paste, link, screenshot, or the Chrome extension) → about 15 seconds → review (optional) → download.
- With no flagged lines, it's **1 tap** to download. With N flagged lines, **1 + N taps**.

## Pricing (to test)

| Pass | Price | What you get |
| --- | --- | --- |
| Free | ₹0 | 10 tailored resumes a week (rolling 7 days, sign in after the first), honest check ~~, your own design~~ (v1: one clean template, see decision log) |
| Sprint | ₹149 | 15 tailored resumes, 30 days |
| Job-hunt | ₹399 | Unlimited tailored resumes (fair use), 90 days |

- Paid once by UPI on the web (avoids app-store markup; LinkedIn charges ~82% more in its Android app than on web).
- Nothing auto-renews. The receipt says "does not renew".
- Launch free with caps; Google / magic-link sign-in on the second tailoring stops abuse (1 Oct 2026; phone OTP returns with passes).
- Cost per tailored resume on the Claude API is roughly ₹3–6 (see 05-architecture.md). At ₹6, the ₹149 / 15 pack is thin after 18% GST: either measure and bring cost down with a cheaper model where quality holds, or reduce the pack.

## Decision log

| Date | Decision |
| --- | --- |
| 25 Sep 2026 | Build a narrow, India-first resume tailor, not a generic PDF suite. |
| 25 Sep 2026 | Consumer first; recruiter/staffing B2B later. Research showed basic CV formatting for agencies is crowded (15+ tools, ~$0.40–1 per CV). |
| 25 Sep 2026 | Edit the user's own file in place (their design kept). |
| 25 Sep 2026 | Low-effort workflow: changes applied automatically, review optional. |
| 25 Sep 2026 | The $100 Claude Max plan can't power the product; use the Claude API. |
| 25 Sep 2026 | Name: Rezz. English only. |
| 25 Sep 2026 | Visual direction "paper and highlighter"; design system built. |
| 28 Sep 2026 | Rezz may draft lines with skills the user lacks, shown as "Not in your resume", inserted only on **Add it**. Two options only: Add it / Skip. |
| 28 Sep 2026 | Promise wording: "Nothing added behind your back". |
| 28 Sep 2026 | Reconsidered offering standard templates for badly-formatted source resumes; kept the own-design rule. Scoped the ATS-safe second download (see 05-architecture.md) as separate future work rather than a general template catalogue. |
| 28 Sep 2026 | **Supersedes the row above, same day.** Reviewed Kickresume's dashboard/editor (see `09-competitor-kickresume.md`'s editor walkthrough) while scoping a resume library; decided to ship v1 simpler instead — upload → job → result, where the result renders into **one** default Rezz template with tailoring changes applied, rather than editing the user's file in place. Own-design rule suspended, not deleted; see `CLAUDE.md`'s dated override. No template gallery, no multi-resume library, no accounts — that's all shelved for a later pass. Revisit the own-design rule once in-place editing (subset PDF fonts, LibreOffice page-fit, per `05-architecture.md`) is solved. |
| 28 Sep 2026 | Result screen = resume in the centre with change marks, job checklist on the left, one-at-a-time decision bar at the bottom. "Compare with original" toggle approved. |
| 28 Sep 2026 | Web first; no mobile work until decided. |
| 29 Sep 2026 | The default template never splits a block across a page break — a bullet broken across the fold reads as a typesetting failure. Applies to the downloaded file and to the preview, which paginates by the same rule. |
| 29 Sep 2026 | Result screen preview is a true A4 page rather than a 620px sheet, matching what `template_render.py` renders. A preview narrower than the page wraps lines the downloaded file does not, which undercuts the screen's whole job of showing what you are about to get. Supersedes the 620px figure in `03-ux-result-screen.md`. |
| 29 Sep 2026 | The default template's numbers live in `shared/template.json`, read by both `template_render.py` and `template-metrics.ts`. They were two hand-kept copies (three with the renderer's tests) and had already drifted — that drift is what made the preview's headings smaller than its own body text and its bullets 29% looser than the PDF's. |
| 29 Sep 2026 | Template researched against how resume parsers actually read a document (Workday, iCIMS, Greenhouse, Taleo, Sovren, Daxtra). They are text extractors that **segment on section headings**, not scorers: a heading they don't recognise means that section's fields come back empty. Three changes followed — section headings are 12pt so they outrank the 10.5pt body; a job header is two lines (employer + location + dates bold, then the title) instead of three bold lines; and a role's right-aligned dates are drawn as one padded text run, because two separately-positioned runs carry no whitespace in the PDF content stream and extractors variously glue, separate or drop them. Net effect on length is negative: ~14pt saved per entry. |
| 29 Sep 2026 | The default template renders in Helvetica/Arial on screen as well as in the file, replacing Geist on the preview sheet. Measured: Geist set the same text 1.8% wider than the base-14 Helvetica the PDF draws with, so the preview wrapped lines the download did not. Also honest about the type rule — the sheet is not Rezz talking, so it should never have been in the app's own face. Still not `--font-doc`: under the v1 override there is no original file to take a font from. New token `--font-sheet`. |
| 29 Sep 2026 | Section headings are renamed to the standard vocabulary (Experience / Education / Skills / Projects / Summary / Certifications / Achievements) on an **exact** synonym match, never a fuzzy one, and otherwise left exactly as written. Each rename is an ordinary rewording: applied automatically, shown with the highlighter, undoable in the review list. It cannot move the coverage count — a heading is not one of the job's asks. |
| 29 Sep 2026 | "No stranded headings" (`05-architecture.md`) is now actually implemented: a heading only stays on a page if one line of its section fits under it. It had been documented and never built. |
| 28 Sep 2026 | ₹399 pass = unlimited (fair use) for 90 days. |
| 28 Sep 2026 | Web type pairing chosen on the canvas: Bricolage Grotesque (headlines) + Geist (UI) + Geist Mono. The design-system tokens still list Literata / Hind / IBM Plex Mono and need updating to match. |
| 28 Sep 2026 | **Supersedes the row above.** Bricolage Grotesque dropped. One family for the app (Geist + Geist Mono); the serif is reserved for the user's own document. The rule is "sans is Rezz talking, serif is what you wrote", so the type system carries the promise. |
| 28 Sep 2026 | `--link` retired (links are ink + underline); dark-theme `action` no longer borrows the highlighter, which means only "this text changed". |
| 28 Sep 2026 | Landing page built first, in `src/`, to establish the design system in code. CTAs are dead links and there is no analytics, so the price test cannot run yet. |
| 29 Sep 2026 | Landing truth pass: every claim on the page now matches what v1 does. Dead anchors removed (extension CTA, footer contact); paid pass cards state "Passes open soon — you'll pay at download" instead of carrying a dead buy button; upload copy says PDF/DOCX only; JD copy says paste only until the link fetcher ships; `/privacy` and `/terms` exist as short true pages. Promise-strip replacement confirmed: "One clean template". |
| 29 Sep 2026 | The saved sample result is a deliberate demo, reachable only as `/result?demo` (linked from the landing hero as "See a sample result"). A cold visit to `/result` goes back to the start of the flow instead of showing a stranger's sample. |
| 29 Sep 2026 | Every missing, non-knockout requirement reaches the user as a drafted line they can Add — "Not in your resume, no line to offer" is no longer a state the planner may choose. The prompt requires a draft with each needs_ok, and a deterministic fallback ("Familiar with X.", no numbers, dropped first by the fitter) covers what the planner or the verifier's downgrade leaves unanswered. Knockouts, degree/location kinds, and digit-bearing labels are still never drafted. |
| 29 Sep 2026 | Placement is part of the claim, so fallback drafts land where the claim is honest: skill-kind lines go to the Skills section, experience-kind under the most recent role, the document's tail only as a last resort. The decision card names the destination ("Add this line to your Skills?" vs "…your Razorfin role?"). We do **not** ask the user to pick a section — that would break the two-option Add it / Skip pair and the 1+N-taps effort model; a non-blocking "Move to…" affordance is the escape hatch to consider if funnel data shows placement-driven skips. |
| 29 Sep 2026 | Default template re-cut against the owner's ATS-safe LaTeX reference (a Jake's-resume variant), replacing the generated-template look: centered 25pt bold name over a centered ink contact line with pipe separators, 14pt bold caps headings with a solid ink rule (the faint gray hairline was itself a tell), italic job titles, a small gap between job entries, 40pt margins, tighter leading throughout. All numbers still flow through `shared/template.json` to both renderers, so preview/file pagination parity holds. Body stays ≥10pt (the reference's 9pt \small was not adopted); A4 kept over the reference's letterpaper. |
| 29 Sep 2026 | Templates-as-data direction validated: the owner's reference .tex compiles through Tectonic in docsvc at ~0.5s warm, output identical to the reference (Roboto, small caps, real en-dashes), user text LaTeX-escaped, shell-escape off. Wired into `/render-template` behind `REZZ_LATEX_TEMPLATE=true` (exact string), with the drawn template as automatic fallback on any failure — the download can never break because of the flag. Known cost while on: the HTML preview paginates by the drawn template's metrics, so preview and file page counts can differ; the download returns the compiled (true) count. Preview-from-compiled-pages (image + clickable overlays) is the follow-up when multi-template becomes real. |
| 30 Sep 2026 | The LaTeX template IS the template (owner's call: "match exactly... whatever latex i keep, the same should reflect"). `templates/rezz.tex` stores the owner's pasted reference verbatim — one licensed change, letterpaper→a4paper (India-first, re-confirmed) — guarded by a byte-level golden test; pdfTeX-only lines are neutralised at compile time by `latex_render.compat()`, never edited into the file, which is the seam future user-uploaded templates plug into. Compilation is now the default `/render-template` path (`REZZ_LATEX_TEMPLATE` survives only as an off switch, "false"), tectonic ships in the docsvc image (pinned, sha256-checked, bundle pre-warmed at build). `shared/template.json` was re-measured off the compiled PDF (36pt margins, 9pt \small items, per-pair gap table, Roboto webfont in the preview) and docsvc's `test_latex_parity.py` recompiles and re-measures on every run so the numbers cannot drift. The 29 Sep re-cut's "body stays ≥10pt" concession is superseded: exact match wins. The Result screen gains an "Exact PDF" switch — the compiled file's own pages (server-rasterised, ~0.5s per refresh, debounced per decision), which also closes the known preview-parity cost logged below. |
| 1 Oct 2026 | **Gate moves from download to the tailoring button, and passes leave the flow.** Launch is free: the first tailoring per browser needs no sign-in, the second asks for Google or an email magic link (no passwords, no phone OTP), and a signed-in user gets 10 tailorings in any rolling 7 days. Downloads are never gated. A `tailorings` ledger in Postgres (Neon, Drizzle) records who, when, company, role and cost — never the resume or job text — and is how usage gets counted. Passes stay "open soon" until the ledger says what to charge. Spec: `docs/superpowers/specs/2026-10-01-free-tier-and-sign-in-design.md`. |
| 1 Oct 2026 | **Supersedes the 30 Sep LaTeX row.** The one template is now a single HTML/CSS component, `ResumePage` (Source Serif 4, self-hosted): the Result screen previews it live and docsvc prints the same HTML to PDF with headless Chromium (`POST /print`), so the preview and the file are one layout and the page count the user agrees to is the printer's. The LaTeX path (tectonic, `templates/rezz.tex`, the measured replica, the PNG "Exact PDF" preview) is retired; the drawn PyMuPDF template stays only as the never-blank fallback, and its page counts never become the agreed length. The rules are unchanged: one template, nothing added behind your back, page count never grows without asking. |

## Guardrails that stay regardless

- Never invent numbers or outcomes ("Cut latency by 40% using Kafka" is never drafted for an unbacked skill).
- Modest verbs for unbacked lines ("worked with", "consumed"), nothing above the user's seniority.
- Never fake knockouts: years of experience, degree, location, work authorisation.
- Every line added via Add it gets interview prep after download, and keeps its "Not in your resume" tag if suggested again for another job.
- Keep a claim log: what was added, when, and that the user accepted it. Terms of service say the user is responsible for what they accept.
- Never auto-apply to jobs; never automate LinkedIn, Naukri or Indeed pages.
