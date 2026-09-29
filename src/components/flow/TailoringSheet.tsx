"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ResumeSheet } from "@/components/rezz/ResumeSheet";

/**
 * The resume, drawn as the shape of a page while the pipeline works on it.
 *
 * Grey bars rather than text: the page does not have the parsed resume yet
 * (docsvc parses it on the server), and inventing lines to fill the sheet
 * would put words on the user's resume they never wrote — the exact thing the
 * product promises not to do. So the sheet shows only what is honestly known:
 * that it is being read, how many requirements the job has, how many changes
 * were drafted, and that each one was checked. The counts come from the
 * server's progress details; before they arrive, nothing is counted.
 *
 * Every transition is a 150ms opacity or colour change, staggered by delay
 * rather than by motion. Under reduced motion the stagger is dropped too, so
 * each state lands at once.
 */

type Row =
  | { kind: "name" | "meta" | "heading" | "role"; w: number }
  | { kind: "text" | "bullet"; w: number; slot?: true }
  | { kind: "rule" };

/* One page's worth of structure: name, contact, summary, two roles, skills.
   `slot` marks the six lines a margin mark can sit beside. */
const ROWS: Row[] = [
  { kind: "name", w: 42 },
  { kind: "meta", w: 64 },
  { kind: "rule" },
  { kind: "text", w: 96, slot: true },
  { kind: "text", w: 68 },
  { kind: "heading", w: 22 },
  { kind: "role", w: 60 },
  { kind: "bullet", w: 92, slot: true },
  { kind: "bullet", w: 82 },
  { kind: "bullet", w: 88, slot: true },
  { kind: "bullet", w: 70, slot: true },
  { kind: "heading", w: 26 },
  { kind: "role", w: 54 },
  { kind: "bullet", w: 90, slot: true },
  { kind: "bullet", w: 76 },
  { kind: "heading", w: 16 },
  { kind: "text", w: 94, slot: true },
  { kind: "text", w: 50 },
];

const SLOTS = ROWS.filter((r) => "slot" in r && r.slot).length;

/** Stagger through a CSS variable so `motion-reduce` can zero it; an inline
 *  `transitionDelay` would beat any class. */
const stagger = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
const fade =
  "transition-[opacity,color,background-color] duration-150 ease-out [transition-delay:var(--d,0ms)] motion-reduce:[transition-delay:0ms]";

