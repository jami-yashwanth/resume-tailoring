import { describe, expect, test } from "vitest";
import { filePageCount, paginate } from "./paginate";

/**
 * The same rule `_Writer._ensure` in `services/docsvc/app/template_render.py`
 * applies, which is the point: the preview and the downloaded file have to
 * break in the same places, so they decide it the same way.
 */
describe("paginate", () => {
  test("keeps everything on one page when it all fits", () => {
    expect(paginate([10, 20, 30], 100)).toEqual([[0, 1, 2]]);
  });

  test("moves a block that overruns the page rather than splitting it", () => {
    // 60 + 50 is 110 against a 100 page: the second block moves whole.
    expect(paginate([60, 50], 100)).toEqual([[0], [1]]);
  });

  test("fills a page before starting the next", () => {
    expect(paginate([40, 40, 40, 40], 100)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  test("a block exactly filling the rest of the page stays on it", () => {
    expect(paginate([60, 40], 100)).toEqual([[0, 1]]);
  });

  test("never opens with a blank page, however tall the first block", () => {
    // No page would hold this one, so paging cannot keep it whole — it stays
    // where it is, exactly as the renderer leaves it.
    expect(paginate([250], 100)).toEqual([[0]]);
  });

  test("a block taller than any page does not push the next one off with it", () => {
    expect(paginate([250, 30], 100)).toEqual([[0], [1]]);
  });

  test("an empty resume is still one page", () => {
    expect(paginate([], 100)).toEqual([[]]);
  });
});

/**
 * The length the user is asked about is the file's, not the preview's: an
 * undecided draft and a line chosen for removal are on screen but not in the
 * download, so neither may count towards it.
 */
describe("filePageCount", () => {
  test("counts only the lines that go into the file", () => {
    // On screen this is two pages; the pending draft is not in the file.
    const states = ["unchanged", "pending", "unchanged"] as const;
    expect(paginate([60, 30, 30], 100)).toHaveLength(2);
    expect(filePageCount([60, 30, 30], states, 100)).toBe(1);
  });

  test("a line removed to fit frees its space", () => {
    expect(filePageCount([60, 50], ["unchanged", "removed"], 100)).toBe(1);
  });

  test("added lines and automatic rewordings are counted", () => {
    expect(filePageCount([40, 40, 40], ["added", "reworded", "reverted"], 100)).toBe(2);
  });
});
