import { downloadBlocks } from "./download";
import type { RenderedLine } from "./view";

/**
 * The Result screen's exact preview: the compiled file, page by page, as
 * pictures of the same bytes the download gets. `/api/preview` renders through
 * the identical docsvc path as `/api/download` — only the response differs
 * (page PNGs instead of the file itself).
 */

export type ExactPreview = { pages: number; images: string[] };

/** The response, checked — a preview that silently dropped a page would show
 *  a shorter document than the file, which is worse than showing an error. */
export function parseExactPreview(body: unknown): ExactPreview {
  const candidate = body as { pages?: unknown; images?: unknown } | null;
  const pages = candidate?.pages;
  const images = candidate?.images;
  if (
    typeof pages !== "number" ||
    !Array.isArray(images) ||
    images.length !== pages ||
    images.length === 0 ||
    !images.every((image) => typeof image === "string")
  ) {
    throw new Error("Could not render the preview.");
  }
  return { pages, images: images as string[] };
}

/** Compile the current document and hand back its pages as images. */
export async function fetchExactPreview(
  lines: RenderedLine[],
  signal?: AbortSignal,
): Promise<ExactPreview> {
  const response = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: downloadBlocks(lines) }),
    signal,
  });

  if (!response.ok) {
    let message = "Could not render the preview.";
    try {
      message = (await response.json()).error ?? message;
    } catch {
      /* Not JSON. The status is all we know, and the default says it. */
    }
    throw new Error(message);
  }

  return parseExactPreview(await response.json());
}
