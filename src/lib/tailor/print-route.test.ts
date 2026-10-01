import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as download } from "@/app/api/download/route";
import { POST as pages } from "@/app/api/pages/route";
import type { TemplateDocument } from "./document";

const post = (route: typeof download, body: unknown) =>
  route(new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }));

const doc: TemplateDocument = { name: "Priya", contact: [], sections: [] };

describe("print routes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["download", download, "Nothing to download yet."],
    ["pages", pages, "Nothing to count yet."],
  ] as const)("%s refuses a document with missing lists, with the same copy", async (_, route, copy) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const body of [{ document: {} }, { document: { name: "Priya" } }, { document: { contact: [], sections: null } }]) {
      const response = await post(route, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: copy });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["download", download],
    ["pages", pages],
  ] as const)("%s says in words when the printer refuses a page as too large", async (_, route) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ detail: "html over 4 MB" }, { status: 413 })));
    const response = await post(route, { document: doc });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "This resume is too large to print. Remove some content and try again.",
    });
  });
});
