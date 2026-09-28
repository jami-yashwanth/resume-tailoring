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

    window.addEventListener("resize", align);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("resize", align);
    };
  }, [align]);

  return containerRef;
}
