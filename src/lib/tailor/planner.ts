import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { type Usage, models, structured } from "./claude";
import { shorten } from "./text";
import type { Layout, Match, PlannedOp, Requirement } from "./types";

export { shorten };

/**
 * Deciding what to change.
 *
 * The prompt states the same guardrails that rules.ts enforces. That is
 * deliberate duplication: telling the model keeps most output clean, and the
 * code catches the rest. Neither alone is enough — prompting is not a control,
 * and a rule that rejects half the plan wastes a call.
 */

const OpSchema = z.object({
  op: z.enum(["rephrase", "insert_after", "remove"]),
  block: z.string().describe("The block id this acts on, e.g. 'b6'"),
  text: z.string().optional().describe("New wording. Omit for remove."),
  // Defaulted, not required: a missing shorter wording costs the fitter one
  // option, and failing the whole tailoring over it would cost the user
  // everything. Anything load-bearing below stays required.
  alternatives: z
    .array(z.string())
    .default([])
    .describe("Shorter wordings of the same thing, tried before this change is dropped to fit."),
  claim: z.enum(["verified", "reworded", "added_by_user"]),
  value: z.number().describe("1-10. How much this helps the application."),
  requirements: z.array(z.string()).describe("Requirement ids this answers, e.g. ['r1']"),
  evidence: z
    .array(z.string())
    .describe(
      "Block ids of the candidate's own lines this is based on. Every number in " +
        "'text' must appear in one of these. Empty for added_by_user.",
    ),
  reason: z.string().default("").describe("One short sentence, shown to the candidate."),
});

const MatchSchema = z.object({
  requirementId: z.string(),
  status: z.enum(["matched", "needs_ok", "cannot_change"]),
  evidence: z.array(z.string()).describe("Block ids that back this, if any."),
  // Length is trimmed after parsing, never enforced here: a schema that
  // rejects a long note would throw away the whole plan over a caption.
  note: z
    .string()
    .optional()
    .describe(
      "Shown to the candidate, so write TO them, not about them. Second person, " +
        "under 90 characters, no reasoning. Good: \"You're in Bengaluru. We never " +
        'change this." Bad: "Candidate has ~1 year of Java experience, but the job ' +
        'requires 3+." Only for needs_ok and cannot_change; omit it for matched.',
    ),
});

const Plan = z.object({
  matches: z.array(MatchSchema).describe("One entry per requirement, in the order given."),
  operations: z.array(OpSchema).describe("The edits, most valuable first."),
});

const SYSTEM = `You tailor a candidate's existing resume to one job by proposing edits to
specific lines. You never produce a new resume — only operations on the lines given.

# Operations
- rephrase: rewrite one line using the job's vocabulary for something the candidate already did.
- insert_after: add a new line after the given block. Only for a skill the job asks for that
  the resume does not evidence.
- remove: drop a low-relevance line to make room.

# Hard rules — output that breaks these is discarded
1. NEVER invent a number. Every digit in "text" must already appear in one of the blocks you
   list in "evidence". If you cannot cite it, do not write it.
2. NEVER rephrase or remove a block whose kind is name, contact or role. Job titles, employers
   and dates are untouchable.
3. NEVER write an operation answering a requirement marked KNOCKOUT. Those are shown to the
   candidate as-is. Mark them "cannot_change" and move on.
4. Only use **bold** on a block whose listing says bold=yes. Never introduce formatting a line
   did not have.
5. An insert_after is always claim "added_by_user", always has empty "evidence", and may contain
   NO numbers at all. Use modest verbs — "worked with", "consumed", "used". Never "led",
   "owned", "architected", "managed", "spearheaded".
6. Keep the candidate's voice. Do not inflate into corporate filler.
7. NEVER let a rephrase acquire a skill the resume does not already show. If the resume says
   "Helped refactor the refunds module" and the job wants Kafka, you may NOT rephrase it to
   "...refactored the refunds module for Kafka event streaming". That reads as a rewording but
   is a new claim, and it would be applied without asking the candidate. A skill the resume
   lacks has exactly one route in: an insert_after, claim "added_by_user", which the candidate
   approves. Every technology named in a rephrase must already appear in the blocks you cite
   as its evidence.

# Claim levels
- reworded: a true reframing of something the candidate already wrote. Cite the line in evidence.
- added_by_user: a drafted line for a skill not in the resume. The candidate decides whether it
  goes in; it is never applied on its own.

# Matches
Give exactly one match per requirement, describing the resume AS IT IS TODAY, before
any of your edits.
- matched: the resume already evidences it. Cite the blocks that do.
- needs_ok: the job asks for it, the resume does not evidence it, and you drafted a line.
  Never mark a requirement needs_ok without writing its insert_after draft: a gap with no
  line to offer takes the decision away from the candidate. Draft one for every missing,
  non-knockout requirement — the candidate chooses; you don't choose for them by omitting it.
- cannot_change: a knockout the candidate does not meet.
A requirement you wrote a rephrase for is still "matched" — rewording does not change
whether the candidate has the skill, only how clearly it reads.

Every "reason" and "note" you write is printed on screen for the candidate to read.
Address them directly, in plain English, in one short sentence. Never write about them
in the third person, never explain your own reasoning, and never mention block ids.

Call the tool exactly once.`;

function describeBlocks(layout: Layout): string {
  return layout.blocks
    .map((b) => {
      const frozen = ["name", "contact", "role"].includes(b.kind) ? " FROZEN" : "";
      return `${b.id} [${b.kind}${b.section ? `|${b.section}` : ""}${frozen}] bold=${
        b.has_bold ? "yes" : "no"
      } :: ${b.text}`;
    })
    .join("\n");
}

function describeRequirements(requirements: Requirement[]): string {
  return requirements
    .map(
      (r) =>
        `${r.id} [${r.importance}${r.knockout ? "|KNOCKOUT" : ""}] ${r.label} — job says: "${r.wording}"`,
    )
    .join("\n");
}

export async function planEdits(
  client: Anthropic,
  layout: Layout,
  requirements: Requirement[],
): Promise<{ operations: PlannedOp[]; matches: Match[]; usage: Usage }> {
  const { data, usage } = await structured({
    client,
    model: models().planner,
    system: SYSTEM,
    user: [
      "The candidate's resume, one line per block:",
      describeBlocks(layout),
      "",
      "What the job asks for:",
      describeRequirements(requirements),
      "",
      `The resume is ${layout.pages} page(s). It must not grow.`,
    ].join("\n"),
    tool: "plan_edits",
    description: "Return the edits and how each requirement is met.",
    schema: Plan,
    maxTokens: 8000,
  });

  const operations: PlannedOp[] = data.operations.map((op, i) => ({
    id: `o${i + 1}`,
    ...op,
    // The model is asked for these but not trusted with them: an added line is
    // a decision by definition, whatever the model returned.
    needsDecision: op.claim === "added_by_user",
    value: Math.max(0, Math.min(10, op.value)),
  }));

  const matches = data.matches.map((match) => ({
    ...match,
    note: match.status === "matched" ? undefined : shorten(match.note),
  }));

  return { operations, matches, usage };
}

