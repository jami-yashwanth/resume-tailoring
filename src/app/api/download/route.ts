import { applyPlan } from "@/lib/tailor/pipeline";
import { DocsvcError } from "@/lib/tailor/docsvc";
import type { TailorPlan } from "@/lib/tailor/types";

/**
 * Write the user's decisions into their own file and hand it back.
 *
 * The plan crosses the wire from the browser, so `applyPlan` is what decides
 * what actually reaches the document: `toDocsvcOps` drops anything the user
 * has not approved and pins anything they have. A tampered plan can only
 * remove its own changes, never smuggle one in — the guardrails already ran
 * server-side, and an unapproved line is filtered here regardless.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: { resume?: string; plan?: TailorPlan; maxPages?: number | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.resume || !body.plan) {
    return Response.json({ error: "Nothing to download yet." }, { status: 400 });
  }

  try {
    const applied = await applyPlan(body.resume, body.plan, body.maxPages ?? null);
    return Response.json({
      file: applied.file,
      pages: applied.pages,
      pagesBefore: applied.pages_before,
      applied: applied.applied,
      warnings: applied.warnings,
    });
  } catch (error) {
    const message =
      error instanceof DocsvcError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Could not write your file.";
    return Response.json({ error: message }, { status: 502 });
  }
}
