import type { BlockKind, Layout, PlannedOp, Run } from "./types";

/**
 * The tailored document, as the Result screen draws it.
 *
 * Kept out of the components because it is the screen's one real piece of
 * logic: which lines exist, which changed, and what each margin mark points
 * at. A pure function over (document, plan, decisions).
 */

export type LineState =
  | "unchanged"
  | "reworded"
  /** Drafted for a skill the resume lacks; awaiting Add it / Skip. */
  | "pending"
  /** The user tapped Add it. */
  | "added"
  /** Dropped to keep the page count. */
  | "removed";

export type RenderedLine = {
  /** DOM id. Margin marks anchor to this. */
  key: string;
  blockId: string;
  opId?: string;
  kind: BlockKind;
  section: string | null;
  style: string | null;
  text: string;
  original?: string;
  state: LineState;
  /** The document's own formatting for this line. */
  runs: Run[];
  size: number;
  spaceBefore: number;
  align: "left" | "center" | "right" | "justify";
  ruleBelow: boolean;
};

/**
 * New or rewritten text, formatted like the line it replaces.
 *
 * A rewording has no runs of its own — the model returns a string. Rather
 * than dropping it into the page unstyled, it inherits the formatting of the
 * plainest run on the line it is replacing, so a rewritten bullet still looks
 * like its neighbours.
 */
export function inheritRun(text: string, from: Run[]): Run[] {
  const template = from.find((r) => !r.bold && !r.italic) ?? from[0];
  return [
    {
      text,
      bold: false,
      italic: false,
      size: template?.size ?? null,
      color: template?.color ?? null,
    },
  ];
}

export type Decisions = Record<string, boolean | undefined>;

/** The margin label for each state. The spec fixes this vocabulary. */
export const MARK_LABEL: Record<Exclude<LineState, "unchanged">, string> = {
  reworded: "Reworded",
  pending: "Needs your OK",
  added: "Added by you",
  removed: "Removed to fit",
};

export function buildLines(
  layout: Layout,
  operations: PlannedOp[],
  decisions: Decisions,
  compareWithOriginal = false,
): RenderedLine[] {
  const base = (block: Layout["blocks"][number]): RenderedLine => ({
    key: `line-${block.id}`,
    blockId: block.id,
    kind: block.kind,
    section: block.section,
    style: block.style,
    text: block.text,
    state: "unchanged",
    runs: block.runs ?? [],
    size: block.size ?? 11,
    spaceBefore: block.space_before ?? 0,
    align: block.align ?? "left",
    ruleBelow: block.rule_below ?? false,
  });

  // Comparing shows the file exactly as it was uploaded: no marks, no drafts,
  // nothing pending. The spec is explicit that this view is "approved as is".
  if (compareWithOriginal) return layout.blocks.map(base);

  const lines: RenderedLine[] = [];

  for (const block of layout.blocks) {
    const edits = operations.filter((op) => op.block === block.id);
    const rephrase = edits.find((op) => op.op === "rephrase");
    const removal = edits.find((op) => op.op === "remove");

    const line = base(block);
    if (removal) {
      lines.push({ ...line, opId: removal.id, state: "removed" });
    } else if (rephrase) {
      const text = rephrase.text ?? block.text;
      lines.push({
        ...line,
        opId: rephrase.id,
        text,
        original: block.text,
        state: "reworded",
        runs: inheritRun(text, line.runs),
      });
    } else {
      lines.push(line);
    }

    for (const insert of edits.filter((op) => op.op === "insert_after")) {
      const decision = decisions[insert.id];
      // A skipped line leaves no trace. The spec forbids re-asking, and a
      // greyed-out reminder of what you declined is a way of re-asking.
      if (decision === false) continue;
      const text = insert.text ?? "";
      lines.push({
        key: `line-${insert.id}`,
        blockId: block.id,
        opId: insert.id,
        kind: block.kind,
        section: block.section,
        style: block.style,
        text,
        state: decision === true ? "added" : "pending",
        // An inserted paragraph is cloned from its neighbour in the file, so
        // the preview inherits that neighbour's formatting to match.
        runs: inheritRun(text, block.runs ?? []),
        size: block.size ?? 11,
        spaceBefore: 0,
        align: block.align ?? "left",
        ruleBelow: false,
      });
    }
  }

  return lines;
}

/** Consecutive bullets become one list, so the document keeps its structure. */
export function groupIntoBlocks(lines: RenderedLine[]): Array<RenderedLine | RenderedLine[]> {
  const out: Array<RenderedLine | RenderedLine[]> = [];
  for (const line of lines) {
    const previous = out[out.length - 1];
    if (line.kind === "bullet") {
      if (Array.isArray(previous)) previous.push(line);
      else out.push([line]);
    } else {
      out.push(line);
    }
  }
  return out;
}
