# Open items

## Decisions still needed
- Data-policy FAQ: a draft is on the landing page, marked "[Draft: confirm storage region and deletion time]". Needs real hosting and legal answers.
- Final ₹149 pack size once real per-resume AI cost is measured (15 vs 10).
- `design/design-system/tokens.json` and `bundle.css` are a **v1 canvas snapshot** and now
  diverge from the shipped code on four points: the type families (they still list Literata /
  Hind / IBM Plex Mono), `link` (retired), `focus` (now ink) and dark `action` (no longer the
  highlighter). They are deliberately **not** hand-edited — `design/README.md` says the canvas
  is the source of truth and these files are refreshed from it, so a local edit would be
  silently reverted on the next refresh. Fix at the source: update the canvas artifact, then
  refresh the snapshot. Until then the live spec is `design/redesign/tokens.css`, which matches
  `src/app/globals.css`.
- The Claude Design canvas still shows v1 of the landing and Result screens (Bricolage, carded
  hero, 19 eyebrows). `src/` and `design/redesign/` are v2. Reconcile before anyone treats the
  canvas as current.
- A drawn logo (the Wordmark is a typographic stand-in).

## To verify from primary sources
- Naukri, foundit, Instahyre terms of service and live prices (pages blocked during research).
- Whether LinkedIn's Apply Assistant is available in India.
- Darwinbox and Keka candidate-portal terms (for extension autofill in v1.5).
- Share of Indian job applications made on mobile vs desktop.
- Ladders 7.4 s eye-tracking figure, Apple HIG generative AI, India CCPA/ASCI dark-pattern guideline text.
- Jobscan's "keeps your layout" claim (competitive check).
- Meta WhatsApp service-message pricing, if a WhatsApp channel is ever added.

## Engineering next steps
- Replace the starter `src/lib/prompt.ts` behaviour (Markdown output, gaps-only) with the edit-operation plan + claim levels in 05-architecture.md.
- Update the model default in `.env.example` / README (currently an old Sonnet ID).
- Production file pipeline: LibreOffice headless for DOCX page counts, server font library for PDFs, LaTeX via Tectonic, look-alike rebuild path.
- Landing page validation before building everything: price test (₹99 vs ₹149) and ~15 user interviews.
