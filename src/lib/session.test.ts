import { afterEach, describe, expect, it, vi } from "vitest";
import { session } from "./session";

/**
 * The one storage behaviour with a product consequence: a resume too big for
 * sessionStorage used to be swallowed silently, so the user was bounced back
 * to /upload by the next screen's guard with no explanation. setResume must
 * say whether the file actually survived the write.
 */

function stubStorage(store: Map<string, string>, quotaBytes: number | null) {
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (quotaBytes !== null && v.length > quotaBytes) {
        throw new DOMException("exceeded the quota", "QuotaExceededError");
      }
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal("window", { sessionStorage: storage });
}

afterEach(() => vi.unstubAllGlobals());

describe("session.setResume", () => {
  it("returns true when the file fits and can be read back", () => {
    stubStorage(new Map(), null);
    expect(session.setResume("aGVsbG8=", "resume.pdf")).toBe(true);
    expect(session.getResume()).toBe("aGVsbG8=");
    expect(session.getFilename()).toBe("resume.pdf");
  });

  it("returns false when the write exceeds the storage quota", () => {
    stubStorage(new Map(), 8);
    expect(session.setResume("a-base64-string-longer-than-quota", "resume.pdf")).toBe(false);
  });

  it("returns false when storage is blocked entirely", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => {
          throw new DOMException("blocked", "SecurityError");
        },
        setItem: () => {
          throw new DOMException("blocked", "SecurityError");
        },
        removeItem: () => {},
      },
    });
    expect(session.setResume("aGVsbG8=", "resume.pdf")).toBe(false);
  });
});
