import type { Coverage, Match, PlannedOp, Requirement } from "./types";

/**
 * "Covers 7 of 9 requirements · your original covered 3."
 *
 * Both halves are counted here rather than asked for, because a model that
 * reports them separately can contradict itself — the first live run returned
 * "covers 4 of 9, original covered 6", which reads as the tailoring having
 * made things worse. There is no 0-100 score anywhere in this product, so
 * these two counts carry the whole claim of value and must always be
 * consistent and monotonic.
 *
 * The denominator is the requirements, not the matches. The model is asked for
 * one match per requirement and nothing makes it comply, so counting matches
 * put "Covers 4 of 8" directly under a heading that read "This job asks for 9
 * things". The list on screen is the requirements; the number has to be about
 * the same list.
 */

/** One match per requirement, first one wins, unknown ids dropped. */
function matchesById(requirements: Requirement[], matches: Match[]): Map<string, Match> {
  const known = new Set(requirements.map((r) => r.id));
  const byId = new Map<string, Match>();
  for (const match of matches) {
    if (!known.has(match.requirementId) || byId.has(match.requirementId)) continue;
    byId.set(match.requirementId, match);
  }
  return byId;
}

/** Requirement ids an operation legitimately answers. */
function claimedBy(operations: PlannedOp[], known: Set<string>): Set<string> {
  return new Set(
    operations
      .filter((op) => op.claim === "added_by_user" && op.approved === true)
      .flatMap((op) => op.requirements)
      .filter((id) => known.has(id)),
  );
}

export function coverageOf(
  requirements: Requirement[],
  matches: Match[],
  operations: PlannedOp[],
): Coverage {
  const byId = matchesById(requirements, matches);
  const known = new Set(requirements.map((r) => r.id));
  const accepted = claimedBy(operations, known);

  let originalCovered = 0;
  let newlyCovered = 0;

  for (const requirement of requirements) {
    // A requirement the model forgot to match is treated as unmet, which is
    // what the panel shows for it too.
    const status = byId.get(requirement.id)?.status ?? "needs_ok";
    // "matched" describes the resume as it already is, so it is the before count.
    if (status === "matched") originalCovered += 1;
    // A drafted line only counts once the user has actually accepted it.
    else if (status === "needs_ok" && accepted.has(requirement.id)) newlyCovered += 1;
  }

  return {
    covered: originalCovered + newlyCovered,
    total: requirements.length,
    originalCovered,
  };
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
 * to add. "skipped" is distinct from "needs_ok" for the opposite reason — a
 * line the user declined is answered, and a panel that keeps asking for it is
 * re-asking after a Skip, which the spec forbids.
 */
export type DisplayStatus =
  | "matched"
  | "added"
  | "skipped"
  | "needs_ok"
  | "not_offered"
  | "cannot_change";

export function displayStatus(
  requirementId: string,
  match: Match | undefined,
  operations: PlannedOp[],
): DisplayStatus {
  if (match && match.status !== "needs_ok") return match.status;

  const answering = operations.filter(
    (op) => op.needsDecision && op.requirements.includes(requirementId),
  );
  if (answering.some((op) => op.approved === true)) return "added";
  if (answering.length > 0 && answering.every((op) => op.approved === false)) return "skipped";
  // The planner said it drafted a line, but none survived the rules (or none
  // was ever emitted). With nothing to Add or Skip, "Needs your OK" would be a
  // question the screen cannot ask.
  if (answering.length === 0) return "not_offered";
  return "needs_ok";
}
