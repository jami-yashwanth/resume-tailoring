import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateDocument } from "./document";
import { fetchPageCount } from "./pages";
import { createPageCounter, type PrintedPages } from "./usePrintedPages";

const doc = (name: string): TemplateDocument => ({ name, contact: [], sections: [] });

/** A fetch whose responses the test releases by hand, in any order. */
function heldFetch() {
  const calls: { name: string; respond: (pages: number) => void; fail: () => void }[] = [];
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const name = JSON.parse(init.body as string).document.name as string;
    return new Promise<Response>((resolve) => {
      calls.push({
        name,
        respond: (pages) => resolve(Response.json({ pages, renderer: "chromium" })),
        fail: () => resolve(Response.json({ error: "Printer is down." }, { status: 502 })),
      });
    });
  });
  return { calls, fetchMock };
}

describe("createPageCounter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces and returns the printer's count", async () => {
    const { calls, fetchMock } = heldFetch();
    vi.stubGlobal("fetch", fetchMock);
    const counter = createPageCounter(fetchPageCount, 800);
    const seen: PrintedPages[] = [];
    counter.subscribe((s) => seen.push(s));

    counter.update(doc("a"));
    await vi.advanceTimersByTimeAsync(400);
    counter.update(doc("b"));
    await vi.advanceTimersByTimeAsync(799);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(seen.at(-1)).toEqual({ pages: null, checking: true, failed: false });

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0].name).toBe("b");

    calls[0].respond(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)).toEqual({ pages: 2, checking: false, failed: false });
    counter.dispose();
  });

  it("ignores a stale page-count response", async () => {
    const { calls, fetchMock } = heldFetch();
    vi.stubGlobal("fetch", fetchMock);
    const counter = createPageCounter(fetchPageCount, 800);
    const seen: PrintedPages[] = [];
    counter.subscribe((s) => seen.push(s));

    counter.update(doc("first"));
    await vi.advanceTimersByTimeAsync(800);
    counter.update(doc("second"));
    await vi.advanceTimersByTimeAsync(800);
    expect(calls.map((c) => c.name)).toEqual(["first", "second"]);
    // The first request was superseded, so its signal is aborted.
    const firstInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(firstInit.signal?.aborted).toBe(true);

    calls[1].respond(3);
    await vi.advanceTimersByTimeAsync(0);
    calls[0].respond(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)).toEqual({ pages: 3, checking: false, failed: false });
    counter.dispose();
  });

  it("keeps the last count on error", async () => {
    const { calls, fetchMock } = heldFetch();
    vi.stubGlobal("fetch", fetchMock);
    const counter = createPageCounter(fetchPageCount, 800);
    const seen: PrintedPages[] = [];
    counter.subscribe((s) => seen.push(s));

    counter.update(doc("a"));
    await vi.advanceTimersByTimeAsync(800);
    calls[0].respond(2);
    await vi.advanceTimersByTimeAsync(0);

    counter.update(doc("b"));
    expect(seen.at(-1)).toEqual({ pages: 2, checking: true, failed: false });
    await vi.advanceTimersByTimeAsync(800);
    calls[1].fail();
    await vi.advanceTimersByTimeAsync(3000);
    calls[2].fail();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)).toEqual({ pages: 2, checking: false, failed: true });
    counter.dispose();
  });

  it("retries once after a failure and then reports failed", async () => {
    const { calls, fetchMock } = heldFetch();
    vi.stubGlobal("fetch", fetchMock);
    const counter = createPageCounter(fetchPageCount, 800);
    const seen: PrintedPages[] = [];
    counter.subscribe((s) => seen.push(s));

    counter.update(doc("a"));
    await vi.advanceTimersByTimeAsync(800);
    calls[0].fail();
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seen.at(-1)).toEqual({ pages: null, checking: true, failed: false });
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.map((c) => c.name)).toEqual(["a", "a"]);
    calls[1].fail();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)).toEqual({ pages: null, checking: false, failed: true });
    // Only once: no third attempt for the same document.
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // A failure followed by a success is a count, not a failure.
    counter.update(doc("b"));
    await vi.advanceTimersByTimeAsync(800);
    calls[2].fail();
    await vi.advanceTimersByTimeAsync(3000);
    calls[3].respond(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)).toEqual({ pages: 2, checking: false, failed: false });
    counter.dispose();
  });

  it("drops a pending retry when the document changes", async () => {
    const { calls, fetchMock } = heldFetch();
    vi.stubGlobal("fetch", fetchMock);
    const counter = createPageCounter(fetchPageCount, 800);
    counter.update(doc("a"));
    await vi.advanceTimersByTimeAsync(800);
    calls[0].fail();
    await vi.advanceTimersByTimeAsync(1000);
    counter.update(doc("b"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls.map((c) => c.name)).toEqual(["a", "b"]);
    counter.dispose();
  });

  it("sends nothing after dispose", async () => {
    const { fetchMock } = heldFetch();
    vi.stubGlobal("fetch", fetchMock);
    const counter = createPageCounter(fetchPageCount, 800);
    counter.update(doc("a"));
    counter.dispose();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
