/**
 * Where the preview breaks its pages.
 *
 * This is `_Writer._ensure` from `services/docsvc/app/template_render.py`,
 * written out in the browser's terms: a block that does not fit in what is
 * left of the page moves to the next one whole, rather than splitting across
 * the fold. The two have to agree — the Result screen's whole job is showing
 * the file the user is about to download — so they decide it the same way
 * against the same measurements in `template-metrics.ts`.
 *
 * Heights come in already measured, because where text wraps is the browser's
 * answer and not something worth predicting. That also keeps this a pure
 * function: the rule can be read and tested without a DOM.
 */

import { CONTENT } from "./template-metrics";
import type { LineState } from "./view";

/**
 * How much a block may overrun the page by and still be treated as fitting:
 * one point, in whatever pixels this preview draws a point at.
 *
 * Not a fudge factor — it is the difference between the two things being
 * compared. The renderer decides in exact points against a fixed A4 page. The
 * browser reports `getBoundingClientRect()` heights that have been laid out at
 * a device-pixel grid and summed over forty-odd blocks, so its answer carries
 * accumulated float error. Comparing the two exactly means a document that
 * fills its page is always one rounding error away from growing a second one.
 *
 * Measured, not guessed: a fixture that the renderer puts at exactly one page
 * came to −0.033px, +0.102px, −0.003px and −0.202px against the page height at
 * the four checked widths. The +0.102px reported a two-page file — a phantom
 * page off a tenth of a pixel. One point is ten times that noise, and still a
 * fraction of the shortest block there is (a 14.7pt bullet), so it can absorb
 * measurement error and never a real line.
 */
const SLACK_PT = 1;

/**
 * Assign blocks to pages, returning each page's block indices.
 *
 * A block taller than an empty page is left where it is and allowed to run
 * over, which is the renderer's behaviour too: no page would hold it, so
 * paging cannot keep it whole and would only buy a blank page first.
 *
 * Always returns at least one page — an empty resume is a blank sheet, not
 * an absent one.
 */
export function paginate(heights: number[], pageHeight: number): number[][] {
  const pages: number[][] = [[]];
  const slack = (pageHeight / CONTENT.height) * SLACK_PT;
  let used = 0;

  heights.forEach((height, index) => {
    const page = pages[pages.length - 1];
    const startsThePage = page.length === 0;
    const overruns = used + height > pageHeight + slack;
    const couldFitAlone = height <= pageHeight + slack;

    if (!startsThePage && overruns && couldFitAlone) {
      pages.push([]);
      used = 0;
    }

    pages[pages.length - 1].push(index);
    used += height;
  });

  return pages;
}

/**
 * How many pages the downloaded file comes to, from the preview's heights.
 *
 * The preview shows two kinds of line the file does not have: a draft still
 * waiting for Add it / Skip, and a line the user chose to remove. Counting
 * them made the agreed length include every undecided draft (so adding them
 * never asked about length) and made "Remove that line" free no space.
 * Automatic rewordings are in the file, so they count.
 */
export function filePageCount(
  heights: number[],
  states: readonly LineState[],
  pageHeight: number,
): number {
  const inFile = heights.filter((_, index) => states[index] !== "pending" && states[index] !== "removed");
  return paginate(inFile, pageHeight).length;
}
