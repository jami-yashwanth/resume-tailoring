import { describe, expect, it } from "vitest";
import { coverageOf, displayStatus, pendingDecisions } from "./coverage";
import type { Match, PlannedOp, Requirement } from "./types";

const requirement = (id: string, label: string, knockout = false): Requirement => ({
  id,
  label,
  wording: `The job asks for ${label}`,
  kind: "skill",
  importance: "must",
  knockout,
});

const requirements: Requirement[] = [
  requirement("r1", "Java"),
  requirement("r2", "Spring Boot"),
  requirement("r3", "AWS"),
  requirement("r4", "Kafka"),
  requirement("r5", "Kubernetes"),
  requirement("r6", "Based in Pune", true),
];

const matches: Match[] = [
  { requirementId: "r1", status: "matched", evidence: ["b6"] },
  { requirementId: "r2", status: "matched", evidence: ["b7"] },
  { requirementId: "r3", status: "matched", evidence: ["b8"] },
  { requirementId: "r4", status: "needs_ok", evidence: [] }, // Kafka
  { requirementId: "r5", status: "needs_ok", evidence: [] }, // Kubernetes
  { requirementId: "r6", status: "cannot_change", evidence: [], note: "You're in Bengaluru." },
];

const drafted = (id: string, requirement: string | string[], approved?: boolean): PlannedOp => ({
  id,
  op: "insert_after",
  block: "b8",
  text: "Consumed payment events from Kafka topics.",
  alternatives: [],
  claim: "added_by_user",
  value: 8,
  requirements: Array.isArray(requirement) ? requirement : [requirement],
  evidence: [],
  needsDecision: true,
  approved,
});

const reworded: PlannedOp = {
  id: "o9",
  op: "rephrase",
  block: "b6",
  text: "Cut payment API latency with async Spring Boot workers.",
  alternatives: [],
  claim: "reworded",
  value: 7,
  requirements: ["r1"],
  evidence: ["b6"],
  needsDecision: false,
};

describe("coverageOf", () => {
  it("counts what the resume covered before anything was decided", () => {
    const coverage = coverageOf(requirements, matches, [drafted("o1", "r4"), drafted("o2", "r5")]);
    expect(coverage).toEqual({ covered: 3, total: 6, originalCovered: 3 });
  });

  it("counts a drafted line only once the user accepts it", () => {
    const coverage = coverageOf(requirements, matches, [
      drafted("o1", "r4", true),
      drafted("o2", "r5"),
    ]);
    expect(coverage).toEqual({ covered: 4, total: 6, originalCovered: 3 });
  });

  it("does not count a line the user skipped", () => {
    const coverage = coverageOf(requirements, matches, [
      drafted("o1", "r4", false),
      drafted("o2", "r5", false),
    ]);
    expect(coverage.covered).toBe(3);
  });

  it("never reports fewer covered than the original", () => {
    /* The live run that prompted this file returned "covers 4 of 9, original
       covered 6" — the tailoring reading as a regression. Now impossible:
       covered is originalCovered plus accepted additions. */
    for (const ops of [[], [drafted("o1", "r4")], [drafted("o1", "r4", true)]]) {
      const coverage = coverageOf(requirements, matches, ops);
      expect(coverage.covered).toBeGreaterThanOrEqual(coverage.originalCovered);
      expect(coverage.covered).toBeLessThanOrEqual(coverage.total);
    }
  });

  it("does not let a rewording inflate the count", () => {
    /* Rewording a line the user already had does not add a requirement — it
       only makes an existing one read better. */
    expect(coverageOf(requirements, matches, [reworded]).covered).toBe(3);
  });

  it("counts a knockout in the total but never as covered", () => {
    const coverage = coverageOf(requirements, matches, [
      drafted("o1", "r4", true),
      drafted("o2", "r5", true),
    ]);
    expect(coverage).toEqual({ covered: 5, total: 6, originalCovered: 3 });
  });

  it("counts the requirements on screen, not the matches the model returned", () => {
    /* The panel's heading counts requirements and the number under it used to
       count matches, so a model that skipped one put "Covers 3 of 5" directly
       beneath "This job asks for 6 things". */
    const short = matches.slice(0, 5);
    expect(coverageOf(requirements, short, []).total).toBe(6);
  });

  it("treats a requirement the model forgot as unmet, not as absent", () => {
    const short = matches.filter((m) => m.requirementId !== "r1");
    expect(coverageOf(requirements, short, []).originalCovered).toBe(2);
  });

  it("does not double-count a requirement matched twice", () => {
    const duplicated = [...matches, { requirementId: "r1", status: "matched" as const, evidence: [] }];
    expect(coverageOf(requirements, duplicated, [])).toEqual({
      covered: 3,
      total: 6,
      originalCovered: 3,
    });
  });

  it("credits one accepted line against every requirement it genuinely answers", () => {
    const coverage = coverageOf(requirements, matches, [drafted("o1", ["r4", "r5"], true)]);
    expect(coverage.covered).toBe(5);
  });

  it("ignores requirement ids that are not on the job", () => {
    const coverage = coverageOf(requirements, matches, [drafted("o1", ["r4", "r99"], true)]);
    expect(coverage).toEqual({ covered: 4, total: 6, originalCovered: 3 });
  });
});

