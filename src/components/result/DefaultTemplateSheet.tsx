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
import { filePageCount, paginate } from "@/lib/tailor/paginate";
import {
  COLOR,
  type KeyedKind,
  RULE,
  TYPE,
  contentHeightFor,
  cqi,
  gapBetween,
  resolveBulletLevels,
} from "@/lib/tailor/template-metrics";
import type { BlockKind, Layout } from "@/lib/tailor/types";
import { MARK_LABEL, type RenderedLine, groupIntoBlocks } from "@/lib/tailor/view";

/**
 * The one default Rezz template.
 *
 * v1 override (28 Sep 2026, see CLAUDE.md's dated override): the result
 * renders into this fixed layout instead of reproducing the file the user
 * uploaded (the in-place `TailoredSheet` path — deleted 29 Sep 2026, in git
 * history if the override is revisited). Only `kind` and the post-edit `text`
 * are used here — original runs/size/align/rule don't apply, because there is
 * no "original design" to keep for this render path.
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
  // A draft opens its decision card, not an explanation.
  const action = line.state === "pending" ? "Open this decision." : "Why this line changed.";
  return (
    <span
      id={line.key}
      role="button"
      tabIndex={0}
      aria-label={`${mark}. ${action}`}
      onClick={() => onSelect(line.opId!)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(line.opId!);
      }}
      className={`cursor-pointer rounded-[4px] ${faded ? "opacity-35" : ""}
                  ${active ? "outline outline-2 outline-offset-2 outline-ink" : ""}
                  transition-opacity duration-150`}
    >
      <Body line={line} />
    </span>
  );
}

/**
 * The template's typography per block kind — the compiled file's, measured.
 *
 * Every size, line-height and gap comes from `template-metrics.ts`, which
 * holds the numbers measured off the LaTeX template's compiled PDF (docsvc's
 * `test_latex_parity.py` re-measures on every run), so the preview and the
 * download are one template rather than two that resemble each other.
 *
 * The box model: a block's `leading` is its wrapped-line advance, which is
 * exactly CSS `line-height`; the space between two blocks is the measured
 * `gapBetween(prev, next)`, applied as the next block's margin-top. Nothing
 * here carries its own margins — adjacency decides them, because TeX's
 * spacing is per-pair, not per-kind. `line.runs`/`size`/`align` are still
 * unread here: v1 has no original design to carry over.
 */
