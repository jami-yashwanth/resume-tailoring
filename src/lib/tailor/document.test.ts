import { describe, expect, it } from "vitest";
import { blocksToDocument, linesToDocument, resolveDocument, splitSkillRow } from "./document";
import type { Outline, Section } from "./types";
import type { RenderedLine } from "./view";

const line = (
  blockId: string,
  text: string,
  state: RenderedLine["state"] = "unchanged",
  kind: RenderedLine["kind"] = "bullet",
): RenderedLine => ({
  key: `line-${blockId}-${text}`, blockId, kind, section: null, style: null, text, state,
  runs: [], size: 10.5, spaceBefore: 0, align: "left", ruleBelow: false,
});

const ref = (block: string, text: string) => ({ block, text });
const section = (over: Partial<Section>): Section => ({
  heading: null, kind: "experience", entries: [], skills: [], lines: [], ...over,
});
const outline = (sections: Section[], over: Partial<Outline> = {}): Outline => ({
  name: null, contact: [], sections, ...over,
});
const entry = (over: Partial<Section["entries"][number]> = {}): Section["entries"][number] => ({
  org: null, title: null, dates: null, place: null, bullets: [], lines: [], ...over,
});

const texts = (items: { text: string }[]) => items.map((i) => i.text);

describe("resolveDocument", () => {
  it("fills entry fields from refs and bullets from decided lines", () => {
    const doc = resolveDocument(
      outline(
        [section({ heading: "h", entries: [entry({
          org: ref("o", "Inncircles"), title: ref("t", "Engineer"),
          dates: ref("d", "2023 - 2026"), place: ref("p", "Hyderabad"), bullets: ["b1"],
        })] })],
        { name: "n", contact: ["c"] },
      ),
      [
        line("n", "Priya Sharma", "unchanged", "name"),
        line("c", "priya@example.com", "unchanged", "contact"),
        line("h", "EXPERIENCE", "unchanged", "heading"),
        line("b1", "Designed APIs.", "reworded"),
      ],
    );
    expect(doc.name).toBe("Priya Sharma");
    expect(doc.contact).toEqual(["priya@example.com"]);
    expect(doc.sections[0].heading).toBe("EXPERIENCE");
    expect(doc.sections[0].entries[0]).toMatchObject({
      org: "Inncircles", title: "Engineer", dates: "2023 - 2026", place: "Hyderabad",
      items: [{ text: "Designed APIs.", bullet: true }],
    });
  });

  it("an approved insert after a bullet lands after it; a pending or skipped one does not", () => {
    const o = outline([section({ entries: [entry({ bullets: ["b1", "b2"] })] })]);
    const doc = resolveDocument(o, [
      line("b1", "First."),
      line("b1", "Added.", "added"),
      line("b1", "Needs OK.", "pending"),
      line("b2", "Second."),
    ]);
    expect(texts(doc.sections[0].entries[0].items)).toEqual(["First.", "Added.", "Second."]);
  });

  it("a removed bullet vanishes", () => {
    const o = outline([section({ entries: [entry({ bullets: ["b1", "b2"] })] })]);
    const doc = resolveDocument(o, [line("b1", "Gone.", "removed"), line("b2", "Stays.")]);
    expect(texts(doc.sections[0].entries[0].items)).toEqual(["Stays."]);
  });

  it("applies a heading rename", () => {
    const o = outline([section({ heading: "h" }), section({ heading: "gone" })]);
    const doc = resolveDocument(o, [
      line("h", "Experience", "reworded", "heading"),
      line("gone", "X", "removed", "heading"),
    ]);
    expect(doc.sections[0].heading).toBe("Experience");
    expect(doc.sections[1].heading).toBeNull();
  });

  it("an approved insert after a skills row becomes a row", () => {
    const o = outline([
      section({ kind: "skills", skills: [{ block: "s1", label: "Languages", items: "Python, Go" }] }),
    ]);
    const doc = resolveDocument(o, [
      line("s1", "Languages: Python, Go", "unchanged", "paragraph"),
      line("s1", "Kubernetes", "added", "paragraph"),
    ]);
    expect(doc.sections[0].skills).toMatchObject([
      { label: "Languages", items: "Python, Go" },
      { label: null, items: "Kubernetes", state: "added" },
    ]);
  });

  it("marks skills rows with their lines: a pending draft after a row, and a reworded row", () => {
    const o = outline([
      section({ kind: "skills", skills: [{ block: "s1", label: "Languages", items: "Python, Go" }] }),
    ]);
    const doc = resolveDocument(
      o,
      [
        { ...line("s1", "Languages: Python, Go, Rust", "reworded", "paragraph"), opId: "r1" },
        { ...line("s1", "Kafka", "pending", "paragraph"), opId: "p1" },
      ],
      { drafts: true },
    );
    expect(doc.sections[0].skills).toMatchObject([
      { label: "Languages", items: "Python, Go, Rust", state: "reworded", opId: "r1", blockId: "s1" },
      { label: null, items: "Kafka", state: "pending", opId: "p1", blockId: "s1" },
    ]);
  });

  it("keeps structure the user placed even when everything in it resolved to nothing", () => {
    const o = outline([section({ entries: [entry({ bullets: ["b1"], lines: ["l1"] })] })], { contact: ["c1", "c2"] });
    const doc = resolveDocument(o, [line("b1", "x", "removed"), line("c1", "a@b.c"), line("c1", "+91 1", "added")]);
    expect(doc.sections[0].entries).toMatchObject([
      { org: null, title: null, dates: null, place: null, items: [] },
    ]);
    expect(doc.contact).toEqual(["a@b.c", "+91 1"]);
  });
});

