import { createClient, resolveCredentials } from "@/lib/anthropic";
import { type Usage, addUsage, emptyUsage, models } from "./claude";
import { coverageOf } from "./coverage";
import * as docsvc from "./docsvc";
import { normaliseHeading } from "./headings";
import { extractOutline } from "./extract";
import { fallbackOffers } from "./offers";
import { planEdits } from "./planner";
import { extractRequirements } from "./requirements";
import { type Violation, enforce, verifyMatches } from "./rules";
import { type Layout, type Outline, type PlannedOp, type TailorPlan, toDocsvcOps } from "./types";

/**
 * The tailoring pipeline, end to end.
 *
 * Read the job, read the document, plan the edits, throw out anything that
 * breaks a guardrail, and report what it costs. Applying the result to the
 * file is a separate step, because the user makes their decisions in between.
 */

/** Named so the Tailoring screen can show the spec's staged steps rather than
 *  a spinner (docs/03-ux-result-screen.md). */
export type Stage =
  | "reading_job"
  | "reading_resume"
  | "planning"
  | "checking"
  | "done";

export type Progress = (stage: Stage, detail?: string) => void;

export type TailorOutcome = {
  layout: Layout;
  plan: TailorPlan;
  /** The resume's structure as Claude read it, verbatim-checked; null when the
   *  parser's labels stand. */
  outline: Outline | null;
  /** Whose reading the layout carries, and how many tries it took. For the log. */
  structure: { source: "claude" | "parser"; attempts: number };
  /** Changes the guardrails threw out. Kept for the claim log, not shown raw. */
  violations: Violation[];
  usage: Usage;
  models: { planner: string; verifier: string };
};

/**
 * Rename each section heading a parser wouldn't recognise — see `headings.ts`
 * for why that matters more than anything else on the page.
 *
 * These are `rephrase` ops like any other, so they inherit the whole review
 * machinery for free: applied automatically (the product rule for rewording
 * the user's own words), drawn with the highlighter, listed with Undo. They
 * carry no requirements and claim `reworded`, so they cannot move the coverage
 * count — "Covers 7 of 9" is about the job's asks, and a heading is not one.
 */
function headingOps(layout: Layout): PlannedOp[] {
  const ops: PlannedOp[] = [];
  for (const block of layout.blocks) {
    if (block.kind !== "heading") continue;
    const swap = normaliseHeading(block.text);
    if (!swap) continue;
    ops.push({
      id: `heading-${block.id}`,
      op: "rephrase",
      block: block.id,
      text: swap.to,
      alternatives: [],
      claim: "reworded",
      // Cheapest thing on the page to drop: renaming a heading buys no
      // coverage, so when the fitter needs a line back it should take this
      // before it touches anything the user is actually being judged on.
      value: 0,
      requirements: [],
      evidence: [block.id],
      reason: `"${swap.from}" is a heading some applicant tracking systems don't recognise, so everything under it can be skipped. "${swap.to}" is the standard name for the same section.`,
      // The user's own word for their own section, in the standard spelling —
      // a rewording, which applies on its own with Undo. Only added_by_user
      // waits for a decision.
      needsDecision: false,
    });
  }
  return ops;
}

export async function tailor(
  resumeBase64: string,
  jobDescription: string,
  filename: string | undefined,
  onProgress: Progress = () => {},
): Promise<TailorOutcome> {
  const credentials = resolveCredentials();
  if (!credentials) throw new Error("No Claude credentials configured.");
  const client = createClient(credentials);
  const usage = emptyUsage();

  onProgress("reading_resume");
  const parsed = await docsvc.parseResume(resumeBase64, filename);

  // Claude reads the resume's structure (see extract.ts) while it reads
  // the job: neither depends on the other, so the structure pass costs no wait.
  onProgress("reading_job");
  const [structured, jd] = await Promise.all([
    extractOutline(client, parsed),
    extractRequirements(client, jobDescription),
  ]);
  const layout = structured.layout;
  addUsage(usage, structured.usage);
  addUsage(usage, jd.usage);
  onProgress("reading_job", `${jd.requirements.length} requirements`);

  onProgress("planning");
  const planned = await planEdits(client, layout, jd.requirements);
  addUsage(usage, planned.usage);
  onProgress("planning", `${planned.operations.length} changes drafted`);

  // Everything the model proposed is checked before it can reach the document
  // or the screen — the edits, and the claims made about the resume itself.
  onProgress("checking");
  const verified = verifyMatches(planned.matches, jd.requirements, layout);
  const checked = enforce(planned.operations, layout, jd.requirements, verified.matches);
  onProgress(
    "checking",
    `${checked.violations.length} rejected` +
      (verified.downgraded.length ? `, ${verified.downgraded.length} unbacked match corrected` : ""),
  );

  // Added after `enforce`, deliberately: a heading rename answers no
  // requirement and is built from no evidence, so every check in there would
  // reject it for failing tests it was never meant to take. It is not the
  // model's work either — the synonym table is fixed and the match is exact.
  // fallbackOffers is the same class of thing: deterministic drafts for the
  // missing requirements the planner (or the verifier's downgrade) left with
  // no line to offer, so every gap reaches the user as a decision.
  const operations = [
    ...checked.operations,
    ...headingOps(layout),
    ...fallbackOffers(layout, jd.requirements, verified.matches, checked.operations),
  ];

  onProgress("done");
  return {
    layout,
    outline: structured.outline,
    structure: { source: structured.source, attempts: structured.attempts },
    plan: {
      company: jd.company || "this job",
      role: jd.role || "the role",
      requirements: jd.requirements,
      matches: verified.matches,
      operations,
      coverage: coverageOf(jd.requirements, verified.matches, operations),
    },
    violations: checked.violations,
    usage,
    models: models(),
  };
}

/**
 * Write the user's decisions into their file.
 *
 * Currently unused — `/api/download` calls `docsvc.renderTemplate` directly
 * for v1 (see CLAUDE.md's dated override). Kept, not deleted: this is the
 * in-place path to come back to once that override is revisited.
 *
 * `toDocsvcOps` is what enforces the promise at this boundary: a drafted line
 * the user has not approved is not sent, and one they have approved is pinned
 * so the page fitter cannot drop it.
 */
export async function applyPlan(
  resumeBase64: string,
  plan: TailorPlan,
  maxPages: number | null,
): Promise<docsvc.ApplyResult> {
  return docsvc.applyOps(resumeBase64, toDocsvcOps(plan.operations), maxPages);
}

/** Rough rupee cost of one tailoring, for the cost-per-resume metric the
 *  architecture doc says to track. Prices are per million tokens. */
export function estimateCost(usage: Usage, model: string, usdToInr = 88): number {
  const rates: Record<string, { input: number; output: number }> = {
    "claude-sonnet-5": { input: 2, output: 10 },
    "claude-haiku-4-5": { input: 1, output: 5 },
    "claude-opus-5": { input: 5, output: 25 },
  };
  const rate = rates[model] ?? rates["claude-sonnet-5"];
  const usd =
    (usage.input * rate.input + usage.cacheRead * rate.input * 0.1 + usage.output * rate.output) /
    1_000_000;
  return usd * usdToInr;
}
