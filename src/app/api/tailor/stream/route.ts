import { MISSING_CREDENTIALS, resolveCredentials } from "@/lib/anthropic";
import { DocsvcError } from "@/lib/tailor/docsvc";
import { estimateCost, tailor } from "@/lib/tailor/pipeline";

/**
 * Tailoring, streamed.
 *
 * The pipeline takes ~15 seconds, and the spec asks for staged progress rather
 * than a spinner ("read the job ✓, matched 6 ✓, rewording 7 lines…"). So the
 * stages go down the wire as they happen instead of the client waiting on one
 * silent response.
 *
 * Nothing is stored. The browser holds the file and posts it when there is work
 * to do — there is no database yet, and keeping the document out of server
 * state is the honest default for this product.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!resolveCredentials()) {
    return Response.json({ error: MISSING_CREDENTIALS }, { status: 500 });
  }

  let body: { resume?: unknown; jobDescription?: unknown; filename?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const resume = typeof body.resume === "string" ? body.resume : "";
  const jobDescription =
    typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  const filename = typeof body.filename === "string" ? body.filename : undefined;

  if (!resume) {
    return Response.json({ error: "Upload your resume first." }, { status: 400 });
  }
  if (jobDescription.length < 50) {
    return Response.json(
      { error: "Paste the job description first — a few lines at least." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        const result = await tailor(resume, jobDescription, filename, (stage, detail) =>
          send("progress", { stage, detail }),
        );
        send("done", { layout: result.layout, plan: result.plan });
        // The cost-per-resume metric the architecture doc asks for, measured
        // where it happens. Server log only — never sent to the client.
        const cost = estimateCost(result.usage, result.models.planner);
        console.log(
          `[tailor] planner=${result.models.planner} verifier=${result.models.verifier} ` +
            `tokens in=${result.usage.input} cached=${result.usage.cacheRead} ` +
            `out=${result.usage.output} ≈ ₹${cost.toFixed(2)}`,
        );
      } catch (error) {
        // The commonest failure by far is the file service being down, and
        // "fetch failed" tells nobody anything.
        const message =
          error instanceof DocsvcError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Tailoring failed.";
        send("failed", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
