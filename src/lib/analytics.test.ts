import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "./analytics";

/** The two contracts that matter: nothing is sent unless analytics is
 *  configured, and what is sent is the event name plus flat scalar props —
 *  never document text. */

const fetchMock = vi.fn(() => Promise.resolve(new Response()));

beforeEach(() => {
  vi.stubGlobal("window", { location: { href: "http://localhost/upload" } });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
});

describe("track", () => {
  it("sends nothing when no analytics domain is configured", () => {
    track("upload_started");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the event with the configured domain when enabled", () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "rezz.example";
    track("tailor_done", { pages: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/event");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      name: "tailor_done",
      url: "http://localhost/upload",
      domain: "rezz.example",
      props: { pages: 2 },
    });
  });

  it("never throws when fetch fails", () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "rezz.example";
    fetchMock.mockImplementationOnce(() => {
      throw new Error("offline");
    });
    expect(() => track("download_clicked")).not.toThrow();
  });
});
