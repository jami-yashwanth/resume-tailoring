import { standardHeading } from "./headings";
import type { Block, Layout, Match, PlannedOp, Requirement } from "./types";

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
/** Last content line of the Skills section, if the resume has one. */
function skillsAnchor(layout: Layout): Block | null {
  return (
    [...layout.blocks]
      .reverse()
      .find((b) => b.kind !== "heading" && b.section != null && standardHeading(b.section) === "Skills") ?? null
  );
}

/** Last bullet/paragraph of the most recent role — the first role in the
 *  document, resumes being reverse-chronological — stopping at the next role
 *  or heading so an offer can't drift into an older job or another section. */
function recentRoleAnchor(layout: Layout): Block | null {
  const start = layout.blocks.findIndex((b) => b.kind === "role");
  if (start === -1) return null;
  let anchor: Block | null = null;
  for (const block of layout.blocks.slice(start + 1)) {
    if (block.kind === "role" || block.kind === "heading") break;
    if (block.kind === "bullet" || block.kind === "paragraph") anchor = block;
  }
  return anchor;
}

/** The document's tail: the old blind fallback, kept as the last resort. */
function tailAnchor(layout: Layout): Block | null {
  return (
    [...layout.blocks].reverse().find((b) => b.kind === "bullet") ??
    [...layout.blocks].reverse().find((b) => !["name", "contact", "role", "heading"].includes(b.kind)) ??
    null
  );
}

/** A label made safe for mid-sentence: sentence-case phrases lose their
 *  leading capital ("Professional software…" → "professional software…"),
 *  while names and acronyms keep theirs — a single word, or any later word
 *  carrying a capital, means the casing is meant ("Kafka", "REST APIs"). */
export function modestLabel(label: string): string {
  const words = label.split(/\s+/);
  const rest = words.slice(1);
  if (!rest.length || rest.some((w) => /[A-Z]/.test(w))) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export function fallbackOffers(
  layout: Layout,
  requirements: Requirement[],
  matches: Match[],
  operations: PlannedOp[],
): PlannedOp[] {
  // Placement is part of the claim: a skill under a job implies it was used
  // there. Skills go to the Skills section; experience goes under the most
  // recent role; the document's tail is only the last resort.
  const skills = skillsAnchor(layout);
  const role = recentRoleAnchor(layout);
  const tail = tailAnchor(layout);
  const anchorFor = (kind: Requirement["kind"]): Block | null =>
    kind === "skill" ? (skills ?? role ?? tail) : (role ?? skills ?? tail);

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

    const anchor = anchorFor(requirement.kind);
    if (!anchor) continue;

    offers.push({
      id: `offer-${requirement.id}`,
      op: "insert_after",
      block: anchor.id,
      text: `Familiar with ${modestLabel(requirement.label)}.`,
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