describe("inserts anchored to structure blocks", () => {
  it("routes an added line on an org block to the front of that entry's lines, once", () => {
    const o = outline([section({ entries: [entry({ org: ref("o", "Inncircles"), lines: ["l1"] })] })]);
    const doc = resolveDocument(o, [
      line("o", "Inncircles", "unchanged", "role"),
      line("o", "Remote-first team.", "added", "role"),
      line("l1", "Detail."),
    ]);
    expect(doc.sections[0].entries[0].items).toMatchObject([
      { text: "Remote-first team.", bullet: false },
      { text: "Detail.", bullet: true },
    ]);
    expect(doc.sections[0].entries[0].org).toBe("Inncircles");
  });

  it("yields a split block's added line once", () => {
    const o = outline([section({ entries: [entry({ org: ref("o", "Inncircles"), dates: ref("o", "Jun 2023") })] })]);
    const doc = resolveDocument(o, [
      line("o", "Inncircles\tJun 2023", "unchanged", "role"),
      line("o", "Added once.", "added", "role"),
    ]);
    expect(doc.sections[0].entries[0].items).toMatchObject([{ text: "Added once.", bullet: false }]);
  });

  it("routes an added line on a heading to the front of the section's lines", () => {
    const o = outline([section({ heading: "h", lines: ["l1"] })]);
    const doc = resolveDocument(o, [
      line("h", "Experience", "reworded", "heading"),
      line("h", "Intro.", "added", "heading"),
      line("l1", "Body."),
    ]);
    expect(doc.sections[0].heading).toBe("Experience");
    expect(doc.sections[0].lead).toMatchObject([
      { text: "Intro.", bullet: false },
      { text: "Body.", bullet: true },
    ]);
    expect(doc.sections[0].items).toEqual([]);
  });

  it("leads the document with an added line after the name, as a marked item, and keeps the name", () => {
    const o = outline([section({ heading: "h" })], { name: "n", contact: ["c"] });
    const doc = resolveDocument(o, [
      line("n", "Priya Sharma", "unchanged", "name"),
      { ...line("n", "Open to relocation", "added", "name"), opId: "op1" },
      line("c", "a@b.c", "unchanged", "contact"),
      line("h", "Experience", "unchanged", "heading"),
    ]);
    expect(doc.name).toBe("Priya Sharma");
    expect(doc.contact).toEqual(["a@b.c"]);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0]).toMatchObject({
      heading: null, kind: "other",
      lead: [{ text: "Open to relocation", bullet: false, state: "added", opId: "op1", blockId: "n" }],
    });
    expect(doc.sections[1].heading).toBe("Experience");
  });

  it("marks a pending draft after the name and keeps it out of the contact line", () => {
    const o = outline([], { name: "n", contact: ["c"] });
    const lines = [
      line("n", "Priya Sharma", "unchanged", "name"),
      { ...line("n", "Kafka draft.", "pending", "name"), opId: "p1" },
      line("c", "a@b.c", "unchanged", "contact"),
    ];
    const preview = resolveDocument(o, lines, { drafts: true });
    expect(preview.contact).toEqual(["a@b.c"]);
    expect(preview.sections[0].lead).toMatchObject([{ text: "Kafka draft.", state: "pending", opId: "p1" }]);
    // The file has no draft, and no empty leading section either.
    expect(resolveDocument(o, lines).sections).toEqual([]);
  });
});

