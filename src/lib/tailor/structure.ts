import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { type Usage, emptyUsage, models } from "./claude";
import { HEADING_MAX } from "./outline";
import type { Block, BlockKind, Layout } from "./types";

/**
 * Reading the resume's structure with Claude, after the parser has read its text.
 *
 * docsvc labels each line from styling alone: capitals, bold, size, a tab. That
 * is a guess, and it guessed "CGPA: 8.38" was a section heading (every letter
 * is a capital), so the template drew a grade as a section of its own. Claude
 * reads the document the way a person does and relabels each line.
 *
 * It may only relabel. The text of every line is the user's own and comes
 * through untouched; the model is shown ids and returns ids with a kind, and
 * nothing it writes is ever placed in the document. An answer that does not
 * cover every line exactly once, or that makes a sentence into a heading, is
 * thrown away whole and the parser's labels stand, because a half-applied
 * relabelling is worse than a consistent guess.
 */

/** The kinds a parser can emit. `job_title` is not here: `view.ts` derives it
 *  from a run of role lines, and asking for it would label the same thing two
 *  ways. */
const KINDS = ["name", "contact", "heading", "role", "bullet", "paragraph"] as const;

const Labels = z.object({
  blocks: z
    .array(
      z.object({
        id: z.string().describe("The block's id, exactly as given."),
        kind: z.enum(KINDS),
      }),
    )
    .describe("Every block, once each, in document order."),
});

export type Label = { id: string; kind: BlockKind };

/**
 * Put checked labels onto a layout, or `null` if the labels don't check out.
 *
 * Sections are recomputed from the corrected headings, because every
 * non-heading block names the heading it sits under and the planner, the
 * anchor captions and the template all read that field.
 */
export function applyStructure(layout: Layout, labels: Label[]): { layout: Layout; changed: number } | null {
  const ids = new Set(layout.blocks.map((b) => b.id));
  const byId = new Map<string, BlockKind>();
  for (const label of labels) {
    if (!ids.has(label.id) || byId.has(label.id)) return null;
    byId.set(label.id, label.kind);
  }
  if (byId.size !== ids.size) return null;

  let changed = 0;
  let section: string | null = null;
  const blocks: Block[] = layout.blocks.map((block) => {
    // A bullet marker or list numbering is a fact about the file, not a guess.
    const kind = block.kind === "bullet" ? "bullet" : byId.get(block.id)!;
    if (kind !== block.kind) changed += 1;
    if (kind === "heading") {
      section = block.text;
      return { ...block, kind, section: null };
    }
    return { ...block, kind, section };
  });

  if (blocks.some((b) => b.kind === "heading" && b.text.trim().length > HEADING_MAX)) return null;

  return { layout: { ...layout, blocks }, changed };
}

const SYSTEM = `You label the lines of a resume by what each line is, so it can be set in a clean template.

You are given every line with an id, its text, its formatting, and the label a parser guessed from formatting alone. Return a label for every line.

Labels:
- name: the candidate's own name. Once, at the top.
- contact: email, phone, city, links. The line or lines right under the name.
- heading: the name of a section, such as EXPERIENCE, EDUCATION, SKILLS, PROJECTS, CERTIFICATIONS, ACHIEVEMENTS. A heading names a section and carries no value of its own.
- role: a header line of one entry inside a section: an employer, school or project name, a job title, a degree, a location, or a date range. An entry often has two or three of these in a row.
- bullet: a point under an entry.
- paragraph: any other line of content: a summary, a skills list, a grade or score (CGPA, GPA, percentage), coursework, a line of detail under an entry.

Rules:
- Judge by what the line says and where it sits, not only by capitals or bold. "CGPA: 8.38" in capitals is a grade under a degree, so it is paragraph, not heading.
- The parser's guess is usually right for bullets, names and contact lines. Change a label only when the line is clearly something else.
- Never rewrite, merge, split or skip a line. Label every id exactly once.`;

function describe(layout: Layout): string {
  const lines = layout.blocks.map((b) => {
    const italic = b.runs.some((r) => r.italic);
    const style = [b.has_bold && "bold", italic && "italic", `${b.size}pt`].filter(Boolean).join(", ");
    return JSON.stringify({ id: b.id, text: b.text.replace(/\t/g, " ⇥ "), style, parser: b.kind });
  });
  return `Label every line of this resume with the label_blocks tool.\n\n${lines.join("\n")}`;
}

function schemaFor(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export type StructureResult = {
  layout: Layout;
  usage: Usage;
  /** Whose labels the layout carries. `parser` means Claude's answer was
   *  missing, declined or failed a check, and the file's own guess stands. */
  source: "claude" | "parser";
  changed: number;
};

export async function structureLayout(client: Anthropic, layout: Layout): Promise<StructureResult> {
  const unchanged = (usage: Usage = emptyUsage()): StructureResult => ({ layout, usage, source: "parser", changed: 0 });
  if (!layout.blocks.length) return unchanged();

  try {
    const message = await client.messages.create({
      model: models().structure,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [
        {
          name: "label_blocks",
          description: "Report the label of every line of the resume.",
          input_schema: schemaFor(Labels) as never,
          // Guarantees the call validates against the schema. Not in this SDK
          // version's types, hence the cast on the tool.
          strict: true,
        } as Anthropic.Tool,
      ],
      // Not a forced tool choice: Claude Opus 5.5 rejects `{type: "tool"}` with
      // a 400. The prompt names the tool, and a reply without it falls back.
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: describe(layout) }],
    });

    const usage: Usage = {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
    };
    if ((message.stop_reason as string) !== "tool_use") return unchanged(usage);

    const call = message.content.find((b) => b.type === "tool_use");
    const parsed = call && call.type === "tool_use" ? Labels.safeParse(call.input) : null;
    const applied = parsed?.success ? applyStructure(layout, parsed.data.blocks) : null;
    if (!applied) return unchanged(usage);

    return { layout: applied.layout, usage, source: "claude", changed: applied.changed };
  } catch (error) {
    // The parser's labels are a working document; a failed call must not cost
    // the user their tailoring.
    console.warn("structure: kept the parser's labels —", error instanceof Error ? error.message : error);
    return unchanged();
  }
}
