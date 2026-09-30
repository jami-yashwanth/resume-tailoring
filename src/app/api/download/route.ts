import type { TemplateDocument } from "@/lib/tailor/document";
import { DocsvcError, printResume } from "@/lib/tailor/docsvc";
import { renderResumeHtml } from "@/lib/tailor/resume-html";

/**
 * Print the user's decisions through the one default Rezz template and hand
 * back a PDF.
 *
 * v1 override (28 Sep 2026, see CLAUDE.md): the client resolves the final
 * document, so there is no original file to touch here. `/api/pages` prints
 * through the same `printResume`, so its count always matches this file.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { document?: TemplateDocument };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const document = body.document;
  if (!document || (!document.name && document.contact.length === 0 && document.sections.length === 0)) {
    return Response.json({ error: "Nothing to download yet." }, { status: 400 });
  }

  try {
    const html = await renderResumeHtml(document);
    const printed = await printResume({ html, document });
    if (printed.file === null) {
      return Response.json({ error: "Could not write your file." }, { status: 502 });
    }
    return Response.json({ file: printed.file, pages: printed.pages, renderer: printed.renderer });
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
