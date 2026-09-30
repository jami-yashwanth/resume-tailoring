import type { TemplateDocument } from "@/lib/tailor/document";
import { DocsvcError, type TemplateBlock, renderTemplate } from "@/lib/tailor/docsvc";

/**
 * Render the user's decisions into the one default Rezz template and hand
 * back a PDF.
 *
 * v1 override (28 Sep 2026, see CLAUDE.md): this used to call `applyPlan` to
 * edit the user's own file in place. The client has already resolved the
 * plan and the user's Add it / Skip decisions into a final ordered list of
 * (kind, text) pairs — skipped and dropped lines are excluded there — so
 * there is no original file to touch here, and no plan/resume to re-check
 * against: the guardrails already ran when the plan was built, and a line
 * the client excluded simply isn't in `blocks`.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { blocks?: TemplateBlock[]; document?: TemplateDocument };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.document && !body.blocks?.length) {
    return Response.json({ error: "Nothing to download yet." }, { status: 400 });
  }

  try {
    const rendered = await renderTemplate(body.document ? { document: body.document } : { blocks: body.blocks! });
    return Response.json({ file: rendered.file, pages: rendered.pages });
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
