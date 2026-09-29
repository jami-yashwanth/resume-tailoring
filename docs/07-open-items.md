# Open items

## Decisions still needed
- Data-policy FAQ: the landing copy and `/privacy` now state only what v1 verifiably does (file stays in the browser). Storage region and deletion window still need real hosting and legal answers before accounts ship.
- Final ₹149 pack size once real per-resume AI cost is measured (15 vs 10). The stream route now logs the rupee cost of every tailoring — collect a few dozen runs.
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
- ~~Replace the starter `src/lib/prompt.ts` behaviour~~ Done: the edit-op pipeline with claim levels lives in `src/lib/tailor/` (planner.ts, rules.ts).
- ~~Update the model default in `.env.example` / README~~ Done: defaults documented, per-stage overrides added. Still open: swap the rate-limited OAuth token for an API key so the planner can actually run on Sonnet, then delete the Haiku override from `.env`.
- Production file pipeline (only if/when in-place editing returns): LibreOffice headless for DOCX page counts, server font library for PDFs, LaTeX via Tectonic, look-alike rebuild path.
- Landing page validation before building everything: price test (₹99 vs ₹149) and ~15 user interviews. Funnel events now exist (`src/lib/analytics.ts`) — set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` to start measuring.
- Commercial layer (auth + UPI passes + minimal Postgres): design agreed 29 Sep 2026, deferred until vendors are picked. Long poles to start first: payment-gateway KYC and SMS DLT template approval.
