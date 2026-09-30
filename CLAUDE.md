# Rezz (resume-tailoring)

India-first AI resume tailor. Start with `docs/README.md`; the decisions there are the spec. The code in `src/` is an early starter and predates most decisions.

## Product rules (don't break these without the owner's OK)

- **v1 override (28 Sep 2026):** tailored results render into one default Rezz template instead of editing the user's own file in place. This is temporary and tracked for revisit — see `docs/09-competitor-kickresume.md` (Kickresume research) and the decision log in `docs/01-product.md`. One template only: no gallery, no color/layout picker. The underlying rule below still holds in spirit — nothing is added behind the user's back, and this gets revisited once the in-place editing problems (subset PDF fonts, LibreOffice page-fit) are solved.
- ~~Tailor the user's OWN file in place and keep their design. Never move their resume into a Rezz template without asking.~~ (suspended for v1, see override above)
- Rewordings of the user's own facts apply automatically with undo. A line with a skill that isn't in the resume is drafted, marked "Not in your resume", and inserted only on **Add it**. Exactly two options: Add it / Skip, equal weight, nothing pre-selected.
- Never invent numbers or outcomes; never fake knockouts (location, years, degree); never rewrite job titles or dates.
- No 0–100 ATS score. Show checkable counts ("Covers 7 of 9 job requirements").
- Promise copy: "Nothing added behind your back · No fake ATS score · No auto-renew · Your own design". Don't use "Never invents".
- Page count never grows without asking: swap first, grow last; never shrink fonts.
- Passes are one-time UPI payments that never renew.
- Never auto-apply; the Chrome extension is read-only on LinkedIn, Naukri and Indeed.
- English only. Web first; no mobile work until the owner says so.

## Design

Follow `design/design-system/README.md` and `tokens.json`. Screens: `design/screens/` (live canvas in `docs/06-links.md`).

Before writing or reviewing any UI, load the **`rezz-design`** skill (`.claude/skills/rezz-design/`) — it holds the house style
("paper and highlighter"): tokens, the Bricolage Grotesque + Geist type pairing, the ten `window.Rezz` components, the copy rules
and the banned generic-AI patterns. Pair it with the **`frontend-design`** skill for general craft.

## AI

Claude API via `@anthropic-ai/sdk`, server-side only. See `docs/05-architecture.md` for the pipeline, claim levels and cost estimates.
The LLM structures the parsed resume into an outline and never returns text the code has not verified against the file (`src/lib/tailor/outline.ts`).
