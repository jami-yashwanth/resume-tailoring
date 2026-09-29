import { DocsvcError, parseResume } from "@/lib/tailor/docsvc";

/**
 * Read the user's file and say what we found in it.
 *
 * This is the honest check doing its first job. It runs at upload rather than
 * after tailoring so that a file we cannot read is named immediately, instead
 * of fifteen seconds and one credit later.
 *
 * Free and anonymous, like everything before the Result screen.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { file?: string; filename?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.file) {
    return Response.json({ error: "No file received." }, { status: 400 });
  }

  // The browser enforces 3 MB before uploading; this catches anyone posting
  // to the API directly. 4.5M base64 characters ≈ 3.4 MB decoded, a little
  // over the client cap so a legitimate boundary file never bounces here.
  if (body.file.length > 4_500_000) {
    return Response.json({ error: "That file is over the 3 MB limit." }, { status: 413 });
  }

  // Magic bytes, not the filename: a renamed file gets caught here instead of
  // confusing the parser. PDF starts "%PDF" (JVBER in base64), DOCX is a ZIP
  // ("PK\x03\x04" → UEsDB).
  const isPdf = (body.filename ?? "").toLowerCase().endsWith(".pdf");
  if (!body.file.startsWith(isPdf ? "JVBER" : "UEsDB")) {
    return Response.json(
      {
        error: isPdf
          ? "That file has a .pdf name but isn't a PDF inside. Export a fresh copy and try again."
          : "That file has a .docx name but isn't a Word file inside. Save it again from Word as .docx.",
      },
      { status: 422 },
    );
  }

  try {
    const layout = await parseResume(body.file, body.filename);
    return Response.json({
      pages: layout.pages,
      fonts: layout.fonts,
      blocks: layout.blocks.length,
      warnings: layout.warnings,
      name: layout.blocks.find((b) => b.kind === "name")?.text ?? null,
    });
  } catch (error) {
    // 422 from docsvc means the document itself defeated the parser — a
    // scanned page, a corrupt file. That is the user's problem to act on, so
    // it is reported as a readable failure rather than a server error.
    const message = error instanceof Error ? error.message : "Could not read that file.";
    const unreadable = message.includes("422") || /could not read/i.test(message);

    if (error instanceof DocsvcError && !unreadable) {
      return Response.json({ error: message }, { status: 503 });
    }
    // A locked file is fixable in a way a scanned one is not, so it gets its
    // own advice instead of the scanned-resume message.
    if (/password/i.test(message)) {
      return Response.json(
        { error: "This PDF is password-protected. Remove the password and upload it again." },
        { status: 422 },
      );
    }
    return Response.json(
      {
        error:
          "We couldn't read that file. If it's a scanned or photographed resume, " +
          "there's no text in it to work with — export a fresh copy from Word.",
      },
      { status: 422 },
    );
  }
}
