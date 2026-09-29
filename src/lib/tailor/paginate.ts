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
  let used = 0;

  heights.forEach((height, index) => {
    const page = pages[pages.length - 1];
    const startsThePage = page.length === 0;
    const overruns = used + height > pageHeight;
    const couldFitAlone = height <= pageHeight;

    if (!startsThePage && overruns && couldFitAlone) {
      pages.push([]);
      used = 0;
    }

    pages[pages.length - 1].push(index);
    used += height;
  });

  return pages;
}
