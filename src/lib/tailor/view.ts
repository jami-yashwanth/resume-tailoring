import type { BlockKind, Layout, PlannedOp, Run } from "./types";

/**
 * The tailored document, as the Result screen draws it.
 *
 * Kept out of the components because it is the screen's one real piece of
 * logic: which lines exist, which changed, and what each margin mark points
 * at. A pure function over (document, plan, decisions, chosen wordings).
 */

export type LineState =
  | "unchanged"
  | "reworded"
  /** A rewording the user undid. Their own words are back on the page. */
  | "reverted"
  /** Drafted for a skill the resume lacks; awaiting Add it / Skip. */
  | "pending"
  /** The user tapped Add it. */
  | "added"
  /** Dropped to keep the page count — only ever because the user chose it. */
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

/**
 * The renderer's own bullet set (`BULLET_CHARS` in template_render.py), so the
 * preview strips exactly what the PDF strips. A resume whose bullets carry a
 * typed "•" otherwise shows two: the text's and the list's.
 */
const BULLET_CHARS = "•◦▪‣·-*";

export function stripBullet(text: string): string {
  let start = 0;
  while (start < text.length && (BULLET_CHARS.includes(text[start]) || text[start] === " ")) {
    start += 1;
  }
  return text.slice(start).trim();
}

/** Bullet text without its glyph; every other kind untouched. */
export function cleanText(kind: BlockKind, text: string): string {
  return kind === "bullet" ? stripBullet(text) : text;
}

/**
 * What the user decided about each operation.
 *
 * `true` / `false` mean different things per operation, and deliberately so —
 * each one is the answer to the question that operation asks:
 *  - insert_after: Add it / Skip.
 *  - rephrase: undefined or true is the rewording, `false` is Undo. A
 *    rewording applies on its own, so only `false` carries information.
 *  - remove: `true` is the only value that drops a line. Undecided means the
 *    line stays, because taking the user's own words out is a decision and
 *    the planner does not get to make it.
 */
export type Decisions = Record<string, boolean | undefined>;

/** Which wording of an operation the user is looking at. Index into `wordingOptions`. */
export type Wordings = Record<string, number | undefined>;

/** The margin label for each state. The spec fixes this vocabulary. */
export const MARK_LABEL: Record<Exclude<LineState, "unchanged">, string> = {
  reworded: "Reworded",
  reverted: "Your original",
  pending: "Needs your OK",
  added: "Added by you",
  removed: "Removed to fit",
};

/**
 * Every wording available for one operation, the planner's own first.
 *
 * `alternatives` has been coming back from the planner since the beginning and
 * nothing read it. It is what "Try another wording" offers, and what the page
 * fitter shortens with — the same list, used at both ends.
 */
export function wordingOptions(op: PlannedOp): string[] {
  return [op.text ?? "", ...op.alternatives].map((t) => t.trim()).filter(Boolean);
}

/** The wording currently chosen for an operation. */
export function wordingFor(op: PlannedOp, wordings: Wordings = {}): string {
  const options = wordingOptions(op);
  if (!options.length) return op.text ?? "";
  const index = wordings[op.id] ?? 0;
  return options[((index % options.length) + options.length) % options.length];
}

export function buildLines(
  layout: Layout,
  operations: PlannedOp[],
  decisions: Decisions,
  compareWithOriginal = false,
  wordings: Wordings = {},
): RenderedLine[] {
  const base = (block: Layout["blocks"][number]): RenderedLine => ({
    key: `line-${block.id}`,
    blockId: block.id,
    kind: block.kind,
    section: block.section,
    style: block.style,
    text: cleanText(block.kind, block.text),
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
    // A removal takes one of the user's own lines out of their resume, so it
    // waits for them to say so. Undecided, it does nothing at all.
    const removal = edits.find((op) => op.op === "remove" && decisions[op.id] === true);

    const line = base(block);
    if (removal) {
      lines.push({ ...line, opId: removal.id, state: "removed" });
    } else if (rephrase && decisions[rephrase.id] === false) {
      // Undone. Their own sentence is back, and the mark stays so they can
      // reach the popover and take the rewording again.
      lines.push({ ...line, opId: rephrase.id, state: "reverted" });
    } else if (rephrase) {
      const text = cleanText(block.kind, wordingFor(rephrase, wordings));
      lines.push({
        ...line,
        opId: rephrase.id,
        text,
        original: cleanText(block.kind, block.text),
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
      const text = cleanText(block.kind, wordingFor(insert, wordings));
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

/**
 * The employer whose role a block sits under, for "Add this line to your
 * Razorfin role?".
 *
 * The spec's decision copy names the place the line would land, because "add
 * this line" is a different question depending on which job it joins. Role
 * blocks carry "Employer · Title\tDates", so the employer is the first segment.
 */
export function anchorLabel(layout: Layout, blockId: string): string | null {
  const index = layout.blocks.findIndex((b) => b.id === blockId);
  if (index < 0) return null;
  for (let i = index; i >= 0; i--) {
    const block = layout.blocks[i];
    if (block.kind !== "role") continue;
    const employer = block.text.split("\t")[0].split("·")[0].trim();
    return employer || null;
  }
  return null;
}
