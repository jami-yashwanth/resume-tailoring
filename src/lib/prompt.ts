import { z } from "zod";

export const TailorResult = z.object({
  tailoredResume: z
    .string()
    .describe("The full tailored resume in Markdown, ready to copy."),
  summary: z
    .string()
    .describe("Two or three sentences on the overall strategy taken."),
  changes: z
    .array(
      z.object({
        section: z.string().describe("Which resume section was touched."),
        before: z.string().describe("The original wording, abbreviated."),
        after: z.string().describe("The new wording, abbreviated."),
        why: z.string().describe("Which job requirement this serves."),
      }),
    )
    .describe("The substantive edits, most important first."),
  matchedKeywords: z
    .array(z.string())
    .describe("Terms from the job description the resume genuinely supports."),
  gaps: z
    .array(
      z.object({
        requirement: z.string(),
        severity: z.enum(["blocking", "notable", "minor"]),
        suggestion: z
          .string()
          .describe("How to address it honestly, or how to position around it."),
      }),
    )
    .describe("Requirements the resume does not currently evidence."),
});

export type TailorResult = z.infer<typeof TailorResult>;

/** JSON Schema handed to Claude as a tool, so output arrives structured. */
export const tailorToolSchema = {
  type: "object" as const,
  properties: {
    tailoredResume: { type: "string" },
    summary: { type: "string" },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string" },
          before: { type: "string" },
          after: { type: "string" },
          why: { type: "string" },
        },
        required: ["section", "before", "after", "why"],
      },
    },
    matchedKeywords: { type: "array", items: { type: "string" } },
    gaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          requirement: { type: "string" },
          severity: { type: "string", enum: ["blocking", "notable", "minor"] },
          suggestion: { type: "string" },
        },
        required: ["requirement", "severity", "suggestion"],
      },
    },
  },
  required: [
    "tailoredResume",
    "summary",
    "changes",
    "matchedKeywords",
    "gaps",
  ],
};

export const SYSTEM_PROMPT = `You tailor resumes to specific job descriptions.

Hard rules:
- Never invent experience, employers, dates, credentials, or metrics. You may
  only reorder, re-word, re-emphasise, and cut what the candidate already wrote.
- If the job asks for something the resume does not evidence, it belongs in
  "gaps", not in the tailored resume.
- Keep the candidate's voice. Do not inflate into corporate filler.
- Mirror the job description's vocabulary only where the candidate's real
  experience matches it, so applicant tracking systems can find the match.
- Lead each bullet with the outcome, keep numbers the candidate supplied, and
  cut bullets that do not serve this particular job.
- Preserve Markdown structure: a heading per section, bullets under each role.

Return your answer by calling the "submit_tailored_resume" tool exactly once.`;

export function buildUserMessage(resume: string, jobDescription: string) {
  return `<job_description>
${jobDescription}
</job_description>

<resume>
${resume}
</resume>

Tailor the resume to this job description.`;
}
