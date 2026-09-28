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
  let body: { file?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.file) {
    return Response.json({ error: "No file received." }, { status: 400 });
  }

  try {
    const layout = await parseResume(body.file);
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
