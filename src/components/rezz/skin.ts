/**
 * The drawn-ink skin: black-on-white, 2px ink outlines, hard offset shadows.
 *
 * This lived as local consts in the landing page until 29 Sep 2026, when the
 * owner asked for one voice across every screen. It now covers the app too, so
 * it lives here and the landing page imports it like everything else.
 *
 * Where it applies: chrome, the things you act on, and page-scale objects.
 * Where it does NOT: dense repeating rows you read rather than act on — the
 * requirement list, the tailoring stages, the finish screen's facts. Those keep
 * the 1px hairline system. Drawing forty rows in 2px ink is not consistency, it
 * is noise, and the Result screen is where the product is actually used.
 *
 * The one thing the skin never touches is the resume. On the Result screen the
 * sheet keeps its real `shadow-sheet` lift on the sunken well, because it is
 * the only object on screen that is meant to read as paper rather than as UI.
 *
 * Three disciplines keep this from drifting into decoration:
 *
 * 1. A hard offset shadow is a DRAWN OUTLINE, not depth. That is the only
 *    reading under which it may sit on a button at all, when the brand book
 *    reserves real shadows for the resume and floating layers. So every one of
 *    them is 0-blur, 0-spread, in a flat token colour, and interactive objects
 *    press into their own offset on hover — the offset does something.
 * 2. Exactly TWO offset steps: 4px for anything you act on, 8px for page-scale
 *    objects. An audit once found four steps in use — 3/4/5/8 — which is not a
 *    hierarchy, because nobody can tell 4px from 5px at a glance.
 * 3. `highlighter` still means exactly one thing: this text changed. Yellow
 *    appears as the primary button's offset, behind changed text, and on the
 *    blocks that state the promise. Every other offset is ink.
 *
 * All four offsets are token-valued, so dark theme inverts them for free.
 */

/** The 2px ink outline every drawn object carries. */
export const box = "border-2 border-ink";

/** 4px ink — anything you act on. */
export const offset = "shadow-[4px_4px_0_0_var(--ink)]";

/** 8px ink — page-scale objects: the drop zone, a panel, the resume on the hero. */
export const offsetPage = "shadow-[8px_8px_0_0_var(--ink)]";

/**
 * `offsetPage`, flagged important, for the one element that has to beat a
 * shadow set inside its own component: the landing hero's ResumeSheet, which
 * ships `shadow-sheet` in its class string. Two shadow utilities in one string
 * are resolved by Tailwind's generated order rather than ours, so the override
 * has to win outright.
 *
 * It exists as its own constant because Tailwind scans source *text*: writing
 * `${offsetPage}!` at the call site composes the class at runtime, the literal
 * never appears anywhere on disk, and the important variant is silently never
 * generated — the hero quietly falls back to the soft lift. Caught exactly that
 * way. The full literal must live here, in a file Tailwind scans.
 */
export const offsetPageOverride = "shadow-[8px_8px_0_0_var(--ink)]!";

/** 8px highlighter — reserved for the blocks that state the promise. */
export const offsetAccent = "shadow-[8px_8px_0_0_var(--highlighter)]";

/**
 * 4px in the corrector's red — the one thing on a screen that needs the user.
 * Pair it with `border-gap` rather than `box`: red outline, red offset.
 */
export const offsetGap = "shadow-[4px_4px_0_0_var(--gap)]";

/* ---------------------------------------------------------------------------
   Type.

   One scale, after an audit found 29 distinct size/line-height/weight
   combinations on the landing page alone — four different line-heights on 15px
   text. Nobody chose those; they accumulated. Snap to a step or add one
   deliberately, but do not invent another by eye.

     display  clamp(34,3.7vw,52)/1.08  700  -0.04em   the landing h1
     title    clamp(28,3vw,40)/1.08    700  -0.04em   every app screen's h1
     h2       clamp(32,3.2vw,46)/1.06  700  -0.04em   sections + prices
     h3       20/28                    700  -0.02em   step titles, sub-headings
     lead     18/29                    400            leads
     body     16/26                    400            bodies, answers, features
     label    15/20                    600            buttons, nav
     small    14/22                    400/500        meta, footer
     mark     12/16 mono               500            margin marks, tags

   `title` is the step added when the skin moved into the app: a working screen
   opens smaller than a marketing page, but at the same weight and tracking, so
   the two read as one product rather than two.
   --------------------------------------------------------------------------- */

export const display =
  "m-0 text-[clamp(34px,3.7vw,52px)] font-bold leading-[1.08] tracking-[-0.04em]";

export const title = "m-0 text-[clamp(28px,3vw,40px)] font-bold leading-[1.08] tracking-[-0.04em]";

export const h2 = "m-0 text-[clamp(32px,3.2vw,46px)] font-bold leading-[1.06] tracking-[-0.04em]";

export const h3 = "text-xl font-bold leading-7 tracking-[-0.02em]";

export const lead = "text-lg leading-[29px] text-ink-muted";
