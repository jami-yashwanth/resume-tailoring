# Design

Local snapshots (28 Sep 2026) of the design work. The live versions are the claude.ai artifacts in `../docs/06-links.md`; edit there, then refresh these copies.

## `design-system/`

The Rezz design system: "paper and highlighter".

- `README.md` — the brand book: voice, colour, type, layout, motion, iconography, accessibility, don'ts.
- `tokens.json` — colour (light + dark), type styles, spacing, radius, shadow.
- `bundle.css` / `bundle.js` / `index.d.ts` — 10 components under `window.Rezz`: Button, Badge, SourceTag, Highlight, ChangeLine, GapPrompt, ResumeSheet, PassCard, PromiseStrip, Wordmark.

Key rules: `highlighter` (#e4f264) means only "this text changed"; the resume sheet is always white in both themes; Skip and Add it always have equal weight.

Known drift: the web screens use Bricolage Grotesque + Geist + Geist Mono (chosen on the canvas), but `tokens.json` still lists Literata / Hind / IBM Plex Mono.

## `screens/`

The web screens from the Claude Design canvas, as `.dc.html` files (Claude Design's component format; they load `ds/rezz/components/bundle.*` from the canvas and won't render standalone). `canvas.json` is the canvas layout. See `../docs/04-web-flow.md` for what each screen does.

## `claude-design-prompt.md`

The product brief used to prompt Claude Design.
