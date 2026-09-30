import type { TemplateDocument } from "./document";

/**
 * The page count the download will have. `/api/pages` prints through the
 * identical docsvc path as `/api/download`, so the number always matches the
 * file — only the response differs (a count instead of the bytes).
 */
export async function fetchPageCount(document: TemplateDocument, signal?: AbortSignal): Promise<number> {
  const response = await fetch("/api/pages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document }),
    signal,
  });

  if (!response.ok) {
    let message = "Could not count pages.";
    try {
      message = (await response.json()).error ?? message;
    } catch {
      /* Not JSON. The status is all we know, and the default says it. */
    }
    throw new Error(message);
  }

  const body = await response.json().catch(() => null);
  if (typeof body?.pages !== "number") throw new Error("Could not count pages.");
  return body.pages;
}
