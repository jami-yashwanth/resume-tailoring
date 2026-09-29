import { describe, expect, it } from "vitest";
import { downloadBlocks, downloadName, safeName } from "./download";
import type { RenderedLine } from "./view";

const line = (key: string, state: RenderedLine["state"], text: string): RenderedLine => ({
  key, blockId: key, kind: "bullet", section: null, style: null, text, state,
  runs: [], size: 10.5, spaceBefore: 0, align: "left", ruleBelow: false,
});

describe("downloadBlocks", () => {
  it("sends what the user kept and nothing they did not agree to", () => {
    const blocks = downloadBlocks([
      line("a", "unchanged", "Kept."),
      line("b", "pending", "Not decided."),
      line("c", "removed", "Dropped to fit."),
      line("d", "added", "Added by you."),
      line("e", "reverted", "Your words."),
    ]);
    expect(blocks).toEqual([
      { kind: "bullet", text: "Kept." },
      { kind: "bullet", text: "Added by you." },
      { kind: "bullet", text: "Your words." },
    ]);
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
