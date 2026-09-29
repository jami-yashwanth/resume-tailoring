"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ResumeSheet } from "@/components/rezz/ResumeSheet";
import { paginate } from "@/lib/tailor/paginate";
import { TYPE, contentHeightFor, cqi } from "@/lib/tailor/template-metrics";
import type { BlockKind, Layout } from "@/lib/tailor/types";
import { MARK_LABEL, type RenderedLine, groupIntoBlocks } from "@/lib/tailor/view";

/**
 * The one default Rezz template.
 *
 * v1 override (28 Sep 2026, see CLAUDE.md's dated override): the result
 * renders into this fixed layout instead of `TailoredSheet`, which reproduces
 * the file the user uploaded. Only `kind` and the post-edit `text` are used
 * here — the original runs/size/align/rule that `TailoredSheet` carries don't
 * apply, because there is no "original design" to keep for this render path.
 * The highlighter marks for changed text are the one thing kept identical:
 * that part of the promise ("nothing added behind your back") doesn't depend
 * on whose template the text sits in.
 */

function Body({ line }: { line: RenderedLine }) {
  const text = line.text.replace(/\t/g, "  ");
  if (line.state === "removed") {
    return <span className="text-sheet-ink-muted opacity-60">{text}</span>;
  }
  if (line.state === "reworded" || line.state === "added") {
    return <mark>{text}</mark>;
  }
  // Undone. The highlighter means "this text changed", and this text no longer
  // has: these are the user's own words, so the page shows them plainly and the
  // margin carries the fact that there is a rewording to go back to.
  if (line.state === "reverted") {
    return <>{text}</>;
  }
  if (line.state === "pending") {
    /* A 1px offset, not the 3px the hero's sheet uses: on the page the lines
       sit on the renderer's 14.7pt leading, and a dashed box drawn 3px clear
       of its own text runs into the bullets above and below it. The dashes
       and the words "Not in your resume" in the margin are what carry the
       meaning; the air around them is not. */
    return (
      <span className="rounded-[2px] bg-gap-soft outline outline-[1.5px] outline-offset-[1px] outline-dashed outline-gap">
        {text}
      </span>
    );
  }
  return <>{text}</>;
}

function Line({
  line,
  active,
  faded,
  onSelect,
}: {
  line: RenderedLine;
  active: boolean;
  faded: boolean;
  onSelect: (opId: string) => void;
}) {
  const interactive = Boolean(line.opId);
  if (!interactive) {
    return (
      <span
        id={line.key}
        className={`${faded ? "opacity-35" : ""} transition-opacity duration-150`}
      >
        <Body line={line} />
      </span>
    );
  }

  /* A changed line is a control: it opens the explanation for that change, and
     the explanation is where Undo lives. It was a click handler on a bare
     span, so the whole of level two was mouse-only — and the spec asks for
     undo to be reachable by keyboard. */
  const mark = MARK_LABEL[line.state as keyof typeof MARK_LABEL] ?? "Changed";
  return (
    <span
      id={line.key}
      role="button"
      tabIndex={0}
      aria-label={`${mark}. Why this line changed.`}
      onClick={() => onSelect(line.opId!)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(line.opId!);
      }}
      className={`cursor-pointer ${faded ? "opacity-35" : ""}
                  ${active ? "outline outline-2 outline-offset-4 outline-line-strong" : ""}
                  transition-opacity duration-150`}
    >
      <Body line={line} />
    </span>
  );
}

/**
 * The template's typography per block kind — the renderer's, not this file's.
 *
 * Every size and every gap comes from `template-metrics.ts`, which holds the
 * numbers `template_render.py` draws with, so the preview and the download are
 * one template rather than two that resemble each other. Hand-set pixels here
 * are what let the two drift: headings ended up smaller than the body text
 * they head, and bullets 29% further apart than the PDF's.
 *
 * A block's `leading` is how far the renderer's cursor advances over it, which
 * is exactly what CSS `line-height` does — so the leading is the line-height,
 * and only the renderer's `space()` calls become margins. `line.runs`/`size`/
 * `align` are still unread here: v1 has no original design to carry over.
 */
