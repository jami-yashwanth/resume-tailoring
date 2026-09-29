import { DocsvcError, type TemplateBlock, renderTemplate } from "@/lib/tailor/docsvc";

/**
 * The Result screen's exact preview: compile the user's decisions through the
 * same docsvc path as `/api/download` and hand back one PNG per page instead
 * of the file. What these pictures show is byte-for-byte what the download
 * writes — that is the whole point, so this route must never render through
 * anything else.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { blocks?: TemplateBlock[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.blocks?.length) {
    return Response.json({ error: "Nothing to preview yet." }, { status: 400 });
  }

  try {
    const rendered = await renderTemplate(body.blocks, { images: true });
    return Response.json({ pages: rendered.pages, images: rendered.images ?? [] });
  } catch (error) {
    const message =
      error instanceof DocsvcError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Could not render the preview.";
    return Response.json({ error: message }, { status: 502 });
  }
}
