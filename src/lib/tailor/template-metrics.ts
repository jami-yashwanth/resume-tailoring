/**
 * The one default Rezz template, as numbers.
 *
 * The numbers live in `shared/template.json` and are MEASURED off the compiled
 * LaTeX template (the owner's reference .tex, compiled by docsvc with
 * Tectonic — since 30 Sep 2026 that compile IS the download). docsvc's
 * `tests/test_latex_parity.py` recompiles and re-measures on every run, so
 * these values cannot silently drift from the file the user gets. This module
 * is the web side of the same numbers, so the Result screen previews the
 * document itself rather than a lookalike of it.
 *
 * The box model, shared with the json and the parity test:
 *
 *  - Every block is a box `lines × leading` tall — `leading` is the wrapped
 *    line advance, i.e. exactly CSS `line-height`.
 *  - Adjacent boxes are separated by `gaps["prev>next"]`, applied as the next
 *    block's `margin-top` (the page is a flex column, so margins never
 *    collapse and stay additive). Bullets nested under a role are keyed
 *    `bullet2`; bullets straight under a heading are `bullet`. Gaps are
 *    per-pair because TeX's spacing (per-level itemsep, the reference's
 *    negative vspaces) is not a sum of per-kind constants.
 *  - Within its box, the browser places the baseline at
 *    L/2 + S·(asc − (asc+desc)/2) with Roboto's hhea metrics — which is why
 *    setting only line-heights and margins lands the preview's text on the
 *    compiled PDF's baselines.
 *
 * Points, because points are what the compiled page is measured in. What stays
 * here is what only the browser needs: the unit conversions, the content box,
 * and the gap/level lookups the preview renders with.
 */
import spec from "../../../shared/template.json";
import type { BlockKind } from "./types";

/** CSS pixels per point, at the 96dpi a browser assumes for absolute units. */
const PT = 96 / 72;

/** A4, 36pt in — the reference's fullpage margins after its \addtolength. */
export const PAGE = spec.page;

/**
 * Per block kind, measured off the compiled PDF: `size` and `leading` (the CSS
 * font-size / line-height), appearance flags (`bold`, `italic`, `upper`,
 * `rule`, `align`), `indent` off the left margin, and for `role` the tabular
 * row's `width` its dates sit flush against.
 */
export const TYPE = spec.type;

/** The hairline under a section heading, and the document's inks. */
export const RULE = spec.rule;
export const COLOR = spec.color;

/**
 * The measured space between two adjacent blocks, by "prev>next" pair.
 * See the box model above; unlisted pairs fall back to `default`.
 */
export const GAPS: Record<string, number> = spec.gaps;

/** A block kind with bullet nesting resolved — the key format `GAPS` uses. */
export type KeyedKind = BlockKind | "bullet2";

/**
 * Bullet depth, resolved the way the compiled file nests them: a bullet under
 * a role (or its job title) is level two until the next heading; a bullet
 * straight under a heading stays level one. `latex_render.blocks_to_latex`
 * builds the lists this way and `test_latex_parity.leveled` re-checks it.
 */
export function resolveBulletLevels(kinds: readonly BlockKind[]): KeyedKind[] {
  let underRole = false;
  return kinds.map((kind) => {
    if (kind === "heading") underRole = false;
    const keyed: KeyedKind = kind === "bullet" && underRole ? "bullet2" : kind;
    if (kind === "role" || kind === "job_title") underRole = true;
    return keyed;
  });
}

/** The gap above `next` when it follows `prev`; nothing above the first block. */
export function gapBetween(prev: KeyedKind | null, next: KeyedKind): number {
  if (prev === null) return 0;
  return GAPS[`${prev}>${next}`] ?? GAPS.default;
}

/**
 * The page's content box — the area left once the margin is taken off all
 * four sides. Same numbers as `CONTENT_WIDTH` / `ROOM` in template_render.py.
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