describe("document order", () => {
  it("keeps an entry's Tech line after its bullets when the file has it there", () => {
    const o = outline([section({ entries: [entry({ org: ref("o", "Acme"), bullets: ["b1", "b2"], lines: ["t"] })] })]);
    const doc = resolveDocument(o, [
      line("o", "Acme", "unchanged", "role"),
      line("b1", "Built A."),
      line("b2", "Built B."),
      line("t", "Tech: Go, Postgres", "unchanged", "paragraph"),
    ]);
    expect(doc.sections[0].entries[0].items).toMatchObject([
      { text: "Built A.", bullet: true },
      { text: "Built B.", bullet: true },
      { text: "Tech: Go, Postgres", bullet: false },
    ]);
  });

  it("interleaves an entry's lines and bullets as the file does", () => {
    const o = outline([section({ entries: [entry({ bullets: ["b1", "b2"], lines: ["l1"] })] })]);
    const doc = resolveDocument(o, [
      line("b1", "One."),
      line("l1", "Middle.", "unchanged", "paragraph"),
      line("b2", "Two."),
    ]);
    expect(texts(doc.sections[0].entries[0].items)).toEqual(["One.", "Middle.", "Two."]);
  });

  it("splits loose section lines into lead (before the entries) and items (after)", () => {
    const o = outline([section({
      heading: "h", lines: ["intro", "tail"], entries: [entry({ org: ref("o", "Acme"), bullets: ["b1"] })],
    })]);
    const doc = resolveDocument(o, [
      line("h", "Experience", "unchanged", "heading"),
      line("h", "Heading insert.", "added", "heading"),
      line("intro", "Intro.", "unchanged", "paragraph"),
      line("o", "Acme", "unchanged", "role"),
      line("b1", "Did."),
      line("tail", "• Loose bullet.", "unchanged", "bullet"),
    ]);
    expect(doc.sections[0].lead).toMatchObject([
      { text: "Heading insert.", bullet: false },
      { text: "Intro.", bullet: false },
    ]);
    expect(doc.sections[0].items).toMatchObject([{ text: "• Loose bullet.", bullet: true }]);
  });

  it("a loose line after a skills row goes to items; one before it to lead", () => {
    const o = outline([section({
      kind: "skills", lines: ["a", "z"], skills: [{ block: "s1", label: null, items: "Go" }],
    })]);
    const doc = resolveDocument(o, [
      line("a", "Before.", "unchanged", "paragraph"),
      line("s1", "Go", "unchanged", "paragraph"),
      line("z", "After.", "unchanged", "paragraph"),
    ]);
    expect(texts(doc.sections[0].lead)).toEqual(["Before."]);
    expect(texts(doc.sections[0].items)).toEqual(["After."]);
  });

  it("a section with only bullets keeps their marks", () => {
    const o = outline([section({ kind: "achievements", lines: ["a1", "a2"] })]);
    const doc = resolveDocument(o, [line("a1", "Won X."), line("a2", "Won Y.")]);
    expect([...doc.sections[0].lead, ...doc.sections[0].items]).toMatchObject([
      { text: "Won X.", bullet: true },
      { text: "Won Y.", bullet: true },
    ]);
  });
});

describe("splitSkillRow", () => {
  it("keeps the label only when the reworded text still starts with it", () => {
    expect(splitSkillRow("Languages: Python, Go", "Languages")).toEqual({ label: "Languages", items: "Python, Go" });
    expect(splitSkillRow("Languages : Python", "Languages")).toEqual({ label: "Languages", items: "Python" });
    expect(splitSkillRow("Python, Go, Rust", "Languages")).toEqual({ label: null, items: "Python, Go, Rust" });
    expect(splitSkillRow("Python, Go", null)).toEqual({ label: null, items: "Python, Go" });
  });
});

