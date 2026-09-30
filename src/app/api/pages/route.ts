import type { TemplateDocument } from "@/lib/tailor/document";
import { DocsvcError, printResume } from "@/lib/tailor/docsvc";
import { renderResumeHtml } from "@/lib/tailor/resume-html";

/**
 * The page count of the file `/api/download` would write. It prints through
 * the same `printResume`, so the number can never disagree with the download;
 * only the PDF bytes are left out.
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
    return Response.json({ error: "Nothing to count yet." }, { status: 400 });
  }

  try {
    const html = renderResumeHtml(document);
    const printed = await printResume({ html, document, countOnly: true });
    return Response.json({ pages: printed.pages, renderer: printed.renderer });
  } catch (error) {
    const message =
      error instanceof DocsvcError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Could not count pages.";
    return Response.json({ error: message }, { status: 502 });
  }
}
