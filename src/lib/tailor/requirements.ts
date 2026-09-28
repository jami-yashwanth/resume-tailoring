import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { type Usage, models, structured } from "./claude";
import type { Requirement } from "./types";

/**
 * Reading the job description.
 *
 * Cheap model on purpose: this is extraction, not judgment. The one thing it
 * must get right is `knockout` — years, degree, location and work
 * authorisation are shown to the user and never answered by an edit, so
 * mislabelling one is how a product like this ends up lying on someone's
 * behalf.
 */

const RequirementSchema = z.object({
  label: z.string().describe("Short name, as the left panel shows it. e.g. 'Kafka', 'Java'"),
  wording: z.string().describe("The job's own phrasing, quoted, for 'The job says: …'"),
  kind: z.enum(["skill", "experience", "degree", "location", "other"]),
  importance: z.enum(["must", "nice"]),
  knockout: z
    .boolean()
    .describe(
      "True for anything a person cannot change by editing a resume: location, " +
        "years of experience, degree, work authorisation.",
    ),
});

const Extraction = z.object({
  company: z
    .string()
    .default("")
    .describe("The hiring company's name, exactly as the posting writes it. Empty if not stated."),
  role: z
    .string()
    .default("")
    .describe("The job title, exactly as the posting writes it. Empty if not stated."),
  requirements: z
    .array(RequirementSchema)
    .describe("Every distinct thing the job asks for, most important first."),
});

const SYSTEM = `You read a job description and list what it asks for.

Rules:
- One entry per distinct requirement. Do not split a single ask into synonyms
  ("Java 17" and "Java" are one requirement), and do not merge two asks into one.
- Quote the job's own wording in "wording". Do not paraphrase it. This is shown
  to the candidate verbatim.
- "knockout" is true only for things a candidate cannot change by editing their
  resume: where they are based, years of experience, a required degree, work
  authorisation. A skill is never a knockout, however essential it is.
- "must" vs "nice": follow the job's own framing ("required", "must have" vs
  "bonus", "nice to have", "a plus"). If it is not framed either way, use "must"
  for anything in a requirements list and "nice" for anything in a wish list.
- Ignore benefits, company blurb, and equal-opportunity boilerplate.
- Also report the hiring company and the job title, exactly as the posting writes them. These
  are shown back to the candidate and used to name their downloaded file, so do not invent or
  tidy them. Leave either empty if the posting does not say.

Return between 4 and 12 requirements. Call the tool exactly once.`;

export async function extractRequirements(
  client: Anthropic,
  jobDescription: string,
): Promise<{ requirements: Requirement[]; company: string; role: string; usage: Usage }> {
  const { data, usage } = await structured({
    client,
    model: models().verifier,
    system: SYSTEM,
    user: `<job_description>\n${jobDescription}\n</job_description>`,
    tool: "list_requirements",
    description: "Return everything this job asks for.",
    schema: Extraction,
    maxTokens: 4000,
  });

  return {
    requirements: data.requirements.map((r, i) => ({ id: `r${i + 1}`, ...r })),
    // Named here because the whole flow needs it: the breadcrumb, the download
    // filename and the finish screen all said "Kosha Payments" for every job
    // while this was hardcoded in the Result screen.
    company: data.company.trim(),
    role: data.role.trim(),
    usage,
  };
}
