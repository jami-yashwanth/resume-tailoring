import { describe, expect, it } from "vitest";
import type { TemplateDocument, TemplateSection } from "./document";
import { commitEdit, countsLabel, findBlockSection, findOpItem, findOpSection, moveTargets, sectionCounts, sectionKey, sectionName } from "./sections";

const section = (over: Partial<TemplateSection> = {}): TemplateSection => ({
  heading: null, kind: "experience", lead: [], entries: [], skills: [], items: [], ...over,
});

describe("sectionCounts", () => {
  it("counts pending, reworded and edited marks", () => {
    const s = section({
      lead: [{ text: "a", bullet: false, state: "pending", opId: "d1" }],
      entries: [{ org: null, title: null, dates: null, place: null, items: [
        { text: "b", bullet: true, state: "reworded", opId: "r1" },
        { text: "c", bullet: true, state: "edited", blockId: "7" },
        { text: "d", bullet: true, state: "unchanged" },
      ] }],
      skills: [{ label: "L", items: "x", state: "pending", opId: "d2" }],
      items: [{ text: "e", bullet: false, state: "edited" }],
    });
    expect(sectionCounts(s)).toEqual({ toDecide: 2, reworded: 1, edited: 2 });
  });
});

describe("countsLabel", () => {
  it("joins present counts and is null when none", () => {
    expect(countsLabel({ toDecide: 2, reworded: 1, edited: 0 })).toBe("2 to decide · 1 reworded");
    expect(countsLabel({ toDecide: 0, reworded: 0, edited: 1 })).toBe("1 edited");
    expect(countsLabel({ toDecide: 0, reworded: 0, edited: 0 })).toBeNull();
  });
});

describe("sectionName", () => {
  it("prefers the heading", () => {
    expect(sectionName(section({ heading: "WORK HISTORY" }))).toBe("WORK HISTORY");
    expect(sectionName(section({ kind: "education" }))).toBe("Education");
    expect(sectionName(section({ kind: "other" }))).toBe("Other");
  });
});

describe("findOpSection", () => {
  it("locates a pending draft", () => {
    const doc: TemplateDocument = { name: null, contact: [], sections: [
      section({ heading: "A" }),
      section({ heading: "B", entries: [{ org: null, title: null, dates: null, place: null, items: [
        { text: "x", bullet: true, state: "pending", opId: "d9" },
      ] }] }),
    ] };
    expect(findOpSection(doc, "d9")).toBe(1);
    expect(findOpSection(doc, "nope")).toBeNull();
  });
});

describe("commitEdit", () => {
  it("ignores unchanged and empty text", () => {
    expect(commitEdit({ slot: "7", current: "Same.", next: "Same.", original: "Orig." })).toBeNull();
    expect(commitEdit({ slot: "7", current: "Same.", next: "   ", original: "Orig." })).toBeNull();
  });
  it("returns undoEdit when the text equals the original", () => {
    expect(commitEdit({ slot: "7", current: "Mine.", next: "Orig.", original: "Orig." })).toEqual({ type: "undoEdit", slot: "7" });
    expect(commitEdit({ slot: "7", current: "Orig.", next: "Mine.", original: "Orig." })).toEqual({ type: "edit", slot: "7", text: "Mine." });
  });
});

describe("moveTargets", () => {
  it("at the ends", () => {
    expect(moveTargets([2, 0, 1], 2)).toEqual({ up: null, down: 1 });
    expect(moveTargets([2, 0, 1], 0)).toEqual({ up: 0, down: 2 });
    expect(moveTargets([2, 0, 1], 1)).toEqual({ up: 1, down: null });
  });
});

describe("findOpItem", () => {
  it("returns the section and the item key for an operation", () => {
    const doc: TemplateDocument = { name: null, contact: [], sections: [
      section({ heading: "A", items: [{ text: "x", bullet: true, state: "reworded", opId: "r1", key: "line-b3" }] }),
    ] };
    expect(findOpItem(doc, "r1")).toEqual({ section: 0, key: "line-b3" });
    expect(findOpItem(doc, "nope")).toBeNull();
  });
});

describe("sectionKey", () => {
  it("is stable from the outline index, and from position without one", () => {
    expect(sectionKey(section({ outlineIndex: 2 }), 5)).toBe("s-2");
    expect(sectionKey(section({ outlineIndex: -1 }), 0)).toBe("s--1");
    expect(sectionKey(section({}), 3)).toBe("s-p3");
  });
});

describe("findBlockSection", () => {
  it("locates the section whose lines include a block", () => {
    const doc: TemplateDocument = { name: null, contact: [], sections: [
      section({ heading: "A", items: [{ text: "x", bullet: false, blockId: "b3" }] }),
      section({ heading: "B", entries: [{ org: null, title: null, dates: null, place: null, fields: { org: "b9" }, items: [{ text: "y", bullet: true, blockId: "b5" }] }] }),
    ] };
    expect(findBlockSection(doc, "b5")).toBe(1);
    expect(findBlockSection(doc, "b9")).toBe(1);
    expect(findBlockSection(doc, "nope")).toBeNull();
  });
});