describe("blocksToDocument", () => {
  it("builds a one-section document", () => {
    const doc = blocksToDocument([
      { kind: "name", text: "Priya Sharma" },
      { kind: "contact", text: "a@b.com | Hyderabad" },
      { kind: "heading", text: "Experience" },
      { kind: "role", text: "Google\tJun 2022" },
      { kind: "job_title", text: "Engineer" },
      { kind: "bullet", text: "•  Built things" },
    ]);
    expect(doc.name).toBe("Priya Sharma");
    expect(doc.contact).toEqual(["a@b.com | Hyderabad"]);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].heading).toBe("Experience");
    expect(doc.sections[0].entries).toEqual([
      { org: "Google", dates: "Jun 2022", title: "Engineer", place: null,
        items: [{ text: "Built things", bullet: true }] },
    ]);
  });

  it("never drops a block", () => {
    const blocks = [
      { kind: "name" as const, text: "Priya" },
      { kind: "name" as const, text: "Second Name" },
      { kind: "job_title" as const, text: "Orphan Title" },
      { kind: "heading" as const, text: "Experience" },
      { kind: "role" as const, text: "Acme\t2020" },
      { kind: "job_title" as const, text: "Engineer" },
      { kind: "job_title" as const, text: "Extra Title" },
    ];
    const json = JSON.stringify(blocksToDocument(blocks));
    for (const t of blocks.flatMap((b) => b.text.split("\t"))) expect(json).toContain(t);
  });

  it("puts blocks before any heading in a heading-less section", () => {
    const doc = blocksToDocument([{ kind: "paragraph", text: "Hello" }]);
    expect(doc.sections[0].heading).toBeNull();
    expect(doc.sections[0].items).toEqual([{ text: "Hello", bullet: false }]);
  });
});

describe("resolveDocument marks", () => {
  it("carries marks onto items", () => {
    const l = { ...line("b1", "Better words", "reworded"), opId: "op1" };
    const doc = resolveDocument(
      outline([section({ heading: "h", entries: [entry({ org: ref("o", "Acme"), bullets: ["b1"] })] })]),
      [line("h", "Experience", "unchanged", "heading"), l],
    );
    expect(doc.sections[0].entries[0].items[0]).toMatchObject({
      text: "Better words", bullet: true, state: "reworded", opId: "op1", blockId: "b1", key: l.key,
    });
  });
});

describe("linesToDocument", () => {
  const grouped = () => [
    line("n", "Priya Sharma", "unchanged", "name"),
    line("h", "Experience", "unchanged", "heading"),
    line("r", "Acme\t2020 - 2024", "unchanged", "role"),
    { ...line("b1", "Better words.", "reworded"), opId: "op1" },
    { ...line("b2", "Gone.", "removed"), opId: "op2" },
    { ...line("b2", "Needs OK.", "pending"), opId: "op3" },
    { ...line("b3", "Added line.", "added"), opId: "op4" },
  ];

  it("builds a document when there is no outline", () => {
    const doc = linesToDocument(grouped());
    const json = JSON.stringify(doc);
    expect(json).not.toContain("Gone.");
    expect(json).not.toContain("Needs OK.");
    expect(doc.name).toBe("Priya Sharma");
    expect(doc.sections[0].entries[0]).toMatchObject({ org: "Acme", dates: "2020 - 2024" });
    expect(doc.sections[0].entries[0].items).toMatchObject([
      { text: "Better words.", bullet: true, state: "reworded", opId: "op1", blockId: "b1" },
      { text: "Added line.", bullet: true, state: "added", opId: "op4", blockId: "b3" },
    ]);
  });

  it("marks a draft after the name as a line of its own, not a contact string", () => {
    const lines = [
      line("n", "Priya Sharma", "unchanged", "name"),
      { ...line("n", "Kafka draft.", "pending", "name"), opId: "p1" },
      line("c", "a@b.c", "unchanged", "contact"),
    ];
    const doc = linesToDocument(lines, { drafts: true });
    expect(doc.contact).toEqual(["a@b.c"]);
    expect(doc.sections[0].items).toMatchObject([{ text: "Kafka draft.", bullet: false, state: "pending", opId: "p1" }]);
  });

  it("keeps drafts and removed lines for the preview when asked", () => {
    const items = linesToDocument(grouped(), { drafts: true }).sections[0].entries[0].items;
    expect(items.map((i) => [i.text, i.state])).toEqual([
      ["Better words.", "reworded"],
      ["Gone.", "removed"],
      ["Needs OK.", "pending"],
      ["Added line.", "added"],
    ]);
  });
});

