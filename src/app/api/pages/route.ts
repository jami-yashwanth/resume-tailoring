import { printResume } from "@/lib/tailor/docsvc";
import { printFailure, readDocument } from "@/lib/tailor/print-route";
import { renderResumeHtml } from "@/lib/tailor/resume-html";

/**
 * The page count of the file `/api/download` would write. It prints through
 * the same `printResume`, so the number can never disagree with the download;
 * only the PDF bytes are left out.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const document = await readDocument(request, "Nothing to count yet.");
  if (document instanceof Response) return document;

  try {
    const html = await renderResumeHtml(document);
    const printed = await printResume({ html, document, countOnly: true });
    return Response.json({ pages: printed.pages, renderer: printed.renderer });
  } catch (error) {
    return printFailure(error, "Could not count pages.");
  }
}
