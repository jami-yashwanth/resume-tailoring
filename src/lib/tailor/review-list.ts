import type { ReviewState } from "./review";
import type { Layout, PlannedOp, TailorPlan } from "./types";
import {
  type Decisions,
  type LineState,
  type Wordings,
  anchorLabel,
  buildLines,
  cleanText,
  wordingFor,
  wordingOptions,
} from "./view";

/**
 * The review list: what is left to decide, what was decided, what was
 * reworded, and whether the document still fits.
 *
 * The one source for the right column, the header status and every
 * announcement. The old screen worked "needs your OK" out in four places and
 * they disagreed.
 */

export type ItemState = LineState | "skipped";

export type ReviewItem = {
  op: PlannedOp;
  state: ItemState;
  /** What the line is about, e.g. "Apache Kafka". */
  skill: string | null;
  /** The employer whose role the line joins, e.g. "Razorfin". */
  where: string | null;
  /** The words on the page now. */
  text: string;
  wordingIndex: number;
  wordingCount: number;
  reason: string | null;
  /** The user's own lines this change is built from. */
  sources: string[];
  /** The job's own words for what this answers. */
  jobSays: string[];
};

export type PageFitOption = {
  id: string;
  label: string;
  /** The line itself, in the user's own words. */
  quote?: string;
  /** The button's verb once this option is chosen. */
  verb: string;
};

export type PageFit = {
  /** The change that pushed the document over, when there is one. */
  causedBy: string | null;
  pages: number;
  allowed: number;
  options: PageFitOption[];
};

export type ReviewList = {
  toDecide: ReviewItem[];
  current: ReviewItem | null;
  /** 1-based: which decision this is, counting those already made. */
  position: number;
  totalDecisions: number;
  decided: ReviewItem[];
  reworded: ReviewItem[];
  removed: ReviewItem[];
  pageFit: PageFit | null;
  status: string;
  ready: boolean;
};

export function withDecisions(operations: PlannedOp[], decisions: Decisions): PlannedOp[] {
  return operations.map((op) => ({ ...op, approved: decisions[op.id] }));
}

export function reviewList(plan: TailorPlan, layout: Layout, state: ReviewState): ReviewList {
  const operations = withDecisions(plan.operations, state.decisions);
  const blockIndex = new Map(layout.blocks.map((b, i) => [b.id, i]));
  const blockOf = (id: string) => layout.blocks.find((b) => b.id === id);
  // Array.prototype.sort is stable, so two ops on one block keep the plan's order.
  const sorted = [...operations].sort(
    (a, b) => (blockIndex.get(a.block) ?? 0) - (blockIndex.get(b.block) ?? 0),
  );

  const item = (op: PlannedOp, itemState: ItemState): ReviewItem => {
    const block = blockOf(op.block);
    const kind = block?.kind ?? "paragraph";
    const ownWords = op.op === "remove" || itemState === "reverted";
    const options = wordingOptions(op);
    const count = Math.max(1, options.length);
    const asked = plan.requirements.filter((r) => op.requirements.includes(r.id));
    return {
      op,
      state: itemState,
      skill: asked.length ? asked.map((r) => r.label).join(" and ") : null,
      where: anchorLabel(layout, op.block),
      text: cleanText(kind, ownWords ? (block?.text ?? "") : wordingFor(op, state.wordings)),
      wordingIndex: (((state.wordings[op.id] ?? 0) % count) + count) % count,
      wordingCount: options.length,
      reason: op.reason ?? null,
      sources: op.evidence
        .map((id) => blockOf(id))
        .filter((b): b is NonNullable<typeof b> => Boolean(b))
        .map((b) => cleanText(b.kind, b.text)),
      jobSays: asked.map((r) => r.wording),
    };
  };

  const toDecide = sorted
    .filter((op) => op.needsDecision && op.approved === undefined)
    .map((op) => item(op, "pending"));
  const decided = sorted
    .filter((op) => op.needsDecision && op.approved !== undefined)
    .map((op) => item(op, op.approved ? "added" : "skipped"));
  const reworded = sorted
    .filter((op) => op.op === "rephrase")
    .map((op) => item(op, op.approved === false ? "reverted" : "reworded"));
  const removed = sorted
    .filter((op) => op.op === "remove" && op.approved === true)
    .map((op) => item(op, "removed"));

  const current = toDecide.find((i) => i.op.id === state.currentOpId) ?? toDecide[0] ?? null;
  const totalDecisions = toDecide.length + decided.length;

  let pageFit: PageFit | null = null;
  if (!state.compare && state.pagesAllowed !== null && state.pages > state.pagesAllowed) {
    const lines = buildLines(layout, operations, state.decisions, false, state.wordings);
    const lastChanged = [...lines].reverse().find((l) => l.state === "added" || l.state === "reworded");
    pageFit = {
      causedBy: lastChanged?.opId ?? null,
      pages: state.pages,
      allowed: state.pagesAllowed,
      options: pageFitOptions({
        operations,
        layout,
        wordings: state.wordings,
        changedOpId: lastChanged?.opId,
        pages: state.pages,
      }),
    };
  }

  const pagesText = `${state.pages} page${state.pages === 1 ? "" : "s"}`;
  const status = toDecide.length
    ? `${toDecide.length} to decide · ${pagesText}`
    : pageFit
      ? `Choose how it fits · ${pagesText}`
      : totalDecisions
        ? `All decided · ${pagesText}`
        : reworded.length
          ? `Nothing to decide · ${pagesText}`
          : "Your resume already covers what this job asks for.";

  return {
    toDecide,
    current,
    position: decided.length + 1,
    totalDecisions,
    decided,
    reworded,
    removed,
    pageFit,
    status,
    ready: toDecide.length === 0 && pageFit === null,
  };
}