export function TailoringSheet({
  current,
  requirements,
  drafted,
  rejected,
}: {
  /** Index of the running stage: 0 reading resume … 3 checking, 4 done. */
  current: number;
  requirements: number | null;
  drafted: number | null;
  rejected: number | null;
}) {
  // Rows start unread and darken one after another. Flipped a frame after
  // mount, because a transition needs a state to transition from.
  const [reading, setReading] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReading(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const planning = current >= 2;
  const checking = current >= 3;
  const checked = current >= 4 || (checking && rejected !== null);
  // Until the planner says how many, every slot shows "matching". After, only
  // as many as it drafted — less any the checker threw out.
  const kept = drafted === null ? SLOTS : Math.max(0, drafted - (rejected ?? 0));
  const shownSlots = Math.min(kept, SLOTS);

  let slot = -1;
  return (
    <div aria-hidden className="rounded-lg bg-paper-sunken p-8" style={APP_INK}>
      <div className="grid grid-cols-[minmax(0,1fr)_128px] gap-4">
        <ResumeSheet pad="tight" font="ui" label="Your resume">
          <div className="flex flex-col">
            {ROWS.map((row, i) => {
              const read = reading && current >= 0;
              const style = stagger(i * 70);
              if (row.kind === "rule") {
                return <hr key={i} className="my-3 border-0 border-t border-sheet-line" />;
              }
              const strong = row.kind === "name" || row.kind === "heading" || row.kind === "role";
              const bar = (
                <span
                  className={`block rounded-[2px] ${fade} ${
                    row.kind === "name" ? "h-3.5" : row.kind === "heading" ? "h-1.5" : "h-2"
                  } ${read ? (strong ? "bg-sheet-ink/80" : "bg-sheet-ink-muted/35") : "bg-sheet-line"}`}
                  style={{ ...style, width: `${row.w}%` }}
                />
              );

              const isSlot = "slot" in row && row.slot === true;
              if (isSlot) slot += 1;
              const mine = slot;
              const visible = isSlot && planning && mine < (drafted === null ? SLOTS : shownSlots);

              return (
                <div
                  key={i}
                  className={`relative flex items-center gap-2 ${
                    row.kind === "name" ? "pb-1.5" : row.kind === "heading" ? "pb-1 pt-4" : "py-[5px]"
                  }`}
                >
                  {row.kind === "bullet" ? (
                    <span
                      className={`size-1 shrink-0 rounded-full ${fade} ${read ? "bg-sheet-ink-muted/60" : "bg-sheet-line"}`}
                      style={style}
                    />
                  ) : null}
                  {bar}
                  {isSlot ? (
                    <MarginMark
                      visible={visible}
                      delay={mine * 90}
                      state={checked ? "checked" : checking ? "checking" : drafted !== null ? "drafted" : "matching"}
                    />
                  ) : null}
                  {row.kind === "name" ? (
                    <JobMark visible={current >= 1} count={requirements} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </ResumeSheet>
      </div>
    </div>
  );
}

/* The marks hang outside the paper but live inside the `.sheet` element, which
   pins --ink and friends to their light values — in dark theme that would draw
   dark marks on the dark well. A custom property inherits its resolved value,
   so declaring these on the well captures the app's own colours before the
   sheet overrides them. */
const APP_INK = {
  "--app-ink": "var(--ink)",
  "--app-ink-muted": "var(--ink-muted)",
  "--app-verified": "var(--verified)",
} as CSSProperties;

/* Marks hang in the margin to the right of the sheet: 40px of the sheet's own
   padding plus the 16px gap, the way the landing hero hangs its marks. */
const hang = "absolute left-[calc(100%+56px)] top-1/2 -translate-y-1/2 whitespace-nowrap";

const LABELS = {
  matching: { text: "matching", tone: "text-(--app-ink-muted)" },
  drafted: { text: "change drafted", tone: "text-(--app-ink)" },
  checking: { text: "checking", tone: "text-(--app-ink-muted)" },
  checked: { text: "checked", tone: "text-(--app-verified)" },
} as const;

function MarginMark({
  visible,
  delay,
  state,
}: {
  visible: boolean;
  delay: number;
  state: keyof typeof LABELS;
}) {
  // Every label is rendered, stacked in one cell, and only the current one is
  // opaque — so a change of state crossfades instead of snapping.
  return (
    <span
      className={`${hang} grid font-mark text-xs leading-4 ${fade} ${visible ? "opacity-100" : "opacity-0"}`}
      style={stagger(delay)}
    >
      {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((key) => (
        <span
          key={key}
          className={`col-start-1 row-start-1 flex items-center gap-2 ${LABELS[key].tone} ${fade} ${
            key === state ? "opacity-100" : "opacity-0"
          } before:h-px before:w-3 before:bg-current before:content-['']`}
          style={stagger(delay)}
        >
          {LABELS[key].text}
        </span>
      ))}
    </span>
  );
}

/** The job's requirements, one square each, beside the name. Shown only once
 *  the server has counted them. */
function JobMark({ visible, count }: { visible: boolean; count: number | null }) {
  const known = visible && count !== null;
  return (
    <span className={`${hang} font-mark text-xs leading-4 text-(--app-ink-muted) ${fade} ${visible ? "opacity-100" : "opacity-0"}`}>
      <span className="block">{known ? `${count} requirements` : "reading the job"}</span>
      <span className="mt-1.5 flex w-[120px] flex-wrap gap-1">
        {Array.from({ length: Math.min(count ?? 0, 16) }, (_, i) => (
          <span
            key={i}
            className={`size-2 rounded-[2px] bg-(--app-ink) ${fade} ${known ? "opacity-100" : "opacity-0"}`}
            style={stagger(i * 60)}
          />
        ))}
      </span>
    </span>
  );
}
