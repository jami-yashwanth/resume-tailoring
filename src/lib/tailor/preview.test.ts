import { describe, expect, it } from "vitest";
import { parseExactPreview } from "./preview";

describe("parseExactPreview", () => {
  it("returns the pages and one image per page", () => {
    expect(parseExactPreview({ pages: 2, images: ["a", "b"] })).toEqual({
      pages: 2,
      images: ["a", "b"],
    });
  });

  it("rejects a body with no images", () => {
    expect(() => parseExactPreview({ pages: 1 })).toThrow();
    expect(() => parseExactPreview({ pages: 1, images: [] })).toThrow();
    expect(() => parseExactPreview(null)).toThrow();
  });

  it("rejects an image count that disagrees with the page count", () => {
    // One picture missing means the preview would silently show a shorter
    // document than the file — worse than showing an error.
    expect(() => parseExactPreview({ pages: 3, images: ["a", "b"] })).toThrow();
  });

  it("rejects images that are not strings", () => {
    expect(() => parseExactPreview({ pages: 1, images: [42] })).toThrow();
  });
});
