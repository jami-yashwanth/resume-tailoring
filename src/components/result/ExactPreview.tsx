"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { downloadBlocks } from "@/lib/tailor/download";
import { type ExactPreview as Preview, fetchExactPreview } from "@/lib/tailor/preview";
import type { RenderedLine } from "@/lib/tailor/view";

/**
 * The compiled file, page by page — pictures of the same bytes "Download
 * resume" writes, rendered by the same docsvc call.
 *
 * The working sheet next to this is a reconstruction: the same measured
 * numbers, but the browser's typesetting. This view is not — docsvc compiles
 * the LaTeX template and rasterises the result, so what it shows is the
 * download, to the pixel. That is why it re-renders through the server after
 * every decision (debounced; a warm compile is ~half a second) instead of
 * drawing anything itself.
 *
 * Undecided drafts and removed lines are left out, exactly as the download
 * leaves them out — the caption above this view says so while any wait.
 */
export function ExactPreview({ lines, who }: { lines: RenderedLine[]; who: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* True from "this content needs a compile" until its pages arrive — the
     stack dims while stale so old pages are never mistaken for the result of
     the latest decision. */
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);

  /* What the file would hold right now. Serialised so the effect re-runs only
     when the content changes, not when `lines` is a new array of the same. */
  const contentKey = useMemo(() => JSON.stringify(downloadBlocks(lines)), [lines]);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setBusy(true);
    setError(null);

    /* The first compile starts at once; later ones wait half a second so a
       burst of decisions becomes one render rather than a queue of them. */
    const delay = setTimeout(
      async () => {
        try {
          const next = await fetchExactPreview(linesRef.current, controller.signal);
          if (cancelled) return;
          setPreview(next);
          setBusy(false);
        } catch (fault) {
          if (cancelled || (fault instanceof DOMException && fault.name === "AbortError")) return;
          setError(fault instanceof Error ? fault.message : "Could not render the preview.");
          setBusy(false);
        }
      },
      preview ? 500 : 0,
    );

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(delay);
    };
    // `preview` deliberately not a dependency: it only picks the debounce, and
    // re-running on its own arrival would compile everything twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, attempt]);

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-gap bg-gap-soft p-4 font-ui text-[13px] leading-[19px]">
        <p className="m-0 font-semibold text-gap">{error}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-sheet border border-line-strong
                     bg-paper-raised px-3 font-ui text-sm font-medium text-ink transition-colors duration-150
                     hover:bg-paper-sunken"
        >
          Render the preview again
        </button>
      </div>
    );
  }

  if (!preview) {
    return (
      /* A page-shaped placeholder, so the column doesn't collapse and then
         jump when the first compile lands. */
      <div className="sheet flex aspect-[210/297] w-full items-center justify-center rounded-sheet bg-sheet shadow-sheet">
        <p className="m-0 font-ui text-sm leading-5 text-sheet-ink-muted">Compiling your PDF…</p>
      </div>
    );
  }

  return (
    <div
      aria-busy={busy}
      className={`flex flex-col gap-8 transition-opacity duration-150 ${busy ? "opacity-60" : ""}`}
    >
      {preview.images.map((image, index) => (
        /* A plain img on purpose: the source is an inline data: URI freshly
           rasterised per decision — next/image cannot optimise or cache it,
           only add a wrapper. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src={`data:image/png;base64,${image}`}
          alt={`${who} resume, exact PDF — page ${index + 1} of ${preview.pages}`}
          className="sheet w-full rounded-sheet bg-sheet shadow-sheet"
        />
      ))}
    </div>
  );
}
