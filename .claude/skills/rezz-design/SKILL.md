---
name: rezz-design
description: Rezz's own visual language ("paper and highlighter") — tokens, type pairing, components, copy rules and the banned generic-AI patterns. Load before writing or reviewing any Rezz UI: a screen, a component, CSS/Tailwind, a landing section, the Chrome extension panel, a marketing page, or any change to design/. Use together with the frontend-design skill; frontend-design sets the craft bar, this file sets the house style.
---

# Rezz design

Rezz tailors a person's own resume and never adds anything behind their back. Every
screen must say two things: **this is still your resume**, and **nothing goes in
without your OK**. The product should feel like a well-set document, not a SaaS
dashboard.

Full brand book: `design/design-system/README.md`. Tokens: `design/design-system/tokens.json`.
Screens: `design/screens/*.dc.html` (canvas copies). Core screen spec: `docs/03-ux-result-screen.md`.

## Before you design anything

1. Read the screen's entry in `docs/04-web-flow.md` and, for the Result screen,
   all of `docs/03-ux-result-screen.md`. The specs are the source of truth.
2. Use the real example data everywhere: Priya Sharma, Backend Engineer, 3 yrs,
   Bengaluru, 30-day notice → Backend Engineer at Kosha Payments, Pune (on-site).
   The 9 requirements are fixed: Java, Spring Boot, AWS, Microservices, REST APIs,
   Mentoring (matched) · Kafka (must), Kubernetes (nice) (need your OK) · Pune
   on-site (can't change). Never invent different sample data.
3. Design at 1440px. Web only — no mobile work until the owner says so.

## Type

**One rule: sans is Rezz talking, serif is what the user wrote.**

| Token | Face | Carries |
| --- | --- | --- |
| `--font-ui` | **Geist** (variable, 400–600 in use) | every word Rezz says: chrome, headlines, copy |
| `--font-doc` | the user's own font (Georgia in samples) | every word the user wrote |
| `--font-mark` | **Geist Mono** | margin marks and source tags only |

Rezz's promise is *this is still your resume*. If the app chrome and the
document share a face, that boundary blurs; making the split absolute means you
can tell at a glance whose words are whose. The type system enforces the product
rule, which is why it is worth defending.

**Bricolage Grotesque is retired** (superseded 28 Sep 2026). It sat in a token
named `--font-serif` while being a grotesque, and its deliberate quirk argued
against a product selling sober honesty. There is no separate display face: the
headline is Geist at 600 with tight tracking on a short measure, because the
drama belongs to the document, not the headline.

Rules: mono marks evidence only. Body text is never below 16px. Never use a
`--font-*` token for the wrong voice — app chrome in `--font-doc` is a bug.

**v1 override (28 Sep 2026):** the tailored result renders into one default Rezz
template instead of the user's own file, so `--font-doc` ("the user's own font")
has nothing to attach to for that render — the default template's resume canvas
uses `--font-ui` (Geist) throughout, same as the app chrome. Temporary; revisit
alongside the templating override below and in `CLAUDE.md`.

## Colour

Use the named tokens, never raw hex. Grounds: `paper` → `paper-raised` (cards,
panels) → `paper-sunken` (wells behind the resume and inputs). Text: `ink`,
secondary `ink-muted`. Hairlines: `line`; control borders `line-strong`.

- **`highlighter` (#e4f264) means exactly one thing: this text changed.** Only as
  a background behind changed text (Highlight), the Wordmark stroke, and the
  dark-theme `action` fill. Never as a text colour, never decoration.
- **The resume sheet is paper-white in both themes.** Dark mode darkens the app
  *around* the resume, never the resume. The `.sheet` class is not decoration:
  it re-declares every theme-varying token it uses, so dark values can never
  land on white paper. Keep the class, and when you add a token the sheet reads,
  add it to that block too. Caught twice already: dark `--gap-soft` painted a
  dark block behind dark text, and dark `--focus` would draw a near-white ring
  on white paper. `--shadow-sheet` is deliberately excluded — it falls on the
  app's ground, so it must follow the theme.
- `verified` = sourced and confirmed. `gap` = missing, needs the user — always
  paired with a word, never colour alone.
- Primary buttons `action` / `on-action`; one primary button per view.
- Links are `link` and always underlined.
- Focus is `outline: 2px solid var(--focus)` with `outline-offset: 2px` — a real
  gap of whatever ground is behind it, correct on paper, on cards and on the
  white sheet with one declaration, and never clipped by a scroll container.

## Layout, depth, motion

- 4px scale only, `space-1`…`space-16`. Cards pad `space-4`, groups sit `space-6`
  apart, marketing sections `space-12`, page gutters `space-8`.
- Radii stay small and document-like: `radius-md` controls, `radius-lg` cards,
  `radius-sheet` the resume, `radius-full` chips only.
- Only the resume (`shadow-sheet`) and floating layers (`shadow-float`) cast
  shadows. Everything else is separated by a `line` hairline.
- One signature motion: the **highlighter sweep** — changed text gets its
  highlight drawn left to right over 450ms ease-out, once, when a tailored resume
  first appears. Nowhere else. Everything else is a 150ms opacity or colour
  change. Honour `prefers-reduced-motion` by showing the finished highlight.
- Icons: Lucide, line, 1.5px stroke, 20px, in `ink` or `ink-muted`. Icons support
  a label, never replace one.

## Components

Ten components exist under `window.Rezz` (`design/design-system/index.d.ts`):
Button, Badge, SourceTag, Highlight, ChangeLine, GapPrompt, ResumeSheet,
PassCard, PromiseStrip, Wordmark. Reach for these before inventing a new one; if
a new one is genuinely needed, add it to the bundle and to `index.d.ts`.

The `.dc.html` screens load `ds/rezz/components/bundle.*` from the Claude Design
canvas and will not render standalone — don't "fix" them to run locally.

## Copy

Plain English, second person, sentence case. No exclamation marks, no emoji, no
hype ("supercharge", "10x", "magic", "AI-powered" as a selling point).

- State what happened with numbers: "We reworded 7 lines. 1 line waits for your OK."
- Buttons are verb-first and specific: "Download resume", "Add a job", "See 6
  changes". Never "Submit" or "Continue" when a real verb exists.
- Money in rupees with the renewal fact attached: "₹149 · paid once · does not
  renew". Indian grouping: ₹1,50,000, ₹12.5 LPA.
- The promise strip is exactly: "Nothing added behind your back · No fake ATS
  score · No auto-renew · Your own design". **"Never invents" is retired** — it
  must not appear anywhere.
- Never promise outcomes ("get hired faster", "beat the ATS"). Promise behaviour.
- English only.

## Product rules that show up as design

- Add it / Skip are **exactly two options, equal visual weight, nothing
  pre-selected**. No "Add all". No shaming copy on Skip, and never re-ask after a
  Skip.
- Unbacked lines carry the words "Not in your resume" plus a dashed `gap`
  treatment — colour is never the only signal.
- No 0–100 ATS score anywhere. Show checkable counts: "Covers 7 of 9 job
  requirements (your original covered 3)".
- Knockouts (location, years, degree) are shown and never changed: "You're in
  Bengaluru. We never change this."
- Page count never grows without asking; never shrink fonts to fit.
- Accessibility: 4.5:1 text contrast in both themes, 44px tap targets, a polite
  live region for each decision ("Kafka line added. 1 decision left."), buttons
  that name the skill, focus moving to the next pending decision.

## Never ship these (the generic-AI tells)

Purple-to-blue or indigo/violet gradients · glowing "AI" effects · sparkle, magic
wand, robot or brain glyphs · emoji as section markers or bullets · a centred hero
with a gradient-filled headline · three equal feature cards each with a pastel
icon circle · coloured left-border accent cards · `shadow-lg` on everything ·
oversized pill radii on every surface · filler stats nobody measured · fake
scores, countdown timers, pre-ticked renewals or any payment dark pattern ·
~~moving the user's resume into a Rezz template without asking~~ (suspended for
v1 — see the type-system override above and `CLAUDE.md`; still applies to any
second template beyond the one default).

If a layout would look at home in any AI-generated SaaS landing page, it is wrong
for Rezz. The distinctive move is the document itself: a real white sheet on a
sunken ground, honest marks in the margin, and one yellow highlighter.
