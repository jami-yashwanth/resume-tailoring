import { describe, expect, it } from "vitest";
import { checkOutline, coversExactly, outlineLabels } from "./outline";
import type { Block, BlockKind, Entry, Layout, Outline, Section } from "./types";

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
    block("9", "role", "Google\tJun 2022 – Present", "WORK HISTORY"),
    block("10", "heading", "WORK HISTORY"),
    block("11", "paragraph", "Languages: Python, Go", "SKILLS"),
    block("12", "heading", "SKILLS"),
  ],
});

const entry = (over: Partial<Entry> = {}): Entry => ({
  org: null,
  title: null,
  dates: null,
  place: null,
  bullets: [],
  lines: [],
  ...over,
});
const section = (over: Partial<Section>): Section => ({
  heading: null,
  kind: "other",
  entries: [],
  skills: [],
  lines: [],
  ...over,
});

const education = () =>
  section({
    heading: "2",
    kind: "education",
    entries: [
      entry({
        org: { block: "3", text: "Vignan's Institute Of Information Technology, Visakhapatnam" },
        dates: { block: "3", text: "Aug 2019 – Jun 2023" },
        title: { block: "4", text: "BTech, Computer Science Engineering" },
        lines: ["5"],
      }),
    ],
  });
const projects = () =>
  section({
    heading: "6",
    kind: "projects",
    entries: [
      entry({ org: { block: "7", text: "Coders gallery" }, dates: { block: "7", text: "2024" }, bullets: ["8"] }),
    ],
  });
const work = () =>
  section({
    heading: "10",
    kind: "experience",
    entries: [entry({ org: { block: "9", text: "Google" }, dates: { block: "9", text: "Jun 2022 – Present" } })],
  });
const skills = () =>
  section({
    heading: "12",
    kind: "skills",
    skills: [{ block: "11", label: "Languages", items: "Python, Go" }],
  });

const good = (): Outline => ({
  name: "0",
  contact: ["1"],
  sections: [education(), projects(), work(), skills()],
});

describe("coversExactly", () => {
  it("splits a tab-merged role line into org and dates without touching either", () =>
    expect(coversExactly("Google\tJun 2022 – Present", ["Google", "Jun 2022 – Present"])).toBe(true));
  it("rejects a part that is not in the line", () =>
    expect(coversExactly("Google\tJun 2022 – Present", ["Google", "Jun 2022 – Now"])).toBe(false));
  it("rejects parts that leave words behind", () =>
    expect(coversExactly("Google, Bengaluru\tJun 2022 – Present", ["Google", "Jun 2022 – Present"])).toBe(false));
  it("ignores separators and case only", () =>
    expect(coversExactly("Languages: Python, Go", ["languages", "Python, Go"])).toBe(true));
});

