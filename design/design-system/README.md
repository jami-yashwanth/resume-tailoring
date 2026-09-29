Rezz tailors a person's own resume to each job and never adds anything behind their back. The brand is a calm, honest friend who is good with words: plain, specific, never hype. Every screen should say two things: *this is still your resume*, and *nothing goes in without your OK*.

## Voice and content

- Write in plain English, second person ("your resume"), sentence case everywhere. No exclamation marks, no emoji, no hype words ("supercharge", "10x", "magic", "AI-powered" as a selling point).
- State what happened, with numbers: "We reworded 7 lines. 1 line waits for your OK." Not "Your resume has been optimized!"
- Name gaps honestly and hand control back: "Kafka isn't in your resume. Add this line to your Razorfin role? Recruiters may ask you about it." with Skip and Add it as equal buttons.
- Prices are always rupees with the renewal fact beside them: "₹149 · paid once · does not renew". Use Indian grouping for money and CTC: ₹1,50,000, ₹12.5 LPA.
- Buttons are verb first and say what they do: "Download resume", "Add a job", "See 6 changes". Never "Submit" or "Continue" when a specific verb exists.
- Never promise outcomes ("get hired faster", "beat the ATS"). Promise behaviour: nothing added behind your back, no fake score, no auto-renew, your own design.
- The product is English only.

## Color

- Ground the app in `paper`; put cards and panels on `paper-raised`; set text in `ink`, secondary text in `ink-muted`.
- `highlighter` is the brand and it means exactly one thing: this text changed. Use it only behind changed text (the Highlight component), in the Wordmark stroke, and as the dark-theme `action` fill. Never use it as a text colour or for decoration.
- `verified` marks sourced, confirmed things (SourceTag, verified Badge). `gap` marks something missing that needs the user; always pair it with a word.
- The resume canvas is always `sheet` with `sheet-ink`, in both themes. Dark mode darkens the app around the resume, never the resume itself.
- Primary buttons use `action` / `on-action`. One primary button per view.
- Links are `link` and always underlined.
- Keyboard focus is `focus-ring`: a 2px paper gap, then a 2px solid `focus` ring, on every interactive element.

## Typography

- Headlines in the serif family (`display-xl`, `display`, `heading-1`). They make the product feel like a well-set document. Never use the serif for buttons, inputs or labels.
- Everything else in the sans family (Hind): warm, highly legible at small sizes on budget phones.
- Mono (`source`, `eyebrow`) marks evidence: source tags, parse previews, file facts. `eyebrow` is the only uppercase text.
- Body text is never below 16px on phones.

## Layout and spacing

- The web app comes first, designed at 1440px. Page gutters `space-8`; the one decision that needs the user sits in a bar at the bottom of the screen.
- On desktop, the resume sits centred like a canvas on `paper-sunken`, with a thin side panel for the job's requirements and changes.
- Use the 4px scale only: `space-1` to `space-16`. Cards pad at `space-4`, groups sit `space-6` apart, marketing sections `space-12` apart.
- Radii stay small and document-like: `radius-md` for controls, `radius-lg` for cards and sheets, `radius-sheet` for the resume, `radius-full` only for chips.
- Only the resume (`shadow-sheet`) and floating layers (`shadow-float`) cast **blurred** shadows — the two things that are meant to read as lifted off the page. Hairline `line` separates everything else that is merely adjacent.
- **The drawn skin (29 Sep 2026)**, in `src/components/rezz/skin.ts`: chrome, the things you act on and page-scale objects carry a 2px `ink` outline and a hard offset shadow. It is 0-blur and 0-spread in a flat token colour, so it reads as a drawn outline rather than depth, and interactive objects press into their own offset on hover so the offset does something. Exactly two steps — 4px for anything you act on, 8px for page-scale objects — because nobody can tell 4px from 5px at a glance. Dense repeating rows you read rather than act on (requirement lists, progress stages, fact lists) keep the hairlines; the resume never takes an outline at all.

## Motion

- One signature moment: the highlighter sweep. Changed text gets its highlight drawn left to right over 450ms (ease-out) when a tailored resume first appears. Use it nowhere else.
- All other transitions are 150ms opacity or colour changes. No bouncing, no confetti, no loading theatre; stream real results instead.
- Respect `prefers-reduced-motion`: show the finished highlight with no sweep.

## Iconography

- Line icons, 1.5px stroke, 20px, drawn in `ink` or `ink-muted` (Lucide is the reference set; not yet bundled). Icons support a label, they never replace one.
- Banned: sparkles, magic wands, robots, brains, any "AI" glyph, and emoji. The product proves itself with source tags, not symbols.
- There is no logo file yet. The Wordmark component sets "rezz" in the serif with a highlighter stroke behind it; use it until a drawn mark exists.

## Accessibility and performance

- Every text/ground pair named in the token notes meets 4.5:1 in both themes; `line-strong`, `focus` and meaningful icons meet 3:1.
- Tap targets at least 44px tall. State is never shown by colour alone (gap and verified badges always carry words).
- Budget Android over 4G is the baseline: load only the Google Fonts weights listed in `bundle.css`, no video or 3D, and keep first load under 200 KB of JavaScript.

## Don't

- Purple-to-blue gradients, glowing "AI" effects, sparkle icons.
- Coloured left-border accent cards, emoji section markers, filler stats.
- ~~Moving the user's resume into our template without asking. Their design is the default.~~ **v1 override (28 Sep 2026):** the tailored result now renders into one default Rezz template rather than the user's original design — see `CLAUDE.md` and `docs/09-competitor-kickresume.md`. One fixed template, no gallery. Revisit this Don't once in-place editing is solved; it still holds for any second/third template idea in the meantime.
- Fake scores, countdown timers, pre-ticked renewals, or any dark pattern around payment.