const KIND_STYLE: Record<BlockKind, CSSProperties> = {
  name: {
    fontSize: cqi(TYPE.name.size),
    lineHeight: cqi(TYPE.name.leading),
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  contact: {
    fontSize: cqi(TYPE.contact.size),
    lineHeight: cqi(TYPE.contact.leading),
    marginBottom: cqi(TYPE.contact.after),
    color: "var(--ink-muted)",
  },
  heading: {
    fontSize: cqi(TYPE.heading.size),
    lineHeight: cqi(TYPE.heading.leading),
    marginTop: cqi(TYPE.heading.before),
    marginBottom: cqi(TYPE.heading.after),
    fontWeight: 600,
    textTransform: "uppercase",
    // The one departure, and it costs no vertical space: the renderer's
    // base-14 Helvetica cannot track uppercase, and unset caps at this size
    // set too tight to scan.
    letterSpacing: "0.06em",
    /* The section rule, drawn rather than laid out. `render_template` draws
       its line without advancing the cursor, so a `border-bottom` here would
       add a pixel per heading that the file does not have. An inset shadow
       paints in the same place and costs no height. */
    boxShadow: "inset 0 -1px 0 0 var(--line)",
  },
  role: {
    fontSize: cqi(TYPE.role.size),
    lineHeight: cqi(TYPE.role.leading),
    fontWeight: 600,
  },
  bullet: { fontSize: cqi(TYPE.bullet.size), lineHeight: cqi(TYPE.bullet.leading) },
  paragraph: { fontSize: cqi(TYPE.paragraph.size), lineHeight: cqi(TYPE.paragraph.leading) },
};

/** A role's title pushed left and its dates pushed right — the same tab
 *  convention `docx_ops`/`pdf_ops` use on the way in. */
function splitRole(text: string): { left: string; right: string } | null {
  const at = text.indexOf("\t");
  if (at === -1) return null;
  const left = text.slice(0, at).trim();
  const right = text.slice(at + 1).trim();
  return left && right ? { left, right } : null;
}

/**
 * The document's blocks, for one page or for the measuring pass.
 *
 * `measuring` renders the same boxes with plain text inside them: that pass
 * wants the heights, not the marks. It deliberately leaves the ids off —
 * `useMarginAnchors` finds its lines with `document.getElementById`, so a
 * second copy of every id would send every margin mark to the hidden one. The
 * marks cost no height anyway: an outline and a background both paint outside
 * layout, so both passes measure the same.
 */
function Blocks({
  lines,
  measuring = false,
  activeOpId = null,
  highlightBlocks = null,
  onSelect,
}: {
  lines: RenderedLine[];
  measuring?: boolean;
  activeOpId?: string | null;
  highlightBlocks?: string[] | null;
  onSelect?: (opId: string) => void;
}) {
  const faded = (line: RenderedLine) =>
    highlightBlocks !== null && !highlightBlocks.includes(line.blockId);

  const leaf = (line: RenderedLine) =>
    measuring ? (
      line.text.replace(/\t/g, "  ")
    ) : (
      <Line
        line={line}
        active={activeOpId === line.opId}
        faded={faded(line)}
        onSelect={onSelect!}
      />
    );

  /* One marker per line, which `measure()` reads back in document order —
     the order `groupIntoBlocks` preserves, and so the order of `lines`. */
  const marker = measuring ? { "data-mi": "" } : {};

  return (
    <>
      {groupIntoBlocks(lines).map((entry) => {
        if (Array.isArray(entry)) {
          return (
            /* No margins anywhere in here: the renderer runs bullets straight
               off each other's leading, and the `my-[5px]` this used to carry
               was most of the 29% the preview drifted looser than the PDF. */
            <ul
              key={entry[0].key}
              className="my-0 list-disc"
              style={{ paddingLeft: cqi(TYPE.bullet.indent) }}
            >
              {entry.map((line) => (
                <li key={line.key} className="my-0" style={KIND_STYLE.bullet} {...marker}>
                  {leaf(line)}
                </li>
              ))}
            </ul>
          );
        }

        const style = KIND_STYLE[entry.kind];
        // Only split a role's date column off when nothing marks it up — a
        // reworded/added/removed role would lose its highlight if rendered
        // as two plain strings instead of through `Body`.
        const role =
          entry.kind === "role" && entry.state === "unchanged" ? splitRole(entry.text) : null;

        if (role) {
          return (
            <p
              key={entry.key}
              className="m-0 flex justify-between gap-3"
              style={style}
              {...marker}
            >
              <span>{role.left}</span>
              <span className="shrink-0 whitespace-nowrap">{role.right}</span>
            </p>
          );
        }

        return (
          <p key={entry.key} className="m-0" style={style} {...marker}>
            {leaf(entry)}
          </p>
        );
      })}
    </>
  );
}

/* The measuring pass has to land before the browser paints, or the reader
   watches one long sheet snap into pages. On the server there is nothing to
   measure and `useLayoutEffect` would only warn, so it steps aside there. */
const useMeasureEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function DefaultTemplateSheet({
  layout,
  lines,
  activeOpId,
  highlightBlocks,
  onSelect,
  onPageCount,
  onVisiblePage,
}: {
  layout: Layout;
  lines: RenderedLine[];
  activeOpId: string | null;
  /** Set by clicking a requirement: its lines stay lit, the rest dim. */
  highlightBlocks: string[] | null;
  onSelect: (opId: string) => void;
  /** How many pages the document came to, once measured. */
  onPageCount?: (count: number) => void;
  /** Which page the reader is looking at, 1-based. */
  onVisiblePage?: (page: number) => void;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][]>(() => [lines.map((_, index) => index)]);

  /**
   * Read every block's height off the hidden pass and split them into pages.
   *
   * Heights are measured rather than computed because where text wraps is the
   * browser's answer, not something worth predicting. Margins are added in by
   * hand: the page is a flex column precisely so they stop collapsing, which
   * makes them additive here the way the renderer's `space()` calls are.
   */
  const measure = useCallback(() => {
    const host = measureRef.current;
    const sheet = host?.querySelector<HTMLElement>("article.sheet");
    if (!host || !sheet) return;

    const style = getComputedStyle(sheet);
    const contentWidth =
      sheet.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (contentWidth <= 0) return;

    /* `getBoundingClientRect`, not `offsetHeight`: that one rounds to whole
       pixels, and a bullet's 19.6pt line came back as 20. Four tenths of a
       pixel is nothing until a page holds forty-five bullets, at which point
       the preview had swallowed an extra 18px and broke a block earlier than
       the renderer did. */
    const heights = [...host.querySelectorAll<HTMLElement>("[data-mi]")].map((el) => {
      const box = getComputedStyle(el);
      return (
        el.getBoundingClientRect().height +
        parseFloat(box.marginTop) +
        parseFloat(box.marginBottom)
      );
    });

    setPages(paginate(heights, contentHeightFor(contentWidth)));
  }, []);

  useMeasureEffect(() => {
    measure();
  }, [measure, lines]);

  useEffect(() => {
    const host = measureRef.current;
    if (!host) return;

    // The column's width decides where every line wraps, so a resize is a
    // repagination. The webfont landing moves every line too.
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    onPageCount?.(pages.length);
  }, [pages.length, onPageCount]);

  useEffect(() => {
    const column = columnRef.current;
    if (!column || !onVisiblePage) return;

    /* The pages scroll inside the Result screen's grid, not the window, so
       that is what the observer has to watch against. */
    const observer = new IntersectionObserver(
      (entries) => {
        const highest = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (highest) {
          onVisiblePage(Number((highest.target as HTMLElement).dataset.page) + 1);
        }
      },
      { root: column.parentElement, threshold: 0.05 },
    );

    for (const page of column.querySelectorAll("[data-page]")) observer.observe(page);
    return () => observer.disconnect();
  }, [pages, onVisiblePage]);

  /* `pages` holds indices into the `lines` of the render that was measured. A
     decision that adds or drops a line changes `lines` first and the measured
     pagination one commit later, so for that one commit the indices point past
     the end of the array — which used to throw on the way into
     `groupIntoBlocks` and take the whole screen down. Skipping a line did it
     every time. Until the measurement catches up (a layout effect, so before
     the browser paints) the document renders whole. */
  const paginated = pages.reduce((n, page) => n + page.length, 0) === lines.length;
  const sheets = paginated ? pages : [lines.map((_, index) => index)];

  const who = layout.blocks[0]?.text ?? "Your";

  return (
    <div ref={columnRef} className="relative flex flex-col gap-8">
      {/* Laid out but never painted, and taken out of flow so it costs no
          space. It is a whole page rather than a bare box so that its content
          width is the real one, margins and all, without computing it. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 -z-10"
      >
        <ResumeSheet font="ui">
          <Blocks lines={lines} measuring />
        </ResumeSheet>
      </div>

      {sheets.map((indices, page) => (
        <div key={page} data-page={page}>
          <ResumeSheet
            label={`${who} resume, tailored — page ${page + 1} of ${sheets.length}`}
            font="ui"
          >
            <Blocks
              lines={indices.map((index) => lines[index])}
              activeOpId={activeOpId}
              highlightBlocks={highlightBlocks}
              onSelect={onSelect}
            />
          </ResumeSheet>
        </div>
      ))}
    </div>
  );
}
