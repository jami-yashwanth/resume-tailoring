"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { TemplateDocument } from "@/lib/tailor/document";
import { A4, contentHeightFor } from "@/lib/tailor/page";
import { mergeHeadingHeights, paginate } from "@/lib/tailor/paginate";
import { ResumePage } from "./ResumePage";

/**
 * The resume in the right pane: the same `ResumePage` the download prints,
 * cut onto A4 sheets.
 *
 * The template is laid out once at its true size in a hidden column, each
 * `.rz-block` measured, and `paginate` decides which blocks sit on which
 * sheet. Each sheet is then `ResumePage` again with that block `range`, drawn
 * at true size and scaled to the column — a transform, so text wraps exactly
 * where it wrapped when measured. This pagination is a display guide only:
 * the page count the screen shows is the printer's (`usePrintedPages`).
 */

/** CSS pixels per point, at the 96dpi a browser assumes for absolute units. */
const PX = 96 / 72;
const PAGE_WIDTH = A4.width * PX;
const PAGE_HEIGHT = A4.height * PX;
const MARGIN = A4.margin * PX;

type Sheet = { range: [number, number]; height: number };

/* The template's face for the screen. Print embeds the same files in the HTML
   it sends to the printer (`resume-html.ts`); here the browser fetches them. */
const FONT_CSS = ["Roman", "Italic"]
  .map(
    (face) =>
      `@font-face{font-family:"Source Serif 4";font-weight:200 900;font-style:${face === "Roman" ? "normal" : "italic"};` +
      `font-display:block;src:url("/fonts/source-serif-4/SourceSerif4Variable-${face}.otf.woff2") format("woff2")}`,
  )
  .join("");

/*
 * The review marks, for the screen only — `RESUME_CSS` also prints, and a
 * printed resume carries none of this. Nothing here takes up space (a
 * background, an outline, opacity), so the marks cannot move a line break.
 * The sheet is paper-white in both themes; `.sheet` pins every token used here.
 */
const PREVIEW_CSS = `
${FONT_CSS}
/* Chromium drops a block's top margin where an unforced page break lands on it; so does the sheet. */
.rz-preview .rz-page > style + .rz-block { margin-top: 0 }
.rz-preview .rz-block { transition: opacity 150ms ease-out }
.rz-preview [data-state="reworded"] .rz-text,
.rz-preview [data-state="added"] .rz-text {
  background: var(--highlighter);
  color: var(--on-highlighter);
  border-radius: 2px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
/* A draft is not the user's line yet: dashed, in the corrector's red. Its card says "Not in your resume".
   No offset: at the template's 13.5pt leading any air around the box runs into the lines above and below. */
.rz-preview [data-state="pending"] .rz-text {
  background: var(--gap-soft);
  outline: 1.5px dashed var(--gap);
  outline-offset: 0;
  border-radius: 2px;
}
/* Chosen for removal: still on the page so it can be kept, but not in the file. */
.rz-preview [data-state="removed"] { opacity: 0.5 }
.rz-preview [data-state="removed"] .rz-text { text-decoration: line-through }
.rz-preview [data-op] { cursor: pointer; border-radius: 4px }
.rz-preview [data-op] [role="button"]:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }
@media (prefers-reduced-motion: reduce) { .rz-preview .rz-block { transition: none } }
`;

/** A value inside a quoted CSS attribute selector. */
const quoted = (value: string) => `"${value.replace(/["\\]/g, "\\$&").replace(/[\n\r\f]/g, " ")}"`;

/** The rules that follow the review: the open line outlined, the rest dimmed while a requirement is lit. */
function stateCss(scope: string, activeOpId: string | null, highlightBlocks: string[] | null): string {
  const root = `[data-rz-preview=${quoted(scope)}]`;
  let css = "";
  if (activeOpId) css += `${root} [data-op=${quoted(activeOpId)}]{outline:2px solid var(--ink);outline-offset:0}`;
  if (highlightBlocks) {
    const lit = highlightBlocks.map((id) => `:not([data-block=${quoted(id)}])`).join("");
    css += `${root} .rz-block${lit}{opacity:0.35}`;
  }
  return css;
}

const sameSheets = (a: Sheet[] | null, b: Sheet[]) =>
  a !== null &&
  a.length === b.length &&
  a.every((s, i) => s.range[0] === b[i].range[0] && s.range[1] === b[i].range[1] && s.height === b[i].height);

/* The measuring pass has to land before the browser paints, or the reader
   watches one long sheet snap into pages. */
const useMeasureEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ResumePreview({
  document,
  activeOpId,
  highlightBlocks,
  onSelect,
  onVisiblePage,
}: {
  document: TemplateDocument;
  activeOpId: string | null;
  /** Blocks lit by a requirement row; the others dim. */
  highlightBlocks: string[] | null;
  /** A marked line was clicked or pressed. */
  onSelect: (opId: string) => void;
  /** Which sheet the reader is looking at, 1-based. */
  onVisiblePage?: (page: number) => void;
}) {
  const scope = useId();
  const columnRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);

  const measure = useCallback(() => {
    const column = columnRef.current;
    const host = measureRef.current;
    const page = host?.querySelector<HTMLElement>(".rz-page");
    if (!column || !host || !page) return;

    if (column.clientWidth > 0) setScale(column.clientWidth / PAGE_WIDTH);

    const style = getComputedStyle(page);
    const contentWidth = page.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (contentWidth <= 0) return;

    /* `getBoundingClientRect`, not `offsetHeight`, which rounds to whole
       pixels — over forty-odd blocks that adds up to a line. Margins are
       added by hand; blocks carry no bottom margin, so none collapse. */
    const blocks = [...host.querySelectorAll<HTMLElement>(".rz-block")];
    const heights = blocks.map((el) => {
      const box = getComputedStyle(el);
      return el.getBoundingClientRect().height + parseFloat(box.marginTop) + parseFloat(box.marginBottom);
    });
    /* A heading is `break-after: avoid` in print: it pages with the block
       after it, as one unit, so it never strands at a sheet's foot. */
    const units = mergeHeadingHeights(heights, blocks.map((el) => el.classList.contains("rz-heading")));
    const unitEnd = (u: number) => units.starts[u + 1] ?? blocks.length;

    const next = paginate(units.heights, contentHeightFor(contentWidth)).map((indices): Sheet => {
      const start = indices.length ? units.starts[indices[0]] : 0;
      const end = indices.length ? unitEnd(indices[indices.length - 1]) : start;
      const used = indices.reduce((sum, i) => sum + units.heights[i], 0);
      // A block taller than a page runs the sheet long rather than being cut off.
      return { range: [start, end], height: Math.max(PAGE_HEIGHT, used + 2 * MARGIN) };
    });
    setSheets((previous) => (sameSheets(previous, next) ? previous : next));
  }, []);

  useMeasureEffect(() => {
    measure();
  }, [measure, document]);

  /* The first measurement can land before the template's font has, and
     fallback metrics wrap differently: measure again whenever a font arrives
     and whenever the column changes width. */
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    let cancelled = false;
    const fonts = window.document.fonts;
    fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    fonts?.addEventListener("loadingdone", measure);
    return () => {
      cancelled = true;
      observer.disconnect();
      fonts?.removeEventListener("loadingdone", measure);
    };
  }, [measure]);

  useEffect(() => {
    const column = columnRef.current;
    if (!column || !onVisiblePage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const highest = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (highest) onVisiblePage(Number((highest.target as HTMLElement).dataset.page) + 1);
      },
      { threshold: 0.05 },
    );
    for (const sheet of column.querySelectorAll("[data-page]")) observer.observe(sheet);
    return () => observer.disconnect();
  }, [sheets, onVisiblePage]);

  /** The marked block an event came from, if any. */
  const opOf = (target: EventTarget) =>
    target instanceof Element ? (target.closest<HTMLElement>("[data-page] [data-op]")?.dataset.op ?? null) : null;

  /* Until the first measurement, one sheet holds everything. On the client
     that never paints: the measuring effect runs before the browser does. */
  const shown: Sheet[] = sheets ?? [{ range: [0, Number.MAX_SAFE_INTEGER], height: PAGE_HEIGHT }];
  const who = document.name ?? "Your";

  return (
    <div
      ref={columnRef}
      data-rz-preview={scope}
      className="rz-preview relative flex min-w-0 flex-col gap-8"
      onClick={(event) => {
        const opId = opOf(event.target);
        if (opId) onSelect(opId);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const opId = opOf(event.target);
        if (!opId) return;
        event.preventDefault();
        onSelect(opId);
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS + stateCss(scope, activeOpId, highlightBlocks) }} />

      {/* Laid out at true size but never painted, and clipped so it costs no
          space. Marks off: they take no room, and a hidden copy of every
          control would be one more thing for a keyboard to land on. */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute inset-0 -z-10 overflow-hidden">
        <div style={{ width: PAGE_WIDTH }}>
          <ResumePage document={document} marks={false} />
        </div>
      </div>

      {shown.map((sheet, index) => (
        <article
          key={index}
          data-page={index}
          aria-label={`${who} resume, tailored — page ${index + 1} of ${shown.length}`}
          className="sheet overflow-hidden rounded-sheet bg-sheet shadow-sheet"
          style={{ height: sheet.height * scale }}
        >
          <div style={{ width: PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <ResumePage document={document} range={sheet.range} />
          </div>
        </article>
      ))}
    </div>
  );
}
