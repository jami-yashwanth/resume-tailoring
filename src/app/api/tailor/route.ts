import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  SYSTEM_PROMPT,
  TailorResult,
  buildUserMessage,
  tailorToolSchema,
} from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local." },
      { status: 500 },
    );
  }

  let body: { resume?: unknown; jobDescription?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const resume = typeof body.resume === "string" ? body.resume.trim() : "";
  const jobDescription =
    typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";

  if (resume.length < 50) {
    return NextResponse.json(
      { error: "Paste a resume first (at least a few lines)." },
      { status: 400 },
    );
  }
  if (jobDescription.length < 50) {
    return NextResponse.json(
      { error: "Paste a job description first (at least a few lines)." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: "submit_tailored_resume",
          description: "Return the tailored resume and the supporting analysis.",
          input_schema: tailorToolSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_tailored_resume" },
      messages: [
        { role: "user", content: buildUserMessage(resume, jobDescription) },
      ],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "The model did not return structured output. Try again." },
        { status: 502 },
      );
    }

    const parsed = TailorResult.safeParse(toolUse.input);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "The model's output did not match the expected shape." },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown error calling Claude.";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
