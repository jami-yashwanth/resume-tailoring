import { describe, expect, it } from "vitest";
import type { Layout, PlannedOp } from "./types";
import { anchorLabel, buildLines, groupIntoBlocks, wordingFor, wordingOptions } from "./view";

const layout: Layout = {
  format: "docx",
  pages: 1,
  fonts: ["Georgia"],
  warnings: [],
  blocks: [
    { id: "b0", kind: "name", text: "Priya Sharma", section: null, style: null, lines: 1, has_bold: true, runs: [], size: 10.5, space_before: 0 },
    { id: "b6", kind: "bullet", text: "Worked on backend APIs for payments.", section: "EXPERIENCE", style: "List Bullet", lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
    { id: "b7", kind: "bullet", text: "Helped refactor the refunds module.", section: "EXPERIENCE", style: "List Bullet", lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
    { id: "b13", kind: "bullet", text: "Wrote unit tests.", section: "EXPERIENCE", style: "List Bullet", lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
  ],
};

const op = (over: Partial<PlannedOp>): PlannedOp => ({
  id: "o1",
  op: "rephrase",
  block: "b6",
  text: "Designed backend REST APIs for payments.",
  alternatives: [],
  claim: "reworded",
  value: 7,
  requirements: [],
  evidence: ["b6"],
  needsDecision: false,
  ...over,
});

const draft = op({
  id: "o2",
  op: "insert_after",
  block: "b7",
  text: "Worked with Apache Kafka for event streaming.",
  claim: "added_by_user",
  evidence: [],
  needsDecision: true,
});

const state = (lines: ReturnType<typeof buildLines>, key: string) =>
  lines.find((l) => l.key === key)?.state;

describe("buildLines", () => {
  it("shows a rewording in place, keeping the original for the popover", () => {
    const lines = buildLines(layout, [op({})], {});
    const line = lines.find((l) => l.blockId === "b6")!;
    expect(line.state).toBe("reworded");
    expect(line.text).toBe("Designed backend REST APIs for payments.");
    expect(line.original).toBe("Worked on backend APIs for payments.");
  });

  it("shows an undecided draft as pending, right after its anchor", () => {
    const lines = buildLines(layout, [draft], {});
    const ids = lines.map((l) => l.blockId);
    expect(ids).toEqual(["b0", "b6", "b7", "b7", "b13"]);
    expect(state(lines, "line-o2")).toBe("pending");
  });

  it("marks an accepted draft as added by the user", () => {
    const lines = buildLines(layout, [draft], { o2: true });
    expect(state(lines, "line-o2")).toBe("added");
  });

  it("leaves no trace of a skipped draft", () => {
    /* The spec forbids re-asking after a Skip, and a greyed-out reminder of
       what you declined is a way of re-asking. */
    const lines = buildLines(layout, [draft], { o2: false });
    expect(lines.some((l) => l.opId === "o2")).toBe(false);
  });

  it("leaves a line the user has not agreed to drop exactly where it was", () => {
    /* A removal takes one of the user's own sentences out of their resume.
       The planner proposing it is not the user accepting it, and this used to
       apply on sight — the same trick as adding something behind their back,
       run in reverse. */
    const remove = op({ id: "o3", op: "remove", block: "b13", text: undefined });
    const lines = buildLines(layout, [remove], {});
    const line = lines.find((l) => l.blockId === "b13")!;
    expect(line.state).toBe("unchanged");
    expect(line.text).toBe("Wrote unit tests.");
  });

  it("dims a removal the user chose instead of deleting it, so its mark has an anchor", () => {
    const remove = op({ id: "o3", op: "remove", block: "b13", text: undefined });
    const lines = buildLines(layout, [remove], { o3: true });
    const line = lines.find((l) => l.blockId === "b13")!;
    expect(line.state).toBe("removed");
    expect(line.text).toBe("Wrote unit tests.");
  });

  it("puts the user's own words back when they undo a rewording", () => {
    const lines = buildLines(layout, [op({})], { o1: false });
    const line = lines.find((l) => l.blockId === "b6")!;
    expect(line.state).toBe("reverted");
    expect(line.text).toBe("Worked on backend APIs for payments.");
    // The mark stays, so the rewording is one click away again.
    expect(line.opId).toBe("o1");
  });

  it("takes the rewording back when they ask for it again", () => {
    const lines = buildLines(layout, [op({})], { o1: undefined });
    expect(lines.find((l) => l.blockId === "b6")!.state).toBe("reworded");
  });

  it("renders the wording the user chose, not always the planner's first", () => {
    const withAlternatives = op({ alternatives: ["Built payment APIs."] });
    const lines = buildLines(layout, [withAlternatives], {}, false, { o1: 1 });
    expect(lines.find((l) => l.blockId === "b6")!.text).toBe("Built payment APIs.");
  });

  it("wraps around rather than falling off the end of the wordings", () => {
    const withAlternatives = op({ alternatives: ["Built payment APIs."] });
    expect(wordingOptions(withAlternatives)).toHaveLength(2);
    expect(wordingFor(withAlternatives, { o1: 2 })).toBe("Designed backend REST APIs for payments.");
  });

  it("shows the uploaded file untouched when comparing", () => {
    /* "Compare with original" is approved as-is: no marks, no drafts. */
    const lines = buildLines(layout, [op({}), draft], { o2: true }, true);
    expect(lines.every((l) => l.state === "unchanged")).toBe(true);
    expect(lines.map((l) => l.blockId)).toEqual(["b0", "b6", "b7", "b13"]);
    expect(lines.find((l) => l.blockId === "b6")!.text).toBe("Worked on backend APIs for payments.");
  });

  it("keeps a drafted line in the same list as the bullet it follows", () => {
    const lines = buildLines(layout, [draft], {});
    const groups = groupIntoBlocks(lines.filter((l) => l.kind !== "name"));
    expect(groups).toHaveLength(1);
    expect((groups[0] as unknown[]).length).toBe(4);
  });
});

describe("groupIntoBlocks", () => {
  it("keeps non-bullets out of the list", () => {
    const lines = buildLines(layout, [], {});
    const groups = groupIntoBlocks(lines);
    expect(Array.isArray(groups[0])).toBe(false); // the name
    expect(Array.isArray(groups[1])).toBe(true); // the bullets
  });
});

describe("anchorLabel", () => {
  const withRole: Layout = {
    ...layout,
    blocks: [
      { id: "b4", kind: "heading", text: "EXPERIENCE", section: null, style: null, lines: 1, has_bold: false, runs: [], size: 11, space_before: 0 },
      { id: "b5", kind: "role", text: "Razorfin · Software Engineer, Backend\tAug 2024 – present", section: "EXPERIENCE", style: null, lines: 1, has_bold: true, runs: [], size: 11, space_before: 0 },
      { id: "b6", kind: "bullet", text: "Worked on backend APIs for payments.", section: "EXPERIENCE", style: null, lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
    ],
  };

  it("names the job a drafted line would join", () => {
    /* "Add this line to your Razorfin role?" is a different question from
       "Add it?", and it is the one the spec asks. */
    expect(anchorLabel(withRole, "b6")).toBe("Razorfin");
  });

  it("says nothing rather than guessing when there is no role above", () => {
    expect(anchorLabel(withRole, "b4")).toBeNull();
    expect(anchorLabel(withRole, "nope")).toBeNull();
  });
});
