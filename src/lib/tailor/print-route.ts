import type { TemplateDocument } from "./document";
import { DocsvcError } from "./docsvc";

/**
 * What `/api/download` and `/api/pages` share: reading the posted document and
 * turning a print failure into words. Server only.
 */

export const TOO_LARGE = "This resume is too large to print. Remove some content and try again.";

/**
 * The posted document, or the 400 to send back. `empty` is the route's own
 * copy for "nothing here": a body with no name, contact or sections, and one
 * whose lists are missing or not lists, which would otherwise fail deep in the
 * render as a TypeError.
 */
export async function readDocument(request: Request, empty: string): Promise<TemplateDocument | Response> {
  let body: { document?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const document = body?.document as Partial<TemplateDocument> | null | undefined;
  if (
    !document ||
    typeof document !== "object" ||
    !Array.isArray(document.contact) ||
    !Array.isArray(document.sections) ||
    (!document.name && document.contact.length === 0 && document.sections.length === 0)
  ) {
    return Response.json({ error: empty }, { status: 400 });
  }
  return document as TemplateDocument;
}

/** A print that failed, as a response a person can read. */
export function printFailure(error: unknown, fallback: string): Response {
  // docsvc refuses a page over its size cap with a 413; say what to do about it.
  if (error instanceof DocsvcError && error.status === 413) {
    return Response.json({ error: TOO_LARGE }, { status: 413 });
  }
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: 502 });
}
