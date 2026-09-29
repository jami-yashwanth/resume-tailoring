import type { Layout, Match, PlannedOp, Requirement } from "./types";

/**
 * A drafted line for every missing requirement the planner left unanswered.
 *
 * "Not in your resume, no line to offer" used to be a real state a user could
 * hit two ways: the planner marked a requirement needs_ok without writing its
 * draft, or the verifier downgraded an unbacked "matched" after planning ran.
 * Either way the user lost a coverage decision they never got to make —
 * offering nothing decides for them.
 *
 * These fallbacks are deliberately modest and deterministic: "Familiar with
 * X." claims the least a person adding the line could mean, carries no
 * numbers by construction (a label with a digit is skipped, rule 1), and like
 * every added_by_user op it reaches the document only on Add it. Knockouts
 * and fact-like kinds (degree, location) are never drafted — those are shown,
 * not written.
 *
 * Built after `enforce`, like headingOps: not the model's work, safe by
 * construction, and enforce's evidence checks would reject what they were
 * never meant to test.
 */
export function fallbackOffers(
  layout: Layout,
  requirements: Requirement[],
  matches: Match[],
  operations: PlannedOp[],
): PlannedOp[] {
  // After the last bullet, or the last block that isn't identity/heading —
  // the same "end of what you did" spot a person would pencil a line into.
  const anchor =
    [...layout.blocks].reverse().find((b) => b.kind === "bullet") ??
    [...layout.blocks].reverse().find((b) => !["name", "contact", "role", "heading"].includes(b.kind));
  if (!anchor) return [];

  const offers: PlannedOp[] = [];
  for (const requirement of requirements) {
    if (requirement.knockout) continue;
    if (requirement.kind === "degree" || requirement.kind === "location") continue;
    if (/\d/.test(requirement.label)) continue;

    const match = matches.find((m) => m.requirementId === requirement.id);
    if (match?.status !== "needs_ok") continue;

    const alreadyOffered = operations.some(
      (op) => op.needsDecision && op.requirements.includes(requirement.id),
    );
    if (alreadyOffered) continue;

    offers.push({
      id: `offer-${requirement.id}`,
      op: "insert_after",
      block: anchor.id,
      text: `Familiar with ${requirement.label}.`,
      alternatives: [],
      claim: "added_by_user",
      // Worth less than a planner draft (which names how the skill was used),
      // so the fitter drops these first when the page is full.
      value: 2,
      requirements: [requirement.id],
      evidence: [],
      reason: "The job asks for this and your resume doesn't mention it. Nothing goes in unless you choose Add it.",
      needsDecision: true,
    });
  }
  return offers;
}
