import { printResume } from "@/lib/tailor/docsvc";
import { printFailure, readDocument } from "@/lib/tailor/print-route";
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
  const document = await readDocument(request, "Nothing to download yet.");
  if (document instanceof Response) return document;

  try {
    const html = await renderResumeHtml(document);
    const printed = await printResume({ html, document });
    if (printed.file === null) {
      return Response.json({ error: "Could not write your file." }, { status: 502 });
    }
    return Response.json({ file: printed.file, pages: printed.pages, renderer: printed.renderer });
  } catch (error) {
    return printFailure(error, "Could not write your file.");
  }
}