describe("checkOutline", () => {
  it("accepts a good outline and sorts sections into document order", () => {
    const outline = good();
    outline.sections.reverse();
    outline.contact = ["1"];
    const result = checkOutline(layout(), outline);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outline.sections.map((s) => s.kind)).toEqual(["education", "projects", "experience", "skills"]);
    // Text passes through untouched.
    expect(result.outline.sections[2].entries[0].dates?.text).toBe("Jun 2022 – Present");
  });

  it("sorts entries and bullets by block position", () => {
    const outline = good();
    outline.sections[0].entries = [
      entry({ org: { block: "4", text: "BTech, Computer Science Engineering" } }),
      entry({
        org: { block: "3", text: "Vignan's Institute Of Information Technology, Visakhapatnam" },
        dates: { block: "3", text: "Aug 2019 – Jun 2023" },
        lines: ["5"],
      }),
    ];
    const result = checkOutline(layout(), outline);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outline.sections[0].entries[0].org?.block).toBe("3");
  });

  it("rejects an invented value", () => {
    const outline = good();
    outline.sections[2].entries[0].dates = { block: "9", text: "2021 – Present" };
    const result = checkOutline(layout(), outline);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.startsWith("text not in block")).toBe(true);
  });

  it("accepts a Ref whose spacing differs from the block's and stores it collapsed", () => {
    const outline = good();
    outline.sections[2].entries[0].dates = { block: "9", text: "Jun  2022 – Present" };
    outline.sections[3].skills[0] = { block: "11", label: "Languages ", items: "Python,  Go" };
    const result = checkOutline(layout(), outline);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byKind = (k: string) => result.outline.sections.find((s) => s.kind === k)!;
    expect(byKind("experience").entries[0].dates?.text).toBe("Jun 2022 – Present");
    expect(byKind("skills").skills[0]).toEqual({ block: "11", label: "Languages", items: "Python, Go" });
  });

  it("accepts a faithful copy of a block with a double space in it", () => {
    const l = layout();
    l.blocks[9] = block("9", "role", "Google  India\tJun 2022 – Present", "WORK HISTORY");
    const outline = good();
    outline.sections[2].entries[0].org = { block: "9", text: "Google  India" };
    const result = checkOutline(l, outline);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outline.sections[2].entries[0].org?.text).toBe("Google India");
  });

  it("still rejects a Ref with different characters once spacing is collapsed", () => {
    const outline = good();
    outline.sections[2].entries[0].dates = { block: "9", text: "Jun  2022 - Present" };
    const result = checkOutline(layout(), outline);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.startsWith("text not in block")).toBe(true);
  });

  it("rejects a missing block and names it", () => {
    const outline = good();
    outline.sections[1].entries[0].bullets = [];
    const result = checkOutline(layout(), outline);
    expect(result).toMatchObject({ ok: false, reason: "missing blocks", missing: ["8"] });
  });

  it("rejects a block placed twice", () => {
    const outline = good();
    outline.contact = ["1", "0"];
    const result = checkOutline(layout(), outline);
    expect(result).toMatchObject({ ok: false, reason: "block 0 used twice" });
  });

  it("rejects a Ref block that is also placed whole", () => {
    const outline = good();
    outline.sections[0].entries[0].lines = ["5", "3"];
    expect(checkOutline(layout(), outline)).toMatchObject({ ok: false, reason: "block 3 used twice" });
  });

  it("rejects a block in two skill rows", () => {
    const outline = good();
    outline.sections[3].skills.push({ block: "11", label: null, items: "Go" });
    expect(checkOutline(layout(), outline)).toMatchObject({ ok: false, reason: "block 11 used twice" });
  });

  it("rejects one block split across two entries", () => {
    const outline = good();
    outline.sections[2].entries = [
      entry({ org: { block: "9", text: "Google" } }),
      entry({ dates: { block: "9", text: "Jun 2022 – Present" } }),
    ];
    expect(checkOutline(layout(), outline)).toMatchObject({ ok: false, reason: "block 9 used twice" });
  });

  it("rejects a skill row followed by a field on the same block", () => {
    const outline = good();
    outline.sections[3].entries = [entry({ org: { block: "11", text: "Languages" } })];
    outline.sections[3].skills = [{ block: "11", label: null, items: "Python, Go" }];
    expect(checkOutline(layout(), outline)).toMatchObject({ ok: false, reason: "block 11 used twice" });
  });

  it("rejects a parser bullet used as a header field", () => {
    const outline = good();
    outline.sections[1].entries[0].bullets = [];
    outline.sections[1].entries[0].org = { block: "8", text: "Deployed a full-stack application on AWS EC2." };
    outline.sections[1].entries[0].dates = null;
    const result = checkOutline(layout(), outline);
    expect(result).toMatchObject({ ok: false, reason: "bullet 8 used as a field" });
  });

  it("rejects a heading over 60 characters", () => {
    const l = layout();
    l.blocks[2] = block("2", "heading", "E".repeat(61));
    const result = checkOutline(l, good());
    expect(result).toMatchObject({ ok: false, reason: "heading 2 too long" });
  });

  it("rejects an unknown block and an uncovered one", () => {
    const unknown = good();
    unknown.contact = ["1", "99"];
    expect(checkOutline(layout(), unknown)).toMatchObject({ ok: false, reason: "unknown block 99" });

    const partial = good();
    partial.sections[2].entries[0].dates = null;
    expect(checkOutline(layout(), partial)).toMatchObject({ ok: false, reason: "block 9 not fully covered" });
  });

  it("accepts a resume with no headings", () => {
    const l: Layout = {
      ...layout(),
      blocks: [block("0", "paragraph", "Built things."), block("1", "paragraph", "Shipped them.")],
    };
    const outline: Outline = {
      name: null,
      contact: [],
      sections: [section({ heading: null, kind: "other", lines: ["1", "0"] })],
    };
    const result = checkOutline(l, outline);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outline.sections[0].lines).toEqual(["0", "1"]);
  });
});

describe("outlineLabels", () => {
  it("labels header fields role, bullets bullet, skills and lines paragraph", () => {
    const kinds = Object.fromEntries(outlineLabels(good()).map((l) => [l.id, l.kind]));
    expect(kinds).toMatchObject({
      "0": "name",
      "1": "contact",
      "2": "heading",
      "3": "role",
      "4": "role",
      "5": "paragraph",
      "8": "bullet",
      "9": "role",
      "11": "paragraph",
    });
  });
});
