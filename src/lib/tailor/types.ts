/**
 * The contract between the job description, the user's document, and the
 * Result screen.
 *
 * These names are deliberately the same ones the product uses out loud:
 * a requirement is "matched", "needs your OK" or "can't change"; a line is
 * "verified", "reworded" or "added by you". Keeping the vocabulary identical
 * across the spec, the UI and the code is what stops the guardrails getting
 * quietly reinterpreted on the way through.
 */

/** Mirrors `Claim` in services/docsvc/app/models.py. */
export type ClaimLevel = "verified" | "reworded" | "added_by_user";

/** Mirrors `BlockKind` in services/docsvc/app/models.py. */
export type BlockKind = "name" | "contact" | "heading" | "role" | "bullet" | "paragraph";

/** A span of text with one set of formatting. Mirrors `Run` in docsvc. */
export type Run = {
  text: string;
  bold: boolean;
  italic: boolean;
  /** Points, when it differs from the paragraph. */
  size: number | null;
  color: string | null;
  small_caps?: boolean;
  underline?: boolean;
};

/** One addressable line of the user's document, as docsvc parsed it. */
export type Block = {
  id: string;
  kind: BlockKind;
  text: string;
  section: string | null;
  style: string | null;
  lines: number;
  has_bold: boolean;
  /** Contains a hyperlink. Such a line is never rewritten — the editor works
   *  run by run and would drop the link. */
  has_link?: boolean;
  /** What the preview draws. Without these it renders a template that merely
   *  resembles a resume, and the user spots the difference immediately. */
  runs: Run[];
  size: number;
  space_before: number;
  align?: "left" | "center" | "right" | "justify";
  /** A rule under the paragraph — how most resumes underline a heading. */
  rule_below?: boolean;
};

export type Layout = {
  format: "docx" | "pdf";
  pages: number;
  fonts: string[];
  blocks: Block[];
  warnings: string[];
};

/** Something the job asks for. `wording` is the job's own phrasing, kept so the
 *  popover can show "The job says: …" verbatim rather than a paraphrase. */
export type Requirement = {
  id: string;
  label: string;
  wording: string;
  kind: "skill" | "experience" | "degree" | "location" | "other";
  importance: "must" | "nice";
  /** Years, degree, location, work authorisation. Shown, never changed. */
  knockout: boolean;
};

export type MatchStatus =
  | "matched" // the resume already evidences it
  | "needs_ok" // we can draft a line, but it isn't the user's fact yet
  | "cannot_change"; // a knockout

export type Match = {
  requirementId: string;
  status: MatchStatus;
  /** Blocks that back this requirement, for "Based on your line: …" and for
   *  the left panel's click-to-highlight. */
  evidence: string[];
  note?: string;
};

/**
 * One planned edit. A superset of docsvc's `Op`: the extra fields are what the
 * Result screen needs and the file service does not care about.
 */
export type PlannedOp = {
  id: string;
  op: "rephrase" | "insert_after" | "remove";
  block: string;
  text?: string;
  /** Shorter wordings, tried before the change is dropped to fit the page. */
  alternatives: string[];
  claim: ClaimLevel;
  /** match weight x claim strength; docsvc drops the cheapest first. */
  value: number;
  /** Which requirements this change answers. */
  requirements: string[];
  /**
   * The user's own lines this change is built from — what the popover shows as
   * "Based on your line: …".
   *
   * Load-bearing, not decorative: it is the set a number in `text` is allowed
   * to come from. An `added_by_user` line has no evidence by definition, which
   * is exactly why it may carry no figures.
   */
  evidence: string[];
  reason?: string;
  /**
   * True only for `added_by_user`. Nothing with this flag reaches the document
   * until the user taps Add it — that is the whole promise, so it is a field
   * rather than a convention.
   */
  needsDecision: boolean;
  approved?: boolean;
};

export type Coverage = {
  covered: number;
  total: number;
  /** What the untouched resume covered, so the screen can say "your original
   *  covered 3" instead of showing a bare number. */
  originalCovered: number;
};

export type TailorPlan = {
  /** Who the job is for, read from the posting. Used for the breadcrumb, the
   *  download filename and the finish screen. */
  company: string;
  role: string;
  requirements: Requirement[];
  matches: Match[];
  operations: PlannedOp[];
  coverage: Coverage;
};

/** Exactly the shape docsvc's /apply accepts — nothing product-specific. */
export type DocsvcOp = {
  op: PlannedOp["op"];
  block: string;
  text?: string;
  alternatives: string[];
  claim: ClaimLevel;
  value: number;
  droppable: boolean;
  reason?: string;
};

/**
 * Only approved work crosses to the file service.
 *
 * Two rules are enforced here rather than trusted: a line the user has not
 * approved is not sent at all, and a line the user *has* approved is pinned so
 * the page fitter can never sacrifice it to save space.
 */
export function toDocsvcOps(operations: PlannedOp[]): DocsvcOp[] {
  return operations
    .filter((op) => !op.needsDecision || op.approved === true)
    .map((op) => ({
      op: op.op,
      block: op.block,
      text: op.text,
      alternatives: op.alternatives,
      claim: op.claim,
      value: op.value,
      droppable: op.claim !== "added_by_user",
      reason: op.reason,
    }));
}