describe("pendingDecisions", () => {
  it("returns only the undecided ones, for the '1 of 2' counter", () => {
    const ops = [drafted("o1", "r4", true), drafted("o2", "r5"), reworded];
    expect(pendingDecisions(ops).map((o) => o.id)).toEqual(["o2"]);
  });

  it("treats an explicit skip as decided", () => {
    expect(pendingDecisions([drafted("o1", "r4", false)])).toEqual([]);
  });
});

describe("displayStatus", () => {
  const kafka: Match = { requirementId: "r4", status: "needs_ok", evidence: [] };

  it("shows a drafted line as still needing the user's OK", () => {
    expect(displayStatus("r4", kafka, [drafted("o1", "r4")])).toBe("needs_ok");
  });

  it("shows an accepted line as added, not as something still owed", () => {
    /* The panel used to keep saying "! Kafka — needs your OK" while the count
       above it had already credited the line. Both read from here now. */
    expect(displayStatus("r4", kafka, [drafted("o1", "r4", true)])).toBe("added");
  });

  it("stops asking for a line the user skipped", () => {
    /* The document drops a skipped line without a trace because the spec
       forbids re-asking. A panel still flagging it "needs your OK", with no
       decision left to make, was the same question asked from the other side
       of the screen. */
    expect(displayStatus("r4", kafka, [drafted("o1", "r4", false)])).toBe("skipped");
  });

  it("keeps asking while any line for that requirement is undecided", () => {
    const ops = [drafted("o1", "r4", false), drafted("o2", "r4")];
    expect(displayStatus("r4", kafka, ops)).toBe("needs_ok");
  });

  it("distinguishes what the user added from what they already had", () => {
    const own: Match = { requirementId: "r1", status: "matched", evidence: ["b6"] };
    expect(displayStatus("r1", own, [drafted("o1", "r1", true)])).toBe("matched");
  });

  it("never reinterprets a knockout", () => {
    const pune: Match = { requirementId: "r6", status: "cannot_change", evidence: [] };
    expect(displayStatus("r6", pune, [drafted("o1", "r6", true)])).toBe("cannot_change");
  });

  it("does not ask about a requirement that has no drafted line to decide on", () => {
    expect(displayStatus("r4", kafka, [])).toBe("not_offered");
    expect(displayStatus("r4", kafka, [drafted("o1", "r5")])).toBe("not_offered");
  });

  it("treats a requirement with no match and no line as nothing to answer", () => {
    expect(displayStatus("r7", undefined, [])).toBe("not_offered");
  });
});
