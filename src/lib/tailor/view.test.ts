import { describe, expect, it } from "vitest";
import type { Layout, PlannedOp } from "./types";
import {
  type RenderedLine,
  anchorLabel,
  buildLines,
  cleanText,
  groupIntoBlocks,
  groupRoleRun,
  groupRoles,
  stripBullet,
  wordingFor,
  wordingOptions,
} from "./view";

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
    expect(anchorLabel(withRole, "b6")).toEqual({ label: "Razorfin", kind: "role" });
  });

  it("says nothing rather than guessing when there is no role above", () => {
    expect(anchorLabel(withRole, "b4")).toBeNull();
    expect(anchorLabel(withRole, "nope")).toBeNull();
  });

  it("names the section, not the last role above it, for a non-experience anchor", () => {
    /* An anchor in Skills sits after the Experience roles; walking back to the
       nearest role would caption a skills line "Add this line to your OldCo
       role?" — a claim about a job the user never made. */
    const withSkills: Layout = {
      ...withRole,
      blocks: [
        ...withRole.blocks,
        { id: "b7", kind: "heading", text: "TECHNICAL SKILLS", section: null, style: null, lines: 1, has_bold: false, runs: [], size: 11, space_before: 0 },
        { id: "b8", kind: "paragraph", text: "Python, SQL", section: "TECHNICAL SKILLS", style: null, lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
      ],
    };
    expect(anchorLabel(withSkills, "b8")).toEqual({ label: "Skills", kind: "section" });
  });
});

describe("stripBullet", () => {
  it("drops a leading bullet glyph the way the renderer does", () => {
    expect(stripBullet("• Worked on APIs")).toBe("Worked on APIs");
    expect(stripBullet("•  ▪ Did two things")).toBe("Did two things");
    expect(stripBullet("Plain line")).toBe("Plain line");
  });

  it("strips only bullets, never paragraphs", () => {
    expect(cleanText("bullet", "- Led a team")).toBe("Led a team");
    expect(cleanText("paragraph", "- not a bullet")).toBe("- not a bullet");
  });

  it("normalises contact separators to the compiled file's single-spaced pipe", () => {
    // The template sets ` $|$ ` between fields, which extracts as " | " —
    // the preview shows the same so the header reads identically.
    expect(cleanText("contact", "a@b.c · Bengaluru\t+91 98")).toBe("a@b.c | Bengaluru | +91 98");
  });
});

describe("buildLines bullet text", () => {
  const bulleted: Layout = {
    ...layout,
    blocks: layout.blocks.map((b) => (b.id === "b6" ? { ...b, text: "• Worked on backend APIs for payments." } : b)),
  };

  it("shows a bullet once, not twice", () => {
    const line = buildLines(bulleted, [], {}).find((l) => l.blockId === "b6");
    expect(line?.text).toBe("Worked on backend APIs for payments.");
  });

  it("strips a rewording that arrives with its own glyph", () => {
    const lines = buildLines(bulleted, [op({ text: "• Designed REST APIs." })], {});
    const line = lines.find((l) => l.blockId === "b6");
    expect(line?.text).toBe("Designed REST APIs.");
    expect(line?.original).toBe("Worked on backend APIs for payments.");
  });
});

describe("groupRoleRun", () => {
  const roles = (...texts: string[]): RenderedLine[] =>
    texts.map((text, i) => ({
      key: `line-r${i}`,
      blockId: `r${i}`,
      kind: "role",
      section: "EXPERIENCE",
      style: null,
      text,
      state: "unchanged",
      runs: [],
      size: 10.5,
      spaceBefore: 0,
      align: "left",
      ruleBelow: false,
    }));

  it("folds employer, title and location into two lines", () => {
    // What every parser actually emits for one job, and what the template drew
    // literally until 29 Sep 2026: three bold lines, no hierarchy, 48pt.
    const out = groupRoleRun(
      roles("Inncircles\tJun 2023 - Jun 2026", "Senior Software Engineer", "Hyderabad, Telangana"),
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      kind: "role",
      text: "Inncircles — Hyderabad, Telangana\tJun 2023 - Jun 2026",
    });
    expect(out[1]).toMatchObject({ kind: "job_title", text: "Senior Software Engineer" });
  });

  it("keeps the employer block's id, so marks and ops still find the line", () => {
    const out = groupRoleRun(roles("Inncircles\tJun 2023", "Senior Engineer", "Pune, Maharashtra"));
    expect(out[0].key).toBe("line-r0");
    expect(out[0].blockId).toBe("r0");
  });

  it("works when the dates are not on the first line", () => {
    const out = groupRoleRun(roles("Senior Engineer", "Inncircles\tJun 2023 - Jun 2026"));
    expect(out[0].text).toBe("Inncircles\tJun 2023 - Jun 2026");
    expect(out[1]).toMatchObject({ kind: "job_title", text: "Senior Engineer" });
  });

  it("folds a run that carries no dates at all", () => {
    const out = groupRoleRun(roles("Inncircles", "Senior Engineer", "Hyderabad, Telangana"));
    expect(out[0].text).toBe("Inncircles — Hyderabad, Telangana");
    expect(out[1].kind).toBe("job_title");
  });

  it("leaves a run carrying an operation exactly as it was", () => {
    // Folding drops a line, and ops, margin marks and focusLine all address
    // lines by key. Better three bold lines than a mark pointing at nothing.
    const run = roles("Inncircles\tJun 2023", "Senior Engineer", "Hyderabad, Telangana");
    run[1] = { ...run[1], opId: "o9", state: "reworded" };
    expect(groupRoleRun(run)).toEqual(run);
  });

  it("leaves a run it cannot read confidently alone", () => {
    // One line is an employer and nothing else — folding would leave a bold
    // line whose title we had just deleted.
    expect(groupRoleRun(roles("Inncircles\tJun 2023"))).toHaveLength(1);
    expect(groupRoleRun(roles("Inncircles\tJun 2023", "Bengaluru, Karnataka"))).toHaveLength(2);
  });

  it("does not mistake a comma'd job title for a location", () => {
    const out = groupRoleRun(
      roles("Inncircles\tJun 2023", "Engineer, Platform Team", "Hyderabad, Telangana"),
    );
    expect(out[0].text).toBe("Inncircles — Hyderabad, Telangana\tJun 2023");
    expect(out[1].text).toBe("Engineer, Platform Team");
  });
});

