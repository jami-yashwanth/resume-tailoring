/**
 * The one default Rezz template, as numbers.
 *
 * `services/docsvc/app/template_render.py` draws every download from exactly
 * these values. This module is the web side of the same template, so the
 * Result screen previews the document the user is about to get rather than a
 * lookalike of it.
 *
 * The two were allowed to differ before v1's fixed-template override (28 Sep
 * 2026, see `CLAUDE.md`): back then the preview showed the user's own file and
 * the renderer edited that file, so neither owned a template. After the
 * override they both render the same one, and the divergence left behind is
 * what made the preview read as the weaker document — its section headings
 * were smaller than its own body text, where the renderer sets them equal and
 * bold, and its bullets sat 29% further apart than the PDF's.
 *
 * Points, because points are what the renderer works in. A number here is a
 * number there: change one only together with `template_render.py`.
 */

/** CSS pixels per point, at the 96dpi a browser assumes for absolute units. */
const PT = 96 / 72;

/** `template_render.py`'s `PAGE_WIDTH`/`PAGE_HEIGHT`/`MARGIN` — A4, 50pt in. */
export const PAGE = { width: 595.28, height: 841.89, margin: 50 } as const;

/**
 * Per block kind, the three things the renderer decides:
 *
 * - `size` — the font size it draws at.
 * - `leading` — how far its y-cursor advances, which is the block's own height
 *   and therefore the CSS `line-height` that reproduces it.
 * - `before` / `after` — the `space()` it adds around the block, which is the
 *   CSS margin. Kinds without them get none; a role sits straight after the
 *   bullet above it, and the next bullet straight after the role.
 * - `indent` — how far a bullet's text is pushed off the margin, with the dot
 *   drawn back at the margin itself.
 */
export const TYPE = {
  name: { size: 20, leading: 28 },
  contact: { size: 10, leading: 18, after: 6 },
  heading: { size: 10.5, leading: 13.5, before: 12, after: 10 },
  role: { size: 10.5, leading: 16 },
  bullet: { size: 10.5, leading: 14.7, indent: 14 },
  paragraph: { size: 10.5, leading: 18.7 },
} as const;

/**
 * The page's content box — `CONTENT_WIDTH` and `ROOM` in `template_render.py`,
 * the area left once the margin is taken off all four sides.
 */
export const CONTENT = {
  width: PAGE.width - 2 * PAGE.margin,
  height: PAGE.height - 2 * PAGE.margin,
} as const;

/**
 * How tall the content box stands, in CSS pixels, for a page rendered that
 * wide. The preview's page scales with its column while the renderer's never
 * does, so the height has to be read off the width rather than fixed — and
 * pagination has to measure against this, not against the A4 height in points.
 */
export const contentHeightFor = (contentWidthPx: number) =>
  contentWidthPx * (CONTENT.height / CONTENT.width);

/** Points as a CSS pixel length, for anything drawn at the page's true size. */
export const px = (points: number) => `${+(points * PT).toFixed(2)}px`;

/**
 * Points as a share of the page's width, so the length scales with the page.
 *
 * `cqi` is 1% of the container's inline size, and `ResumeSheet` makes the page
 * that container — so `cqi(10.5)` is 10.5pt on a page rendered at A4's true
 * width, and the same fraction of a page rendered smaller. Every length inside
 * the document has to be written this way, type included: a page that keeps
 * A4's shape but not its type fits fewer characters to the line, wraps text
 * the renderer would not wrap, and paginates differently as a result. At 1280px
 * that showed up as a three-page preview of a two-page file.
 */
export const cqi = (points: number) => `${+((points / PAGE.width) * 100).toFixed(4)}cqi`;

/** A ratio as a CSS percentage, for the lengths that have to scale with the
 *  page rather than sit at a fixed size — the margin, and the page floor. */
export const pct = (ratio: number) => `${+(ratio * 100).toFixed(4)}%`;