const KIND_STYLE: Record<BlockKind, CSSProperties> = {
  /* The header is the reference template's centered block: a \Huge bold name
     over a centered \small contact line. Weights are 700 — the compiled file
     sets Roboto Bold, and 600 was visibly lighter next to it. */
  name: {
    fontSize: cqi(TYPE.name.size),
    lineHeight: cqi(TYPE.name.leading),
    fontWeight: 700,
    textAlign: "center",
  },
  contact: {
    fontSize: cqi(TYPE.contact.size),
    lineHeight: cqi(TYPE.contact.leading),
    textAlign: "center",
  },
  heading: {
    fontSize: cqi(TYPE.heading.size),
    lineHeight: cqi(TYPE.heading.leading),
    fontWeight: 700,
    // The reference's \scshape under this Roboto setup renders as plain
    // uppercase (measured: one span, one size), so uppercase is exact — and
    // it adds no tracking, so neither do we.
    textTransform: "uppercase",
    /* The section rule, drawn rather than laid out: the compiled \titlerule
       sits at the heading box's bottom edge without advancing the cursor, so
       a border-bottom would add height the file does not have. An inset
       shadow paints in the same place and costs none. The colour and width
       are the document's own (template.json), not theme tokens: the sheet is
       paper-white in both themes and the file draws exactly this. */
    boxShadow: `inset 0 calc(-1 * ${cqi(RULE.width)}) 0 0 ${COLOR.rule}`,
  },
  /* role and job_title are the two rows of the reference's indented
     0.97\textwidth tabular*: bold employer row with its dates flush against
     the row's right edge, italic title row under it. */
  role: {
    fontSize: cqi(TYPE.role.size),
    lineHeight: cqi(TYPE.role.leading),
    fontWeight: 700,
    marginLeft: cqi(TYPE.role.indent),
    width: cqi(TYPE.role.width),
  },
  job_title: {
    fontSize: cqi(TYPE.job_title.size),
    lineHeight: cqi(TYPE.job_title.leading),
    fontStyle: "italic",
    marginLeft: cqi(TYPE.job_title.indent),
    width: cqi(TYPE.role.width),
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

  /* One probe per line, which `measure()` reads back in document order —
     the order `groupIntoBlocks` preserves, and so the order of `lines`. */
  const probe = measuring ? { "data-mi": "" } : {};

  /* Bullet depth follows the compiled file's nesting: level two under a role,
     level one straight under a heading. Resolved over this render's lines, so
     a page that starts mid-role continues at the level its bullets ended the
     previous page on only when the role travelled with them — the same
     compromise the drawn fallback makes. */
  const keyed = resolveBulletLevels(lines.map((line) => line.kind));

  /* Every vertical space on the page is `gapBetween(prev, next)`, applied as
     margin-top on the line that follows (the li, for bullets — the probes
     carry the margins so `measure()` counts them). The first block of a
     render gets none, which is also TeX's rule at the top of a page. */
  const rendered: React.ReactNode[] = [];
  let cursor = 0;
  let prev: KeyedKind | null = null;

  for (const entry of groupIntoBlocks(lines)) {
    if (Array.isArray(entry)) {
      const level = keyed[cursor] as "bullet" | "bullet2";
      const indent = level === "bullet2" ? TYPE.bullet.indentNested : TYPE.bullet.indent;
      const first = prev;
      rendered.push(
        /* list-none with the marker as literal text: that is what the
           compiled file carries ("• " in the item, wrapped lines returning to
           the item's left edge, no hanging indent), so the preview wraps and
           measures exactly where the file does. */
        <ul
          key={entry[0].key}
          className="m-0 list-none p-0"
          style={{ marginLeft: cqi(indent) }}
        >
          {entry.map((line, i) => (
            <li
              key={line.key}
              className="mx-0 mb-0"
              style={{
                ...KIND_STYLE.bullet,
                marginTop: cqi(gapBetween(i === 0 ? first : level, level)),
              }}
              {...probe}
            >
              <span aria-hidden>{TYPE.bullet.marker}</span>
              {leaf(line)}
            </li>
          ))}
        </ul>,
      );
      cursor += entry.length;
      prev = level;
      continue;
    }

    const kind = keyed[cursor] as Exclude<KeyedKind, "bullet2">;
    const style = {
      ...KIND_STYLE[entry.kind],
      marginTop: cqi(gapBetween(prev, kind)),
    };
    cursor += 1;
    prev = kind;

    // Only split a role's date column off when nothing marks it up — a
    // reworded/added/removed role would lose its highlight if rendered
    // as two plain strings instead of through `Body`.
    const role =
      entry.kind === "role" && entry.state === "unchanged" ? splitRole(entry.text) : null;

    if (role) {
      rendered.push(
        <p
          key={entry.key}
          className="mx-0 mb-0 flex justify-between gap-3"
          style={style}
          {...probe}
        >
          <span>{role.left}</span>
          <span className="shrink-0 whitespace-nowrap">{role.right}</span>
        </p>,
      );
      continue;
    }

    rendered.push(
      <p key={entry.key} className="mx-0 mb-0" style={style} {...probe}>
        {leaf(entry)}
      </p>,
    );
  }

  return <>{rendered}</>;
}

/* The measuring pass has to land before the browser paints, or the reader
   watches one long sheet snap into pages. On the server there is nothing to
   measure and `useLayoutEffect` would only warn, so it steps aside there. */
const useMeasureEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function DefaultTemplateSheet({
  className,
  layout,
  lines,
  activeOpId,
  highlightBlocks,
  onSelect,
  onPageCount,
  onVisiblePage,
}: {
  /** Grid placement from the screen, e.g. order at narrow widths. */
  className?: string;
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
  /* What the file comes to, which is not what the screen shows: undecided
     drafts and lines chosen for removal are drawn here but left out of the
     download. This is the count the screen agrees a length with. */
  const [filePages, setFilePages] = useState(1);
  const linesRef = useRef(lines);

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

    const pageHeight = contentHeightFor(contentWidth);
    setPages(paginate(heights, pageHeight));
    // One marker per line, in document order, so heights[i] is lines[i]'s.
    const states = linesRef.current.map((line) => line.state);
    if (states.length === heights.length) setFilePages(filePageCount(heights, states, pageHeight));
  }, []);

  useMeasureEffect(() => {
    linesRef.current = lines;
    measure();
  }, [measure, lines]);

  /* The first measurement is taken before the webfont lands, and fallback
     metrics wrap differently. Reporting it let the screen lock in "1 page" for
     a resume that is 2, then ask the user about a page they never added. */
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    const host = measureRef.current;
    if (!host) return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    let cancelled = false;
    const done = () => {
      if (cancelled) return;
      measure();
      setFontsReady(true);
    };
    if (document.fonts) document.fonts.ready.then(done);
    else done();
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    if (fontsReady) onPageCount?.(filePages);
  }, [fontsReady, filePages, onPageCount]);

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
    <div ref={columnRef} className={`relative flex flex-col gap-8 ${className ?? ""}`}>
      {/* Laid out but never painted, and taken out of flow so it costs no
          space. It is a whole page rather than a bare box so that its content
          width is the real one, margins and all, without computing it. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 -z-10"
      >
        <ResumeSheet font="template">
          {/* The document's own ink (template.json), not the sheet token: the
              compiled file is pure black and the parity promise covers colour
              too. The sheet token still inks UI annotations on the page. */}
          <div style={{ color: COLOR.ink }}>
            <Blocks lines={lines} measuring />
          </div>
        </ResumeSheet>
      </div>

      {sheets.map((indices, page) => (
        <div key={page} data-page={page}>
          <ResumeSheet
            label={`${who} resume, tailored — page ${page + 1} of ${sheets.length}`}
            font="template"
          >
            <div style={{ color: COLOR.ink }}>
              <Blocks
                lines={indices.map((index) => lines[index])}
                activeOpId={activeOpId}
                highlightBlocks={highlightBlocks}
                onSelect={onSelect}
              />
            </div>
          </ResumeSheet>
        </div>
      ))}
    </div>
  );
}
