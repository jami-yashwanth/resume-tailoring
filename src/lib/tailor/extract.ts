import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { type Usage, addUsage, emptyUsage, models } from "./claude";
import { checkOutline, outlineLabels } from "./outline";
import { applyStructure } from "./structure";
import type { Layout, Outline } from "./types";

/**
 * Sorting the parsed lines into an outline with Claude.
 *
 * The model is shown every line with an id and returns ids, plus text copied out
 * of a line where one line holds two fields. It never writes text of its own,
 * and `checkOutline` throws away anything that is not a verbatim piece of the
 * file. One rejection gets one retry that names the lines it missed; a second
 * rejection, a refusal or any error keeps the parser's labels, because a
 * half-trusted outline is worse than a consistent guess.
 */

const SYSTEM = `You sort the lines of a resume into its structure so it can be set in a clean template. You never write text of your own: every value you return is a line's id, or text copied exactly from one line.

You are given every line with an id, its text, its formatting, the label a parser guessed from formatting alone, and the section the parser thinks it is in.

Return:
- name: the id of the candidate's name line, or null.
- contact: ids of the lines under the name with email, phone, city, links.
- sections, in document order. Each has a kind (summary, experience, education, projects, skills, certifications, achievements, other), the id of its heading line (null if the resume has no heading there), entries, skills rows, and loose lines.

An entry is one job, degree, project or certificate. Its header fields are org (employer, school, project or issuer), title (job title, degree, tech stack), dates, and place (city or location). Each field is {block, text}: the id of the line and the exact text of that field copied from it. When one line holds two fields — "Google ⇥ Jun 2022 – Present" — return both fields from the same block with the exact text of each. Use null for a field the resume does not give. bullets are the ids of the points under the entry. lines are the ids of other detail under it: a grade, coursework, a description line.

A skills row is {block, label, items}: one line of the skills section, with its category label (text before the colon, or null) and its items, both copied exactly.

Rules:
- Copy text exactly, including capitals, punctuation, dashes and spelling. Never fix, shorten, expand or reorder anything.
- Every id appears exactly once across the whole answer. A line you cannot place goes in the lines of the section it sits in.
- A line the parser marked bullet is a bullet or a line, never a header field.
- Judge by what a line says and where it sits, not only by capitals or bold. "CGPA: 8.38" in capitals is a grade under a degree, so it is a line of that entry, not a heading.`;

// Mirrors `Outline` in types.ts key for key. Every key is required and absence
// is `null`, which is what `strict: true` accepts.
const Field = z.object({ block: z.string(), text: z.string() }).nullable();
const OutlineSchema = z.object({
  name: z.string().nullable(),
  contact: z.array(z.string()),
  sections: z.array(
    z.object({
      heading: z.string().nullable(),
      kind: z.enum(["summary", "experience", "education", "projects", "skills", "certifications", "achievements", "other"]),
      entries: z.array(
        z.object({
          org: Field,
          title: Field,
          dates: Field,
          place: Field,
          bullets: z.array(z.string()),
          lines: z.array(z.string()),
        }),
      ),
      skills: z.array(z.object({ block: z.string(), label: z.string().nullable(), items: z.string() })),
      lines: z.array(z.string()),
    }),
  ),
});

function describe(layout: Layout): string {
  const lines = layout.blocks.map((b) => {
    const italic = b.runs.some((r) => r.italic);
    const style = [b.has_bold && "bold", italic && "italic", `${b.size}pt`].filter(Boolean).join(", ");
    return JSON.stringify({ id: b.id, text: b.text.replace(/\t/g, " ⇥ "), style, parser: b.kind, section: b.section });
  });
  return `Sort every line of this resume with the extract_outline tool.\n\n${lines.join("\n")}`;
}

function toolSchema(): Record<string, unknown> {
  const json = z.toJSONSchema(OutlineSchema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export type ExtractResult = {
  /** Relabelled through `applyStructure` when `source` is "claude". */
  layout: Layout;
  /** Null when `source` is "parser". */
  outline: Outline | null;
  /** Summed over both attempts. */
  usage: Usage;
  /** `parser` means Claude's answer was missing, declined or failed a check. */
  source: "claude" | "parser";
  /** Calls made: 0, 1 or 2. */
  attempts: number;
};

const rejection = (reason: string, missing: string[]) =>
  `Your answer was rejected: ${reason}. Every line must appear exactly once. Put any line you cannot place under the section it sits in, in that section's "lines". Missing: ${missing.length ? missing.join(", ") : "none"}.`;

export async function extractOutline(client: Anthropic, layout: Layout): Promise<ExtractResult> {
  const usage = emptyUsage();
  let attempts = 0;
  const kept = (): ExtractResult => ({ layout, outline: null, usage, source: "parser", attempts });
  if (!layout.blocks.length) return kept();

  try {
    const first: Anthropic.MessageParam = { role: "user", content: describe(layout) };
    let messages: Anthropic.MessageParam[] = [first];
    let reason = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      attempts += 1;
      const message = await client.messages.create({
        model: models().structure,
        max_tokens: 16000,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [
          {
            name: "extract_outline",
            description: "Report the structure of the resume: every line placed exactly once.",
            input_schema: toolSchema() as never,
            // Not in this SDK version's types, hence the cast on the tool.
            strict: true,
          } as Anthropic.Tool,
        ],
        // Not a forced tool choice: Claude Opus 5.5 rejects `{type: "tool"}` with
        // a 400. The prompt names the tool, and a reply without it falls back.
        tool_choice: { type: "auto" },
        messages,
      });
      addUsage(usage, {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens ?? 0,
      });
      if ((message.stop_reason as string) !== "tool_use") return kept();
      const call = message.content.find((b) => b.type === "tool_use");
      if (!call || call.type !== "tool_use") return kept();

      let missing: string[] = [];
      const parsed = OutlineSchema.safeParse(call.input);
      if (!parsed.success) {
        reason = "answer did not match the schema";
      } else {
        const checked = checkOutline(layout, parsed.data);
        if (checked.ok) {
          const applied = applyStructure(layout, outlineLabels(checked.outline));
          if (applied) return { layout: applied.layout, outline: checked.outline, usage, source: "claude", attempts };
          reason = "a heading was longer than a heading can be";
        } else {
          reason = checked.reason;
          missing = checked.missing;
        }
      }

      // Show the model its own answer and why it failed, so the retry is a fix
      // and not a fresh guess.
      messages = [
        first,
        { role: "assistant", content: [call] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: rejection(reason, missing) }] },
      ];
    }

    console.warn("extract: kept the parser's labels —", reason);
    return kept();
  } catch (error) {
    // The parser's labels are a working document; a failed call must not cost
    // the user their tailoring.
    console.warn("extract: kept the parser's labels —", error instanceof Error ? error.message : error);
    return kept();
  }
}
