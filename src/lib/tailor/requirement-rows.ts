import { shorten } from "./text";
import type { Match, PlannedOp, Requirement } from "./types";

/**
 * What the summary column shows for each requirement, given the decisions so far.
 *
 * Every row either points at lines in the resume or says, in one short line,
 * why it cannot. The old panel made some rows buttons and some not with nothing
 * to tell them apart, and listed "Needs your OK" for requirements with no
 * drafted line behind them — a question the screen had no way to ask.
 */

/** A short note is kept whole; only a long one is cut to its first sentence. */
function clip(note: string | undefined): string | undefined {
  const trimmed = note?.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= 90 ? trimmed : shorten(trimmed);
}

export type RequirementGroup = "to_decide" | "covered" | "skipped" | "not_offered" | "cannot_change";

export type RequirementRow = {
  requirement: Requirement;
  group: RequirementGroup;
  /** Covered because the user added a line, not because they already had it. */
  added: boolean;
  /** Block ids to light up, or null when there is nothing to point at. */
  pointsTo: string[] | null;
  /** Shown under the label when there is nothing to point at, or for a knockout. */
  reason: string | null;
  /** The undecided drafted line to open, for "to_decide" rows. */
  opId: string | null;
};

export function requirementRows(
  requirements: Requirement[],
  matches: Match[],
  operations: PlannedOp[],
): RequirementRow[] {
  return requirements.map((requirement) => {
    const match = matches.find((m) => m.requirementId === requirement.id);
    const touching = operations.filter((op) => op.requirements.includes(requirement.id));
    const answering = touching.filter((op) => op.needsDecision);

    const row = (
      group: RequirementGroup,
      blocks: string[],
      reason: string | null,
      extra: Partial<Pick<RequirementRow, "added" | "opId">> = {},
    ): RequirementRow => ({
      requirement,
      group,
      added: extra.added ?? false,
      pointsTo: blocks.length ? [...new Set(blocks)] : null,
      reason,
      opId: extra.opId ?? null,
    });

    // A knockout is shown, never changed, and never a control.
    if (requirement.knockout || match?.status === "cannot_change") {
      return row("cannot_change", [], clip(match?.note) ?? "Shown as it is. We never change this.");
    }

    if (match?.status === "matched") {
      const blocks = [
        ...match.evidence,
        ...touching.filter((op) => !op.needsDecision).map((op) => op.block),
      ];
      return row("covered", blocks, blocks.length ? null : "Already in your resume.");
    }

    const approved = answering.filter((op) => op.approved === true);
    if (approved.length) return row("covered", approved.map((op) => op.block), null, { added: true });

    const open = answering.filter((op) => op.approved === undefined);
    if (open.length) return row("to_decide", open.map((op) => op.block), null, { opId: open[0].id });

    if (answering.length) return row("skipped", [], "You skipped this line.");

    return row("not_offered", [], "Not in your resume, no line to offer.");
  });
}
