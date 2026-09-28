# Design plan — Rezz v2

Written 28 Sep 2026. Covers the landing page and the Result screen.
Supersedes nothing in `docs/`; the product decisions there are unchanged.

## The subject, restated

A resume tailor for Indian professionals with 1–6 years' experience who are
switching jobs and who **distrust this category**. They have been burned by
invented skills, fake ATS scores and billing traps.

The design's primary job is therefore not "look modern". It is: **prove the
document is intact, and prove nothing was slipped in.**

## The governing metaphor: a marked-up proof, not a dashboard

"Paper and highlighter" was right but only half-stated. The other half is the
editorial tradition it belongs to — the **corrected galley proof**: a document
returned by an editor with marks in the margin saying what was touched and why.

That vernacular gives us everything we need and nothing generic:

- marks live in the **margin**, not on top of the text
- every mark is **attributable** — a proofreader initials their changes
- the page itself is never redesigned, only annotated
- the corrector's **red** is the traditional colour for "look at this"

Rezz already has `gap: #a83e2a`, a burnt red, sitting unused as a concept.
That is the proofreader's pencil. Lean on it.

## Type — one rule, tied to the promise

**Sans is Rezz talking. Serif is what you wrote.**

| Token | Face | Carries |
| --- | --- | --- |
| `--font-ui` | Geist (400/500/600) | every word Rezz says: chrome, headlines, copy |
| `--font-doc` | the user's own font (Georgia in samples) | every word the user wrote |
| `--font-mark` | Geist Mono (400/500) | margin marks and source tags only |

Why this and not a display face: Rezz's whole promise is *this is still your
resume*. If app chrome and document are set in related faces, that boundary
blurs. Making the split absolute means you can tell at a glance, on any screen,
which words are yours. The type system enforces the product rule.

Headlines are Geist at 600 with tight tracking (−0.03em) on a short measure.
The drama comes from the document, not the headline face — see Principles.

**This drops Bricolage Grotesque**, which the 28 Sep decision log chose. Two
reasons: it was assigned to a token literally named `--font-serif` while being
a grotesque, and its deliberate quirk argues against a product selling sober
honesty. Geist and Geist Mono, the other two thirds of that decision, are kept.
If you want more character than Geist, Instrument Sans is the alternative — it
was already on your own shortlist.

## Colour — subtract one, fix one

Keep the palette. Two changes:

1. **Retire `--link: #2a4fa8`.** It is the only token with no concept behind
   it, a generic web blue. Links become ink with a permanent underline, which
   the brand book already requires. `--focus` becomes ink (light) / paper
   (dark) — no orphan hue, and contrast improves.
2. **Dark-theme `--action` stops being the highlighter.** The brand book says
   highlighter means *only* "this text changed"; spending it on a button fill
   breaks the system's one hard-won semantic. Dark actions invert to a light
   fill with ink text.

`gap` (#a83e2a) is promoted from "warning colour" to **the corrector's mark** —
it is what the margin uses for anything needing the user.

## Layout

### Landing hero — the document is the hero

The current hero puts the sheet in a rounded grey card, 50/50 beside a
headline. That is a screenshot of a product. Replace with the document at
reading size, marks in its margin, doing the explaining itself.

```
┌────────────────────────────────────────────────────────────┐
│ rezz               How it works   Pricing   Questions   [+]│
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Your resume, reworded for                                  │
│  the job you're applying to.       ← short measure, 2 lines │
│                                                             │
│  [Upload your resume]   No sign-up. 1 free tailor a week.   │
│                                                             │
│      ┌──────────────────────────────┐                       │
│      │  PRIYA SHARMA                │                       │
│      │  Backend Engineer · Bengaluru│                       │
│      │  ────────────────────────    │                       │
│      │  ▓▓▓▓▓ highlighted line ▓▓▓▓ │ ── Reworded           │
│      │  · plain line, untouched     │                       │
│      │  · ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ── Reworded           │
│      │                              │    from your fact #4  │
│      │  · ┌ ─ dashed, not yours ─ ┐ │ ── ! Needs your OK    │
│      └──────────────────────────────┘                       │
│         the real sheet, real size      the margin does the  │
│                                        explaining           │
└────────────────────────────────────────────────────────────┘
```

Alignment: everything left-aligned against one spine. No centred sections —
centring is what makes marketing pages interchangeable.

### Result screen — one bar of chrome, not two

Currently five frame layers surround a document meant to be the star. Merge
the header and status bar; widen the margin gutter; delete the page-fullness
progress bar (a loading-bar metaphor for "how full is the page" reads wrong)
and state it in words.

```
┌──────────────────────────────────────────────────────────────┐
│ rezz  Your resumes / Backend Engineer · Kosha Payments        │
│       7 reworded · 2 need your OK    Page 1 of 1  [⇄][Download]│
├──────────┬───────────────────────────┬───────────────────────┤
│ This job │                           │                       │
│          │                           │                       │
│  6 of 9  │      the sheet, 620       │   margin marks, 300   │
│  ✓ Java  │                           │   (wider and louder   │
│  ✓ AWS   │                           │    than v1)           │
│  ! Kafka │                           │                       │
│  – Pune  │                           │                       │
├──────────┴───────────────────────────┴───────────────────────┤
│ Kafka isn't in your resume. Add this line to your Razorfin    │
│ role?  "Consumed payment events from Kafka…"  [Skip] [Add it] │
└──────────────────────────────────────────────────────────────┘
```

## Principles

1. **Sans is Rezz, serif is you.** The type split is the promise, made visible.
2. **Show the marked page, don't screenshot it.** The hero is the artefact.
3. **The margin is the signature.** This is where all the boldness is spent.
   Marks get real size, real weight, a connecting rule to the line they
   describe. Everything else stays quiet so this can be loud.
4. **Chrome must carry state or go.** No label that repeats its own container;
   no eyebrow above a heading that already says it.
5. **One orchestrated motion:** the highlighter sweep on first paint, left to
   right, 450ms, once. Nothing else animates on load.

## What this deliberately does not do

- No centred hero, no three-up feature cards, no gradient anything.
- No ALL-CAPS tracked eyebrows (v1 had 19 across 7 screens; target is 0–2).
- No middle-dot meta strings in Rezz's own chrome (v1 had 70). They stay only
  where they are the user's own resume content, e.g. a contact line.
- No new card treatment. A bordered rounded box is used for one thing only —
  a thing you can buy (pass cards). Everything else separates with a rule.
