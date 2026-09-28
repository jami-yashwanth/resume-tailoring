import { describe, expect, it } from "vitest";
import { coverageOf, displayStatus, pendingDecisions } from "./coverage";
import type { Match, PlannedOp } from "./types";

const matches: Match[] = [
  { requirementId: "r1", status: "matched", evidence: ["b6"] },
  { requirementId: "r2", status: "matched", evidence: ["b7"] },
  { requirementId: "r3", status: "matched", evidence: ["b8"] },
  { requirementId: "r4", status: "needs_ok", evidence: [] }, // Kafka
  { requirementId: "r5", status: "needs_ok", evidence: [] }, // Kubernetes
  { requirementId: "r6", status: "cannot_change", evidence: [], note: "You're in Bengaluru." },
];

const drafted = (id: string, requirement: string, approved?: boolean): PlannedOp => ({
  id,
  op: "insert_after",
  block: "b8",
  text: "Consumed payment events from Kafka topics.",
  alternatives: [],
  claim: "added_by_user",
  value: 8,
  requirements: [requirement],
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
    const coverage = coverageOf(matches, [drafted("o1", "r4"), drafted("o2", "r5")]);
    expect(coverage).toEqual({ covered: 3, total: 6, originalCovered: 3 });
  });

  it("counts a drafted line only once the user accepts it", () => {
    const coverage = coverageOf(matches, [drafted("o1", "r4", true), drafted("o2", "r5")]);
    expect(coverage).toEqual({ covered: 4, total: 6, originalCovered: 3 });
  });

  it("does not count a line the user skipped", () => {
    const coverage = coverageOf(matches, [drafted("o1", "r4", false), drafted("o2", "r5", false)]);
    expect(coverage.covered).toBe(3);
  });

  it("never reports fewer covered than the original", () => {
    /* The live run that prompted this file returned "covers 4 of 9, original
       covered 6" — the tailoring reading as a regression. Now impossible:
       covered is originalCovered plus accepted additions. */
    for (const ops of [[], [drafted("o1", "r4")], [drafted("o1", "r4", true)]]) {
      const coverage = coverageOf(matches, ops);
      expect(coverage.covered).toBeGreaterThanOrEqual(coverage.originalCovered);
      expect(coverage.covered).toBeLessThanOrEqual(coverage.total);
    }
  });

  it("does not let a rewording inflate the count", () => {
    /* Rewording a line the user already had does not add a requirement — it
       only makes an existing one read better. */
    expect(coverageOf(matches, [reworded]).covered).toBe(3);
  });

  it("counts a knockout in the total but never as covered", () => {
    const coverage = coverageOf(matches, [drafted("o1", "r4", true), drafted("o2", "r5", true)]);
    expect(coverage).toEqual({ covered: 5, total: 6, originalCovered: 3 });
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
    expect(displayStatus(kafka, [drafted("o1", "r4")])).toBe("needs_ok");
  });

  it("shows an accepted line as added, not as something still owed", () => {
    /* The panel used to keep saying "! Kafka — needs your OK" while the count
       above it had already credited the line. Both read from here now. */
    expect(displayStatus(kafka, [drafted("o1", "r4", true)])).toBe("added");
  });

  it("keeps a skipped line asking, so it can still be reconsidered", () => {
    expect(displayStatus(kafka, [drafted("o1", "r4", false)])).toBe("needs_ok");
  });

  it("distinguishes what the user added from what they already had", () => {
    const own: Match = { requirementId: "r1", status: "matched", evidence: ["b6"] };
    expect(displayStatus(own, [drafted("o1", "r1", true)])).toBe("matched");
  });

  it("never reinterprets a knockout", () => {
    const pune: Match = { requirementId: "r6", status: "cannot_change", evidence: [] };
    expect(displayStatus(pune, [drafted("o1", "r6", true)])).toBe("cannot_change");
  });
});
