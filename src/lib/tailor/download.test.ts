import { afterEach, describe, expect, it, vi } from "vitest";
import type { TemplateDocument } from "./document";
import { FALLBACK_NOTE, downloadName, downloadResume, safeName } from "./download";

const doc: TemplateDocument = { name: "Priya", contact: [], sections: [] };

describe("downloadResume", () => {
  afterEach(() => vi.unstubAllGlobals());

  const run = async (renderer: "chromium" | "fallback") => {
    const fetchMock = vi.fn(async () => Response.json({ file: btoa("%PDF"), pages: 1, renderer }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    const link = { click: vi.fn(), remove: vi.fn(), href: "", download: "" };
    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: { appendChild: vi.fn() },
    });
    const result = await downloadResume(doc, "priya.docx", "Kosha");
    return { result, fetchMock };
  };

  it("reports the fallback layout in the download message", async () => {
    const { result, fetchMock } = await run("fallback");
    expect(result.note).toBe(FALLBACK_NOTE);
    expect(result.pages).toBe(1);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ document: doc });
    expect((await run("chromium")).result.note).toBeNull();
  });
});

describe("file names", () => {
  it("removes characters no file system accepts", () => {
    expect(safeName('Kosha: "Payments"/India')).toBe("Kosha Payments India");
    expect(safeName("   ")).toBe("resume");
  });

  it("names the file after the upload and the company", () => {
    expect(downloadName("priya_resume.docx", "Kosha Payments")).toBe("priya_resume — Kosha Payments.pdf");
    expect(downloadName(null, "Kosha")).toBe("resume — Kosha.pdf");
  });
});