describe("groupRoles", () => {
  it("folds each job separately and leaves everything else in place", () => {
    const line = (kind: RenderedLine["kind"], id: string, text: string): RenderedLine => ({
      key: `line-${id}`,
      blockId: id,
      kind,
      section: null,
      style: null,
      text,
      state: "unchanged",
      runs: [],
      size: 10.5,
      spaceBefore: 0,
      align: "left",
      ruleBelow: false,
    });

    const out = groupRoles([
      line("heading", "h1", "EXPERIENCE"),
      line("role", "r0", "Inncircles\tJun 2023 - Jun 2026"),
      line("role", "r1", "Senior Software Engineer"),
      line("role", "r2", "Hyderabad, Telangana"),
      line("bullet", "b1", "Built things."),
      line("role", "r3", "Inncircles\tJan 2023 - Jun 2023"),
      line("role", "r4", "Software Engineer Intern"),
      line("bullet", "b2", "Built other things."),
    ]);

    expect(out.map((l) => l.kind)).toEqual([
      "heading",
      "role",
      "job_title",
      "bullet",
      "role",
      "job_title",
      "bullet",
    ]);
    expect(out[1].text).toBe("Inncircles — Hyderabad, Telangana\tJun 2023 - Jun 2026");
    expect(out[4].text).toBe("Inncircles\tJan 2023 - Jun 2023");
  });
});

describe("buildLines grouping", () => {
  it("buildLines with group=false leaves role lines unfolded", () => {
    const role = (id: string, text: string): Layout["blocks"][number] => ({
      id, kind: "role", text, section: null, style: null, lines: 1, has_bold: true, runs: [], size: 10.5, space_before: 0,
    });
    const roles: Layout = {
      ...layout,
      blocks: [
        role("r0", "Inncircles\tJun 2023 - Jun 2026"),
        role("r1", "Senior Software Engineer"),
        role("r2", "Hyderabad, Telangana"),
      ],
    };
    const raw = buildLines(roles, [], {}, false, {}, false);
    expect(raw.map((l) => l.kind)).toEqual(["role", "role", "role"]);
    expect(raw.map((l) => l.text)).toEqual(roles.blocks.map((b) => b.text));
    expect(buildLines(roles, [], {}, true, {}, false).map((l) => l.kind)).toEqual(["role", "role", "role"]);
    expect(buildLines(roles, [], {}, false).map((l) => l.kind)).toContain("job_title");
  });
});

describe("buildLines with edits", () => {
  const edits = { b6: "My own sentence." };

  it("an edit replaces the line with state edited and keeps the original", () => {
    const line = buildLines(layout, [], {}, false, {}, true, edits).find((l) => l.blockId === "b6")!;
    expect(line.state).toBe("edited");
    expect(line.text).toBe("My own sentence.");
    expect(line.original).toBe("Worked on backend APIs for payments.");
  });

  it("an edit wins over an applied rewording", () => {
    const line = buildLines(layout, [op({})], {}, false, {}, true, edits).find((l) => l.blockId === "b6")!;
    expect(line.state).toBe("edited");
    expect(line.text).toBe("My own sentence.");
    expect(line.original).toBe("Designed backend REST APIs for payments.");
    expect(line.opId).toBe("o1");
  });

  it("undoing an edit restores the rewording, not the original", () => {
    const line = buildLines(layout, [op({})], {}, false, {}, true, {}).find((l) => l.blockId === "b6")!;
    expect(line.state).toBe("reworded");
    expect(line.text).toBe("Designed backend REST APIs for payments.");
  });

  it("an edit keeps the inserts that follow the line", () => {
    const lines = buildLines(layout, [draft], {}, false, {}, true, { b7: "Edited anchor." });
    const i = lines.findIndex((l) => l.blockId === "b7" && l.state === "edited");
    expect(i).toBeGreaterThan(-1);
    expect(lines[i + 1]).toMatchObject({ opId: "o2", state: "pending" });
  });

  it("compare with original ignores edits", () => {
    const line = buildLines(layout, [], {}, true, {}, true, edits).find((l) => l.blockId === "b6")!;
    expect(line.state).toBe("unchanged");
    expect(line.text).toBe("Worked on backend APIs for payments.");
  });
});

describe("edits and removals", () => {
  it("a removed line keeps the edited text", () => {
    const removal = op({ id: "rm", op: "remove", block: "b13", text: undefined });
    const line = buildLines(layout, [removal], { rm: true }, false, {}, true, { b13: "Mine, removed." }).find((l) => l.blockId === "b13")!;
    expect(line.state).toBe("removed");
    expect(line.text).toBe("Mine, removed.");
  });
});
