import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * One way to ask Claude for structured data.
 *
 * The schema is written once in zod and converted for the tool definition, so
 * what the model is told to send and what we accept cannot drift apart. The
 * starter this replaced kept two hand-written copies and needed a test
 * to hold them together; this needs neither.
 */

/** Which model does what. Both overridable, because the planner and the checks
 *  are deliberately different tiers (docs/05-architecture.md). */
export const models = () => ({
  planner:
    process.env.ANTHROPIC_PLANNER_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  verifier: process.env.ANTHROPIC_VERIFIER_MODEL ?? "claude-haiku-4-5",
  /** Reading the resume's structure (`structure.ts`). The strongest tier: a
   *  mislabelled line is visible on the page the user downloads. */
  structure: process.env.ANTHROPIC_STRUCTURE_MODEL ?? "claude-opus-5-5",
});

export type Usage = { input: number; output: number; cacheRead: number };

export const emptyUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0 });

export function addUsage(into: Usage, from: Usage): Usage {
  into.input += from.input;
  into.output += from.output;
  into.cacheRead += from.cacheRead;
  return into;
}

function toolSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  // The API rejects the $schema key on a tool's input_schema.
  delete json.$schema;
  return json;
}

export async function structured<T>({
  client,
  model,
  system,
  user,
  tool,
  description,
  schema,
  maxTokens = 8000,
}: {
  client: Anthropic;
  model: string;
  system: string;
  user: string;
  tool: string;
  description: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<{ data: T; usage: Usage }> {
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    // The system prompt is identical on every call for a given stage, so it is
    // the thing worth caching — cache reads are ~10% of input price.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: [{ name: tool, description, input_schema: toolSchema(schema) as never }],
    tool_choice: { type: "tool", name: tool },
    messages: [{ role: "user", content: user }],
  });

  const block = message.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error(`${tool}: model returned no structured output`);
  }

  const parsed = schema.safeParse(block.input);
  if (!parsed.success) {
    throw new Error(`${tool}: output did not match the schema — ${parsed.error.message}`);
  }

  return {
    data: parsed.data,
    usage: {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
    },
  };
}
