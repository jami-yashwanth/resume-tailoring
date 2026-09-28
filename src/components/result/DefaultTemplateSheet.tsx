"use client";

import type { CSSProperties } from "react";
import { ResumeSheet } from "@/components/rezz/ResumeSheet";
import type { BlockKind, Layout } from "@/lib/tailor/types";
import { type RenderedLine, groupIntoBlocks } from "@/lib/tailor/view";

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
  if (line.state === "pending") {
    return (
      <span className="rounded-[2px] bg-gap-soft outline outline-[1.5px] outline-offset-[3px] outline-dashed outline-gap">
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

/** The fixed template's own typography per block kind — deliberately not the
 *  document's, since v1 never reads `line.runs`/`size`/`align` here. */
const KIND_STYLE: Record<BlockKind, CSSProperties> = {
  name: { fontSize: "24px", fontWeight: 600, letterSpacing: "-0.01em" },
  contact: { fontSize: "13px", color: "var(--ink-muted)", marginTop: "4px" },
  heading: {
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "1px solid var(--line)",
    paddingBottom: "4px",
    marginTop: "22px",
  },
  role: { fontSize: "14px", fontWeight: 600, marginTop: "12px" },
  bullet: { fontSize: "13.5px", lineHeight: 1.5 },
  paragraph: { fontSize: "13.5px", lineHeight: 1.55, marginTop: "6px" },
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

export function DefaultTemplateSheet({
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
    <ResumeSheet label={`${layout.blocks[0]?.text ?? "Your"} resume, tailored`} font="ui">
      {groupIntoBlocks(lines).map((entry) => {
        if (Array.isArray(entry)) {
          return (
            <ul key={entry[0].key} className="my-0 list-disc pl-4" style={{ marginTop: "6px" }}>
              {entry.map((line) => (
                <li key={line.key} className="my-[5px]" style={KIND_STYLE.bullet}>
                  {render(line)}
                </li>
              ))}
            </ul>
          );
        }

        const style = KIND_STYLE[entry.kind];
        // Only split a role's date column off when nothing marks it up — a
        // reworded/added/removed role would lose its highlight if rendered
        // as two plain strings instead of through `Body`.
        const role = entry.kind === "role" && entry.state === "unchanged" ? splitRole(entry.text) : null;

        if (role) {
          return (
            <p key={entry.key} className="m-0 flex justify-between gap-3" style={style}>
              <span>{role.left}</span>
              <span className="shrink-0 whitespace-nowrap">{role.right}</span>
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
