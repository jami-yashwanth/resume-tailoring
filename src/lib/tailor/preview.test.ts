import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExactPreview, parseExactPreview } from "./preview";
import type { Outline } from "./types";
import type { RenderedLine } from "./view";

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

describe("fetchExactPreview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the document when an outline is given", async () => {
    const fetchMock = vi.fn(async () => Response.json({ pages: 1, images: ["a"] }));
    vi.stubGlobal("fetch", fetchMock);
    const outline: Outline = {
      name: null,
      contact: [],
      sections: [{
        heading: null, kind: "experience", skills: [], lines: [],
        entries: [{ org: null, title: null, dates: null, place: null, bullets: ["a"], lines: [] }],
      }],
    };
    const lines: RenderedLine[] = [{
      key: "a", blockId: "a", kind: "bullet", section: null, style: null, text: "Kept.",
      state: "unchanged", runs: [], size: 10.5, spaceBefore: 0, align: "left", ruleBelow: false,
    }];
    await fetchExactPreview(lines, outline);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body).toHaveProperty("document");
    expect(body).not.toHaveProperty("blocks");
  });
});