/** A shorter way of saying the same thing, if the planner offered one. */
function shorterWording(options: string[], current: number): number | null {
  const now = options[current]?.length ?? 0;
  let best: number | null = null;
  options.forEach((text, index) => {
    if (index === current || text.length >= now) return;
    if (best === null || text.length < options[best].length) best = index;
  });
  return best;
}

/**
 * The ways out of "this no longer fits", cheapest to the user first.
 *
 * "Swap first, grow last" — but every swap is one of the user's own lines, so
 * each one is named, quoted, and chosen rather than applied.
 */
export function pageFitOptions({
  operations,
  layout,
  wordings,
  changedOpId,
  pages,
}: {
  operations: PlannedOp[];
  layout: Layout;
  wordings: Wordings;
  changedOpId?: string;
  pages: number;
}): PageFitOption[] {
  const options: PageFitOption[] = [];

  const changed = operations.find((op) => op.id === changedOpId);
  if (changed) {
    const list = wordingOptions(changed);
    const shorter = shorterWording(list, wordings[changed.id] ?? 0);
    if (shorter !== null) {
      options.push({
        id: `shorter:${changed.id}:${shorter}`,
        label: "Say it more briefly",
        quote: list[shorter],
        verb: "Use the shorter wording",
      });
    }
  }

  operations
    .filter((op) => op.op === "remove" && op.approved === undefined)
    .sort((a, b) => a.value - b.value)
    .slice(0, 2)
    .forEach((op, index) => {
      const block = layout.blocks.find((b) => b.id === op.block);
      options.push({
        id: `remove:${op.id}`,
        label: index === 0 ? "Remove the least relevant line" : "Remove a different line",
        quote: block ? cleanText(block.kind, block.text) : undefined,
        verb: "Remove that line",
      });
    });

  options.push({ id: "grow", label: `Keep everything, allow ${pages} pages`, verb: `Allow ${pages} pages` });
  return options;
}

/** "Kafka line added. 1 decision left." — the spec's polite announcement. */
export function decisionAnnouncement(skill: string | null, approved: boolean, left: number): string {
  const what = `${skill ? `${skill} line` : "Line"} ${approved ? "added" : "skipped"}.`;
  const rest = left === 0 ? "No decisions left." : `${left} decision${left === 1 ? "" : "s"} left.`;
  return `${what} ${rest}`;
}

export function undoAnnouncement(item: ReviewItem): string {
  switch (item.state) {
    case "added":
    case "skipped":
      return `${item.skill ? `${item.skill} line` : "That line"} is back to decide.`;
    case "reworded":
      return "Rewording undone. Your original line is back.";
    case "reverted":
      return "Reworded line restored.";
    case "removed":
      return "Line kept.";
    default:
      return "";
  }
}
