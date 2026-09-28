"use client";

import { ResumeSheet } from "@/components/rezz/ResumeSheet";
import type { CSSProperties } from "react";
import type { Layout, Run } from "@/lib/tailor/types";
import { type RenderedLine, groupIntoBlocks } from "@/lib/tailor/view";

/**
 * The user's document, with its changes marked.
 *
 * Drawn from the runs docsvc parsed out of the file, not from a template that
 * resembles a resume. The first version hardcoded a rule above every heading,
 * rendered headings as grey tracked capitals, and flattened every paragraph to
 * plain text — so the preview showed rules the document did not have and lost
 * the bold spans it did. The downloaded file was right and the screen was
 * wrong, which is the worst way round for a product whose promise is "your own
 * design".
 *
 * Sizes stay in the document's own proportions: one point is PX_PER_PT on
 * screen, so a 20pt name and a 10.5pt bullet keep their real relationship.
 */

/** 10.5pt body reads at 13.5px in this column; everything scales from that. */
const PX_PER_PT = 13.5 / 10.5;
const px = (pt: number) => `${(pt * PX_PER_PT).toFixed(2)}px`;

function Span({ run }: { run: Run }) {
  return (
    <span
      style={{
        fontWeight: run.bold ? 700 : undefined,
        fontStyle: run.italic ? "italic" : undefined,
        fontSize: run.size ? px(run.size) : undefined,
        color: run.color ?? undefined,
        fontVariantCaps: run.small_caps ? "small-caps" : undefined,
        textDecoration: run.underline ? "underline" : undefined,
      }}
    >
      {run.text.replace(/^\t+/, "")}
    </span>
  );
}

function Spans({ runs, text }: { runs: Run[]; text: string }) {
  if (!runs.length) return <>{text}</>;
  return (
    <>
      {runs.map((run, i) => (
        <Span key={i} run={run} />
      ))}
    </>
  );
}

/**
 * Split a line at its tab, the way Word does.
 *
 * A tab sends everything after it to a right-aligned stop at the margin —
 * that is what puts an employer on the left and its dates on the right. The
 * split has to happen at the tab *character*, not at a run boundary: in most
 * real documents the tab sits at the end of a run ("Inncircles\t"), so
 * splitting between runs leaves the two halves jammed together.
 */
function splitAtTab(runs: Run[]): { left: Run[]; right: Run[] } | null {
  const index = runs.findIndex((r) => r.text.includes("\t"));
  if (index === -1) return null;

  const run = runs[index];
  const at = run.text.indexOf("\t");
  const before = run.text.slice(0, at);
  const after = run.text.slice(at + 1);

  const left = [...runs.slice(0, index), ...(before ? [{ ...run, text: before }] : [])];
  const right = [...(after ? [{ ...run, text: after }] : []), ...runs.slice(index + 1)];

  return left.length && right.length ? { left, right } : null;
}

function Body({ line }: { line: RenderedLine }) {
  const content = <Spans runs={line.runs} text={line.text} />;

  if (line.state === "removed") {
    return <span className="text-sheet-ink-muted opacity-60">{content}</span>;
  }
  if (line.state === "reworded" || line.state === "added") {
    return <mark>{content}</mark>;
  }
  if (line.state === "pending") {
    return (
      <span className="rounded-[2px] bg-gap-soft outline outline-[1.5px] outline-offset-[3px] outline-dashed outline-gap">
        {content}
      </span>
    );
  }
  return content;
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
  return (
    <span
      id={line.key}
      onClick={interactive ? () => onSelect(line.opId!) : undefined}
      className={`${interactive ? "cursor-pointer" : ""} ${faded ? "opacity-35" : ""}
                  ${active ? "outline outline-2 outline-offset-4 outline-line-strong" : ""}
                  transition-opacity duration-150`}
    >
      <Body line={line} />
    </span>
  );
}

export function TailoredSheet({
  layout,
  lines,
  activeOpId,
  highlightBlocks,
  onSelect,
}: {
  layout: Layout;
  lines: RenderedLine[];
  activeOpId: string | null;
  /** Set by clicking a requirement: its lines stay lit, the rest dim. */
  highlightBlocks: string[] | null;
  onSelect: (opId: string) => void;
}) {
  const faded = (line: RenderedLine) =>
    highlightBlocks !== null && !highlightBlocks.includes(line.blockId);

  const render = (line: RenderedLine) => (
    <Line
      key={line.key}
      line={line}
      active={activeOpId === line.opId}
      faded={faded(line)}
      onSelect={onSelect}
    />
  );

  return (
    <ResumeSheet label={`${layout.blocks[0]?.text ?? "Your"} resume, tailored`}>
      {groupIntoBlocks(lines).map((entry) => {
        if (Array.isArray(entry)) {
          return (
            <ul
              key={entry[0].key}
              className="my-0 list-disc pl-4"
              style={{ marginTop: px(entry[0].spaceBefore), textAlign: entry[0].align }}
            >
              {entry.map((line) => (
                <li key={line.key} className="my-[5px]" style={{ fontSize: px(line.size) }}>
                  {render(line)}
                </li>
              ))}
            </ul>
          );
        }
        const style: CSSProperties = {
          marginTop: px(entry.spaceBefore),
          fontSize: px(entry.size),
          lineHeight: 1.45,
          textAlign: entry.align,
          // Some documents separate sections with space above a heading and
          // others with a rule under it. Both come from the file; neither is
          // ever invented here.
          borderBottom: entry.ruleBelow ? "1px solid currentColor" : undefined,
          paddingBottom: entry.ruleBelow ? "2px" : undefined,
        };

        const tabbed = entry.state === "unchanged" ? splitAtTab(entry.runs) : null;
        if (tabbed) {
          return (
            <p key={entry.key} className="m-0 flex justify-between gap-3" style={style}>
              <span>
                {tabbed.left.map((run, i) => (
                  <Span key={i} run={run} />
                ))}
              </span>
              <span className="shrink-0 whitespace-nowrap">
                {tabbed.right.map((run, i) => (
                  <Span key={i} run={run} />
                ))}
              </span>
            </p>
          );
        }

        return (
          <p key={entry.key} className="m-0" style={style}>
            {render(entry)}
          </p>
        );
      })}
    </ResumeSheet>
  );
}
