import { describe, expect, it } from "vitest";
import { resolveDocument, splitSkillRow } from "./document";
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
    expect(doc.sections[0].entries[0]).toEqual({
      org: "Inncircles", title: "Engineer", dates: "2023 - 2026", place: "Hyderabad",
      bullets: ["Designed APIs."], lines: [],
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
    expect(doc.sections[0].entries[0].bullets).toEqual(["First.", "Added.", "Second."]);
  });

  it("a removed bullet vanishes", () => {
    const o = outline([section({ entries: [entry({ bullets: ["b1", "b2"] })] })]);
    const doc = resolveDocument(o, [line("b1", "Gone.", "removed"), line("b2", "Stays.")]);
    expect(doc.sections[0].entries[0].bullets).toEqual(["Stays."]);
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
    expect(doc.sections[0].skills).toEqual([
      { label: "Languages", items: "Python, Go" },
      { label: null, items: "Kubernetes" },
    ]);
  });

  it("keeps structure the user placed even when everything in it resolved to nothing", () => {
    const o = outline([section({ entries: [entry({ bullets: ["b1"], lines: ["l1"] })] })], { contact: ["c1", "c2"] });
    const doc = resolveDocument(o, [line("b1", "x", "removed"), line("c1", "a@b.c"), line("c1", "+91 1", "added")]);
    expect(doc.sections[0].entries).toEqual([entry()]);
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
    expect(doc.sections[0].entries[0].lines).toEqual(["Remote-first team.", "Detail."]);
    expect(doc.sections[0].entries[0].org).toBe("Inncircles");
  });

  it("yields a split block's added line once", () => {
    const o = outline([section({ entries: [entry({ org: ref("o", "Inncircles"), dates: ref("o", "Jun 2023") })] })]);
    const doc = resolveDocument(o, [
      line("o", "Inncircles\tJun 2023", "unchanged", "role"),
      line("o", "Added once.", "added", "role"),
    ]);
    expect(doc.sections[0].entries[0].lines).toEqual(["Added once."]);
  });

  it("routes an added line on a heading to the front of the section's lines", () => {
    const o = outline([section({ heading: "h", lines: ["l1"] })]);
    const doc = resolveDocument(o, [
      line("h", "Experience", "reworded", "heading"),
      line("h", "Intro.", "added", "heading"),
      line("l1", "Body."),
    ]);
    expect(doc.sections[0].heading).toBe("Experience");
    expect(doc.sections[0].lines).toEqual(["Intro.", "Body."]);
  });

  it("puts an added line after the name into contact and keeps the name", () => {
    const o = outline([], { name: "n", contact: ["c"] });
    const doc = resolveDocument(o, [
      line("n", "Priya Sharma", "unchanged", "name"),
      line("n", "Open to relocation", "added", "name"),
      line("c", "a@b.c", "unchanged", "contact"),
    ]);
    expect(doc.name).toBe("Priya Sharma");
    expect(doc.contact).toEqual(["Open to relocation", "a@b.c"]);
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
