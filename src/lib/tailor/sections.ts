import type { Item, SkillRow, TemplateDocument, TemplateSection } from "./document";
import type { ReviewAction } from "./review";
import type { SectionKind } from "./types";

/**
 * What the sections pane derives from the preview document: per-section
 * counts for the collapsed rows, names, where an operation lives, and the
 * one rule for turning a typed edit into an action.
 */

export type SectionCounts = { toDecide: number; reworded: number; edited: number };

const marked = (s: TemplateSection): (Item | SkillRow)[] => [
  ...s.lead,
  ...s.entries.flatMap((e) => e.items),
  ...s.skills,
  ...s.items,
];

export function sectionCounts(section: TemplateSection): SectionCounts {
  const counts: SectionCounts = { toDecide: 0, reworded: 0, edited: 0 };
  for (const m of marked(section)) {
    if (m.state === "pending") counts.toDecide += 1;
    else if (m.state === "reworded") counts.reworded += 1;
    else if (m.state === "edited") counts.edited += 1;
  }
  return counts;
}

/** "2 to decide · 1 reworded · 1 edited", or null when the section is quiet. */
export function countsLabel(c: SectionCounts): string | null {
  const parts = [
    c.toDecide ? `${c.toDecide} to decide` : null,
    c.reworded ? `${c.reworded} reworded` : null,
    c.edited ? `${c.edited} edited` : null,
  ].filter((p): p is string => p !== null);
  return parts.length ? parts.join(" · ") : null;
}

const KIND_NAME: Record<SectionKind, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
  achievements: "Achievements",
  other: "Other",
};

/** One key per section for open state and focus: the outline index when the
 *  section has one, else its position (flat-block results). */
export function sectionKey(section: TemplateSection, position: number): string {
  return `s-${section.outlineIndex ?? `p${position}`}`;
}

/** The user's own heading when there is one; the kind's name otherwise. */
export function sectionName(section: TemplateSection): string {
  return section.heading?.trim() || KIND_NAME[section.kind];
}

/** Index into `doc.sections` of the section holding `opId`, or null (personal information, or nowhere). */
export function findOpSection(doc: TemplateDocument, opId: string): number | null {
  return findOpItem(doc, opId)?.section ?? null;
}

/** The section and the line key an operation's mark sits on, for opening and focusing it. */
export function findOpItem(doc: TemplateDocument, opId: string): { section: number; key: string | undefined } | null {
  for (let i = 0; i < doc.sections.length; i++) {
    const m = marked(doc.sections[i]).find((x) => x.opId === opId);
    if (m) return { section: i, key: m.key };
  }
  return null;
}

/**
 * The action for a committed edit. Blank text and no change are not edits;
 * typing the original back is an undo, so the "Edited by you" mark goes away
 * rather than the user's own sentence being counted as a change.
 */
export function commitEdit({
  slot,
  current,
  next,
  original,
}: {
  slot: string;
  current: string;
  next: string;
  /** The text before any edit, when known. */
  original?: string;
}): ReviewAction | null {
  if (!next.trim() || next === current) return null;
  if (original !== undefined && next === original) return { type: "undoEdit", slot };
  return { type: "edit", slot, text: next };
}

/** Where a section can move to in `order` (positions), or null at an end. */
export function moveTargets(order: number[], index: number): { up: number | null; down: number | null } {
  const p = order.indexOf(index);
  if (p === -1) return { up: null, down: null };
  return { up: p > 0 ? p - 1 : null, down: p < order.length - 1 ? p + 1 : null };
}
