import { describe, expect, it, vi } from "vitest";
import { applyStructure } from "./structure";
import type { Block, BlockKind, Layout } from "./types";

const block = (id: string, kind: BlockKind, text: string, section: string | null = null): Block => ({
  id,
  kind,
  text,
  section,
  style: null,
  lines: 1,
  has_bold: false,
  runs: [{ text, bold: false, italic: false, size: null, color: null }],
  size: 11,
  space_before: 0,
});

/** The resume this was reported against: the parser read "CGPA: 8.38" as a
 *  section heading because every letter in it is a capital. */
const layout = (): Layout => ({
  format: "pdf",
  pages: 1,
  fonts: [],
  warnings: [],
  blocks: [
    block("0", "name", "Jami Yashwanth"),
    block("1", "contact", "jami@example.com | Hyderabad"),
    block("2", "heading", "EDUCATION"),
    block("3", "role", "Vignan's Institute Of Information Technology, Visakhapatnam\tAug 2019 – Jun 2023", "EDUCATION"),
    block("4", "role", "BTech, Computer Science Engineering", "EDUCATION"),
    block("5", "heading", "CGPA: 8.38"),
    block("6", "heading", "PROJECTS"),
    block("7", "role", "Coders gallery\t2024", "PROJECTS"),
    block("8", "bullet", "• Deployed a full-stack application on AWS EC2.", "PROJECTS"),
  ],
});

const corrected = (): { id: string; kind: BlockKind }[] =>
  layout().blocks.map((b) => ({ id: b.id, kind: b.id === "5" ? "paragraph" : b.kind }));

describe("applyStructure", () => {
  it("relabels a block and puts it back inside the section it belongs to", () => {
    const result = applyStructure(layout(), corrected());
    expect(result).not.toBeNull();
    const cgpa = result!.layout.blocks.find((b) => b.id === "5")!;
    expect(cgpa.kind).toBe("paragraph");
    expect(cgpa.section).toBe("EDUCATION");
    expect(result!.changed).toBe(1);
  });

  it("recomputes every section from the corrected headings", () => {
    const labels = corrected();
    // The model also caught that "PROJECTS" is a heading and the parser was right.
    const result = applyStructure(layout(), labels)!;
    expect(result.layout.blocks.map((b) => b.section)).toEqual([
      null, null, null, "EDUCATION", "EDUCATION", "EDUCATION", null, "PROJECTS", "PROJECTS",
    ]);
  });

  it("never changes a word of the text", () => {
    const before = layout().blocks.map((b) => b.text);
    const result = applyStructure(layout(), corrected())!;
    expect(result.layout.blocks.map((b) => b.text)).toEqual(before);
  });

  it("rejects an answer that skips a block", () => {
    expect(applyStructure(layout(), corrected().slice(1))).toBeNull();
  });

  it("rejects an answer that names a block twice or invents one", () => {
    const labels = corrected();
    expect(applyStructure(layout(), [...labels, { id: "3", kind: "role" }])).toBeNull();
    expect(applyStructure(layout(), [...labels.slice(0, -1), { id: "99", kind: "bullet" }])).toBeNull();
  });

  it("keeps a line the parser saw a bullet marker on as a bullet", () => {
    const labels = corrected().map((l) => (l.id === "8" ? { ...l, kind: "paragraph" as const } : l));
    const result = applyStructure(layout(), labels)!;
    expect(result.layout.blocks.find((b) => b.id === "8")!.kind).toBe("bullet");
  });

  it("refuses to make a long sentence into a heading", () => {
    const labels = corrected().map((l) => (l.id === "8" ? l : l.id === "3" ? { ...l, kind: "heading" as const } : l));
    expect(applyStructure(layout(), labels)).toBeNull();
  });
});
