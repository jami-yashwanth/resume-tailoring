import type { Coverage, Match, PlannedOp } from "./types";

/**
 * "Covers 7 of 9 requirements · your original covered 3."
 *
 * Both halves are counted here rather than asked for, because a model that
 * reports them separately can contradict itself — the first live run returned
 * "covers 4 of 9, original covered 6", which reads as the tailoring having
 * made things worse. There is no 0-100 score anywhere in this product, so
 * these two counts carry the whole claim of value and must always be
 * consistent and monotonic.
 */
export function coverageOf(matches: Match[], operations: PlannedOp[]): Coverage {
  const total = matches.length;

  // "matched" describes the resume as it already is, so it is the before count.
  const originalCovered = matches.filter((m) => m.status === "matched").length;

  // A drafted line only counts once the user has actually accepted it.
  const accepted = new Set(
    operations
      .filter((op) => op.claim === "added_by_user" && op.approved === true)
      .flatMap((op) => op.requirements),
  );
  const newlyCovered = matches.filter(
    (m) => m.status === "needs_ok" && accepted.has(m.requirementId),
  ).length;

  return { covered: originalCovered + newlyCovered, total, originalCovered };
}

/** How many decisions are still waiting — the "1 of 2 · needs your OK" count. */
export function pendingDecisions(operations: PlannedOp[]): PlannedOp[] {
  return operations.filter((op) => op.needsDecision && op.approved === undefined);
}

/**
 * What the left panel should show for a requirement *now*, given the decisions
 * made so far.
 *
 * The match a planner returns describes the resume as uploaded and never
 * changes. Reading it directly left the panel saying "! Kafka — needs your OK"
 * while the count above it said 6 of 9, having already credited the line the
 * user added. One of those two had to be wrong; both are drawn from here now.
 *
 * "added" stays distinct from "matched" on purpose: the user should always be
 * able to see which lines are their own history and which are ones they chose
 * to add.
 */
export type DisplayStatus = "matched" | "added" | "needs_ok" | "cannot_change";

export function displayStatus(match: Match, operations: PlannedOp[]): DisplayStatus {
  if (match.status !== "needs_ok") return match.status;
  const accepted = operations.some(
    (op) => op.approved === true && op.requirements.includes(match.requirementId),
  );
  return accepted ? "added" : "needs_ok";
}
