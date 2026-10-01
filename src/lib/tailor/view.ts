import { standardHeading } from "./headings";
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
  | "removed"
  /** Retyped by the user. Their own words, over the original or a rewording. */
  | "edited";

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
  if (kind === "bullet") return stripBullet(text);
  // Contact separators normalise to the template's pipes on both sides —
  // the compiled file sets ` $|$ ` between fields, which reads as a
  // single-spaced pipe — so the preview wraps where the file does.
  if (kind === "contact") return text.replace(/\s*[·|\t]\s*/g, " | ");
  return text;
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
  edited: "Edited by you",
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
  /** False keeps role lines as parsed; the template document resolves its own
   *  fields from the outline and must not see them folded. */
  group = true,
  /** The user's own text by block id; a whole-line edit replaces the line
   *  (original or reworded) and marks it `edited`. Field edits are not lines
   *  and apply in `resolveDocument`. */
  edits: Record<string, string> = {},
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
  // Still grouped, though — under the v1 template override both sides render
  // into the same template, and a diff that moved the layout as well as the
  // words would report the template as a change the user made.
  if (compareWithOriginal) {
    const all = layout.blocks.map(base);
    return group ? groupRoles(all) : all;
  }

  const lines: RenderedLine[] = [];

  for (const block of layout.blocks) {
    const ops = operations.filter((op) => op.block === block.id);
    const rephrase = ops.find((op) => op.op === "rephrase");
    // A removal takes one of the user's own lines out of their resume, so it
    // waits for them to say so. Undecided, it does nothing at all.
    const removal = ops.find((op) => op.op === "remove" && decisions[op.id] === true);

    const line = base(block);
    const edit = edits[block.id];
    if (removal) {
      // Struck through in the user's current words, so "Keep it" brings back what they typed.
      lines.push({ ...line, text: edit ?? line.text, opId: removal.id, state: "removed" });
    } else if (edit !== undefined) {
      // Their own words, over whatever was on the line: the rewording when
      // one is applied (so undoing the edit returns to it), else the original.
      const replaced =
        rephrase && decisions[rephrase.id] !== false ? cleanText(block.kind, wordingFor(rephrase, wordings)) : line.text;
      lines.push({
        ...line,
        opId: rephrase?.id,
        text: edit,
        original: replaced,
        state: "edited",
        runs: inheritRun(edit, line.runs),
      });
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

    for (const insert of ops.filter((op) => op.op === "insert_after")) {
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

  // Last, so the fold sees the decided document: a role line the user reworded
  // keeps its own key and its mark rather than being folded away.
  return group ? groupRoles(lines) : lines;
}

/* ---------------------------------------------------------------------------
   A job's header.

   Parsers hand back what the file had: "Inncircles", "Senior Software
   Engineer" and "Hyderabad, Telangana" as three separate `role` blocks. Drawn
   literally that is three bold lines carrying no hierarchy and costing 48pt of
   a 741pt page, and it is not the shape a resume parser reads best either —
   the guidance is one entry line with its dates, and the title beneath.

   So a run of role lines is folded into two: the employer with its location
   and dates (bold, `role`), then the title (regular, `job_title`).
   --------------------------------------------------------------------------- */

/** Words that make a line a job title rather than an employer or a place. */
const TITLE_WORDS =
  /\b(engineer|developer|manager|intern|lead|architect|analyst|consultant|designer|scientist|director|head|officer|associate|specialist|administrator|technician|researcher|president|founder|trainee)\b/i;

/** "Hyderabad, Telangana" — short, comma'd, no digits, and not a title. */
function isLocation(text: string): boolean {
  return (
    text.includes(",") &&
    text.trim().split(/\s+/).length <= 5 &&
    !/\d/.test(text) &&
    !TITLE_WORDS.test(text)
  );
}

/**
 * One run of consecutive `role` lines, folded into an employer line and a title.
 *
 * Returns the run untouched whenever it cannot be read confidently, which is
 * the point: a wrong guess rewrites a line of the user's resume, and every
 * caller is better off with today's three bold lines than with a location
 * glued onto a job title.
 *
 * It also bails on any run carrying an operation or a state — folding two
 * lines into one drops a `key`, and ops, margin marks and `focusLine` all
 * address lines by it. Employer, title and location lines are never rewritten
 * (they are knockout facts; the product rule is that Rezz doesn't touch them),
 * so the folded path is the one that actually runs.
 */
export function groupRoleRun(run: RenderedLine[]): RenderedLine[] {
  if (run.length < 2) return run;
  if (run.some((l) => l.opId || l.state !== "unchanged")) return run;

  const dated = run.find((l) => l.text.includes("\t"));
  const employer = dated ?? run[0];
  const rest = run.filter((l) => l !== employer);

  const location = rest.find((l) => isLocation(l.text));
  const others = rest.filter((l) => l !== location);
  // Nothing left to sit under the employer line: leave the run alone rather
  // than produce a lone bold line whose title we just deleted.
  if (!others.length) return run;

  const [left, dates] = employer.text.includes("\t")
    ? employer.text.split("\t", 2)
    : [employer.text, ""];
  const head = location ? `${left.trim()} — ${location.text.trim()}` : left.trim();

  return [
    { ...employer, text: dates ? `${head}\t${dates.trim()}` : head },
    ...others.map((l) => ({ ...l, kind: "job_title" as const })),
  ];
}

/** Every run of role lines in the document, folded. */
export function groupRoles(lines: RenderedLine[]): RenderedLine[] {
  const out: RenderedLine[] = [];
  for (let i = 0; i < lines.length; ) {
    if (lines[i].kind !== "role") {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    let end = i;
    while (end < lines.length && lines[end].kind === "role") end += 1;
    out.push(...groupRoleRun(lines.slice(i, end)));
    i = end;
  }
  return out;
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
 * Where a drafted line would land, for "Add this line to your Razorfin role?"
 * / "Add this line to your Skills?".
 *
 * The spec's decision copy names the place the line would land, because "add
 * this line" is a different question depending on where it joins. An anchor in
 * a recognised non-experience section names that section — walking back to the
 * nearest role from inside Skills would caption the line with a job the user
 * never claimed. Inside experience, role blocks carry "Employer · Title\tDates",
 * so the employer is the first segment.
 */
export type AnchorLabel = { label: string; kind: "role" | "section" };

export function anchorLabel(layout: Layout, blockId: string): AnchorLabel | null {
  const index = layout.blocks.findIndex((b) => b.id === blockId);
  if (index < 0) return null;

  const section = layout.blocks[index].section;
  if (section) {
    const standard = standardHeading(section);
    if (standard && standard !== "Experience") return { label: standard, kind: "section" };
  }

  for (let i = index; i >= 0; i--) {
    const block = layout.blocks[i];
    if (block.kind !== "role") continue;
    const employer = block.text.split("\t")[0].split("·")[0].trim();
    return employer ? { label: employer, kind: "role" } : null;
  }
  return null;
}
