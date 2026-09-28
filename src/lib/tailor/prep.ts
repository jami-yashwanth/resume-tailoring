import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { type Usage, models, structured } from "./claude";
import type { PlannedOp } from "./types";

/**
 * Interview prep for the lines the user chose to add.
 *
 * The other half of the Add it promise. A drafted line describes a skill the
 * resume did not evidence; letting someone put it in and then leaving them to
 * be asked about it cold would be worse than never offering it. So every
 * accepted line comes back with what they are likely to be asked and an honest
 * way to answer when their experience is thin.
 *
 * Generated only for accepted lines, only when the finish screen is reached.
 */

const PrepSchema = z.object({
  items: z.array(
    z.object({
      line: z.string().describe("The added line, copied back verbatim so it can be matched."),
      questions: z
        .array(z.string())
        .describe("Two or three questions an interviewer would actually ask about this line."),
      honest: z
        .string()
        .describe(
          "One or two sentences on how to answer truthfully if their experience is limited. " +
            "Never a script to bluff with.",
        ),
    }),
  ),
});

const SYSTEM = `You prepare a candidate for questions about lines they just added to their resume.

Each line describes something the candidate's resume did not previously evidence. They chose to
add it. Your job is to make sure they can talk about it honestly.

For each line:
- Write 2-3 questions a real interviewer would ask. Specific and technical, not "tell me about
  your experience with X". The kind of question that finds out whether someone has actually done
  the thing.
- Then write one or two sentences on answering honestly when their experience is limited: what to
  say, what to admit, what to offer instead.

Rules:
- Never write a script for bluffing. Never suggest implying more experience than they have.
- "I haven't run that in production, but I understand how it works and here's what I'd check" is
  a good answer. Coach towards that.
- Address the candidate directly, in plain English. No preamble.

Call the tool exactly once.`;

export type PrepItem = { line: string; questions: string[]; honest: string };

export async function interviewPrep(
  client: Anthropic,
  added: PlannedOp[],
): Promise<{ items: PrepItem[]; usage: Usage }> {
  if (!added.length) return { items: [], usage: { input: 0, output: 0, cacheRead: 0 } };

  const { data, usage } = await structured({
    client,
    // The cheap model is right here: the judgment is in the guardrails, not in
    // writing three questions about Kafka.
    model: models().verifier,
    system: SYSTEM,
    user: `Lines the candidate added:\n${added.map((op) => `- ${op.text}`).join("\n")}`,
    tool: "interview_prep",
    description: "Return likely interview questions for each added line.",
    schema: PrepSchema,
    maxTokens: 3000,
  });

  return { items: data.items, usage };
}
