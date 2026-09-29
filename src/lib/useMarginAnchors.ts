"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Margin marks are annotations on specific lines of the resume, so they are
 * positioned from those lines rather than from fixed offsets — fixed offsets
 * drift the moment any copy above them changes length.
 *
 * Each mark carries `data-anchor="<id of the line it describes>"`. A floating
 * layer (a popover) carries `data-anchor-float` instead: it sits exactly on its
 * line and is allowed to overlap, because that is what an open popover does.
 *
 * Returns a ref for the margin container, which must be positioned.
 */
export function useMarginAnchors<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null);

  const align = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const base = container.getBoundingClientRect().top;

    const topOf = (el: HTMLElement) => {
      const id = el.dataset.anchor ?? el.dataset.anchorFloat;
      if (!id) return null;
      const target = document.getElementById(id);
      return target ? target.getBoundingClientRect().top - base : null;
    };

    for (const el of container.querySelectorAll<HTMLElement>("[data-anchor-float]")) {
      const top = topOf(el);
      if (top !== null) el.style.top = `${top}px`;
    }

    // Two annotated lines can be one line apart while a mark is two lines tall,
    // so each mark is pushed down just far enough to clear the one above it.
    let floor = Number.NEGATIVE_INFINITY;
    for (const el of container.querySelectorAll<HTMLElement>("[data-anchor]")) {
      const want = topOf(el);
      if (want === null) continue;
      const top = Math.max(want, floor);
      el.style.top = `${top}px`;
      floor = top + el.offsetHeight + 8;
    }

    /* Only now are the marks safe to take out of flow. Until this runs they
       carry no `top`, so absolute positioning would pile every one of them at
       the top of the margin — which is exactly what a visitor saw on the
       landing page when the bundle failed to hydrate. MarginColumn keeps them
       in normal flow until this flips, so the worst case is a plain stacked
       list beside the resume rather than five marks printed on top of each
       other. */
    container.dataset.aligned = "true";
  }, []);

  useEffect(() => {
    align();

    // Text metrics change when the webfont swaps in, which moves every line.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) align();
    });

    // Watching the row that holds both the sheet and the margin catches a
    // reflow of the document itself, which a window resize listener misses.
    const row = containerRef.current?.parentElement;
    const observer = row ? new ResizeObserver(align) : null;
    if (row && observer) observer.observe(row);

    /* A popover is absolutely positioned, so opening one changes no layout and
       the resize observer never fires — which left every popover stacked at the
       top of the margin instead of beside its line. Marks appearing and
       disappearing as decisions are made have the same problem, and worse: React
       does not manage the `top` we set imperatively, so a surviving mark kept a
       stale one. Watching the margin's own children catches both.
       childList only: `align` writes inline styles, and observing attributes
       here would have it retrigger itself forever. */
    const marks = containerRef.current
      ? new MutationObserver(() => align())
      : null;
    if (containerRef.current && marks) {
      marks.observe(containerRef.current, { childList: true, subtree: true });
    }

    window.addEventListener("resize", align);
    return () => {
      cancelled = true;
      observer?.disconnect();
      marks?.disconnect();
      window.removeEventListener("resize", align);
    };
  }, [align]);

  return containerRef;
}
