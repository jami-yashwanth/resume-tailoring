import { describe, expect, it } from "vitest";
import { requirementRows } from "./requirement-rows";
import type { Match, PlannedOp, Requirement } from "./types";

const req = (id: string, label: string, knockout = false): Requirement => ({
  id, label, wording: `${label}, please`, kind: "skill", importance: "must", knockout,
});

const draft = (id: string, requirement: string, block: string, approved?: boolean): PlannedOp => ({
  id, op: "insert_after", block, text: `Worked with ${requirement}.`, alternatives: [],
  claim: "added_by_user", value: 5, requirements: [requirement], evidence: [],
  needsDecision: true, approved,
});

const rephrase = (id: string, requirement: string, block: string): PlannedOp => ({
  id, op: "rephrase", block, text: "Reworded.", alternatives: [], claim: "reworded",
  value: 5, requirements: [requirement], evidence: [block], needsDecision: false,
});

const rowFor = (id: string, rows: ReturnType<typeof requirementRows>) =>
  rows.find((r) => r.requirement.id === id)!;

describe("requirementRows", () => {
  it("never makes a knockout clickable, and says why", () => {
    const rows = requirementRows(
      [req("r9", "Pune location", true)],
      [{ requirementId: "r9", status: "cannot_change", evidence: ["b1"], note: "You're in Bengaluru. We never change this." }],
      [],
    );
    expect(rowFor("r9", rows)).toMatchObject({
      group: "cannot_change", pointsTo: null, reason: "You're in Bengaluru. We never change this.",
    });
  });

  it("gives a knockout with no note a default reason", () => {
    const rows = requirementRows([req("r9", "Pune location", true)], [], []);
    expect(rowFor("r9", rows).reason).toBe("Shown as it is. We never change this.");
  });

  it("points a matched requirement at its evidence and its rewordings", () => {
    const rows = requirementRows(
      [req("r5", "REST APIs")],
      [{ requirementId: "r5", status: "matched", evidence: ["b6", "b11"] }],
      [rephrase("o4", "r5", "b6")],
    );
    expect(rowFor("r5", rows)).toMatchObject({ group: "covered", added: false, pointsTo: ["b6", "b11"], reason: null });
  });

  it("explains a match with nothing to point at instead of making a dead button", () => {
    const rows = requirementRows([req("r2", "Spring Boot")], [{ requirementId: "r2", status: "matched", evidence: [] }], []);
    expect(rowFor("r2", rows)).toMatchObject({ group: "covered", pointsTo: null, reason: "Already in your resume." });
  });

  it("puts an undecided drafted line in to_decide, pointing at it", () => {
    const kafka: Match = { requirementId: "r3", status: "needs_ok", evidence: [] };
    const rows = requirementRows([req("r3", "Apache Kafka")], [kafka], [draft("o1", "r3", "b7")]);
    expect(rowFor("r3", rows)).toMatchObject({ group: "to_decide", pointsTo: ["b7"], opId: "o1", reason: null });
  });

  it("counts an added line as covered by you", () => {
    const rows = requirementRows([req("r3", "Apache Kafka")], [], [draft("o1", "r3", "b7", true)]);
    expect(rowFor("r3", rows)).toMatchObject({ group: "covered", added: true, pointsTo: ["b7"] });
  });

  it("files a skipped line as skipped, not as still owed", () => {
    const rows = requirementRows([req("r3", "Apache Kafka")], [], [draft("o1", "r3", "b7", false)]);
    expect(rowFor("r3", rows)).toMatchObject({ group: "skipped", pointsTo: null, reason: "You skipped this line." });
  });

  it("keeps asking while one of two drafted lines is still open", () => {
    const rows = requirementRows(
      [req("r3", "Apache Kafka")],
      [],
      [draft("o1", "r3", "b7", false), draft("o2", "r3", "b8")],
    );
    expect(rowFor("r3", rows)).toMatchObject({ group: "to_decide", pointsTo: ["b8"], opId: "o2" });
  });

  it("never lists a gap with no drafted line as needing your OK", () => {
    const rows = requirementRows(
      [req("r6", "Microservices")],
      [{ requirementId: "r6", status: "needs_ok", evidence: [], note: "We've drafted a line for you to review." }],
      [],
    );
    expect(rowFor("r6", rows)).toMatchObject({
      group: "not_offered", pointsTo: null, reason: "Not in your resume, no line to offer.",
    });
  });

  it("cuts a long knockout note to one short line", () => {
    const long = "You're based in Bengaluru and this role is on-site in Pune five days a week, which we will never change for you. More text.";
    const rows = requirementRows(
      [req("r9", "Pune", true)],
      [{ requirementId: "r9", status: "cannot_change", evidence: [], note: long }],
      [],
    );
    expect(rowFor("r9", rows).reason!.length).toBeLessThanOrEqual(91);
    expect(rowFor("r9", rows).reason!.endsWith("…")).toBe(true);
  });
});

describe("edited evidence", () => {
  it("notes an edited evidence line", () => {
    const rows = requirementRows(
      [req("r1", "Kafka")],
      [{ requirementId: "r1", status: "matched", evidence: ["b6"] }],
      [],
      new Set(["b6"]),
    );
    expect(rowFor("r1", rows).editedNote).toBe("You edited this line; tailor again to re-check");
    const untouched = requirementRows([req("r1", "Kafka")], [{ requirementId: "r1", status: "matched", evidence: ["b6"] }], []);
    expect(rowFor("r1", untouched).editedNote).toBeUndefined();
  });
});