describe("resolveDocument drafts", () => {
  it("leaves drafts out of the file and keeps them, marked, for the preview", () => {
    const o = outline([section({ heading: "h", entries: [entry({ bullets: ["b1"] })] })]);
    const lines = [
      line("h", "Experience", "unchanged", "heading"),
      { ...line("h", "Heading draft.", "pending", "heading"), opId: "p0" },
      line("b1", "First."),
      { ...line("b1", "Needs OK.", "pending"), opId: "p1" },
    ];
    const file = resolveDocument(o, lines);
    expect(JSON.stringify(file)).not.toContain("Needs OK.");
    expect(JSON.stringify(file)).not.toContain("Heading draft.");
    const preview = resolveDocument(o, lines, { drafts: true });
    expect(preview.sections[0].heading).toBe("Experience");
    expect(preview.sections[0].lead).toMatchObject([{ text: "Heading draft.", state: "pending", opId: "p0" }]);
    expect(preview.sections[0].entries[0].items).toMatchObject([
      { text: "First." },
      { text: "Needs OK.", state: "pending", opId: "p1" },
    ]);
  });
});

describe("resolveDocument with edits and section order", () => {
  const o = () =>
    outline(
      [
        section({ heading: "h1", kind: "experience", entries: [entry({ org: ref("9", "Google"), dates: ref("9", "Jun 2022"), bullets: ["b1"] })] }),
        section({ heading: "h2", kind: "education", lines: ["e1"] }),
        section({ heading: "h3", kind: "skills", skills: [{ block: "s1", label: "Languages", items: "Go" }] }),
      ],
      { name: "n", contact: ["c"] },
    );
  const lines = () => [
    line("n", "Priya", "unchanged", "name"),
    line("c", "priya@example.com", "unchanged", "contact"),
    line("h1", "EXPERIENCE", "unchanged", "heading"),
    line("9", "Google\tJun 2022", "unchanged", "role"),
    line("b1", "Shipped X."),
    line("h2", "EDUCATION", "unchanged", "heading"),
    line("e1", "BTech", "unchanged", "paragraph"),
    line("h3", "SKILLS", "unchanged", "heading"),
    line("s1", "Languages: Go", "unchanged", "paragraph"),
  ];

  it("applies field edits to org and dates on a split block", () => {
    const doc = resolveDocument(o(), lines(), { edits: { "9:dates": "Jun 2022 – Present" } });
    expect(doc.sections[0].entries[0]).toMatchObject({ org: "Google", dates: "Jun 2022 – Present" });
  });

  it("orders sections by sectionOrder and keeps the leading section first", () => {
    const doc = resolveDocument(
      o(),
      [...lines(), line("n", "Lead draft", "pending", "name")],
      { drafts: true, sectionOrder: [2, 0, 1] },
    );
    expect(doc.sections.map((s) => s.heading)).toEqual([null, "SKILLS", "EXPERIENCE", "EDUCATION"]);
    expect(doc.sections.map((s) => s.outlineIndex)).toEqual([-1, 2, 0, 1]);
  });

  it("ignores unknown section indices and appends missing ones", () => {
    const doc = resolveDocument(o(), lines(), { sectionOrder: [5, 1] });
    expect(doc.sections.map((s) => s.heading)).toEqual(["EDUCATION", "EXPERIENCE", "SKILLS"]);
  });

  it("exposes field block ids, outline index, name and contact marks", () => {
    const doc = resolveDocument(o(), lines());
    expect(doc.sections[0].entries[0].fields).toEqual({ org: "9", dates: "9" });
    expect(doc.sections[0].outlineIndex).toBe(0);
    expect(doc.nameMark).toMatchObject({ blockId: "n", state: "unchanged" });
    expect(doc.contactMarks).toHaveLength(1);
    expect(doc.contactMarks?.[0]).toMatchObject({ blockId: "c" });
  });
});
