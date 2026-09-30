import { afterEach, describe, expect, it, vi } from "vitest";
import type { TemplateDocument } from "./document";
import { fetchPageCount } from "./pages";

const doc: TemplateDocument = { name: "Priya", contact: [], sections: [] };

describe("fetchPageCount", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the document and returns the printer's count", async () => {
    const fetchMock = vi.fn(async () => Response.json({ pages: 2, renderer: "chromium" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPageCount(doc)).resolves.toBe(2);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/pages");
    expect(JSON.parse(init.body as string)).toEqual({ document: doc });
  });

  it("throws with the server message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Printer is down." }, { status: 502 })));
    await expect(fetchPageCount(doc)).rejects.toThrow("Printer is down.");
  });

  it("throws when the body has no page count", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    await expect(fetchPageCount(doc)).rejects.toThrow("Could not count pages.");
  });
});
