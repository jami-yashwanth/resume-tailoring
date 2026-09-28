import { createClient, resolveCredentials } from "@/lib/anthropic";
import { type Usage, addUsage, emptyUsage, models } from "./claude";
import { coverageOf } from "./coverage";
import * as docsvc from "./docsvc";
import { planEdits } from "./planner";
import { extractRequirements } from "./requirements";
import { type Violation, enforce, verifyMatches } from "./rules";
import { type Layout, type TailorPlan, toDocsvcOps } from "./types";

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
  /** Changes the guardrails threw out. Kept for the claim log, not shown raw. */
  violations: Violation[];
  usage: Usage;
  models: { planner: string; verifier: string };
};

export async function tailor(
  resumeBase64: string,
  jobDescription: string,
  onProgress: Progress = () => {},
): Promise<TailorOutcome> {
  const credentials = resolveCredentials();
  if (!credentials) throw new Error("No Claude credentials configured.");
  const client = createClient(credentials);
  const usage = emptyUsage();

  onProgress("reading_resume");
  const layout = await docsvc.parseResume(resumeBase64);

  onProgress("reading_job");
  const jd = await extractRequirements(client, jobDescription);
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

  onProgress("done");
  return {
    layout,
    plan: {
      company: jd.company || "this job",
      role: jd.role || "the role",
      requirements: jd.requirements,
      matches: verified.matches,
      operations: checked.operations,
      coverage: coverageOf(verified.matches, checked.operations),
    },
    violations: checked.violations,
    usage,
    models: models(),
  };
}

/**
 * Write the user's decisions into their file.
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
