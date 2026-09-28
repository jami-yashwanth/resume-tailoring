"use client";

import { useMarginAnchors } from "@/lib/useMarginAnchors";

export type Mark = {
  /** id of the resume line this annotates */
  anchor: string;
  label: string;
  note: string;
  /** needs the user's decision — takes the corrector's red */
  ask?: boolean;
  /** removed to keep the page count — quieter than the rest */
  cut?: boolean;
};

/**
 * The signature element: proof marks in the margin, each joined to the line it
 * describes by a short rule. This is where the design spends its boldness, so
 * everything around it stays quiet.
 */
export function MarginColumn({ marks, label }: { marks: Mark[]; label: string }) {
  const ref = useMarginAnchors<HTMLDivElement>();

  return (
    <div ref={ref} aria-label={label} className="relative font-mark">
      {/* 2px connectors, not hairlines: on the brutalist landing the rest of the
          page is drawn in 2px ink, and a 1px rule here would make the signature
          element the quietest thing on the screen. */}
      {marks.map((m) => (
        <p
          key={m.anchor}
          data-anchor={m.anchor}
          className={`absolute left-0 right-0 m-0 flex items-start gap-2.5 text-xs font-medium leading-4
                      before:mt-[7px] before:h-[2px] before:w-[22px] before:flex-none before:content-['']
                      ${
                        m.ask
                          ? "text-gap before:bg-gap"
                          : m.cut
                            ? "text-ink-muted before:bg-ink"
                            : "text-ink before:bg-ink"
                      }`}
        >
          <span>
            <b className="font-semibold">{m.label}</b>
            <span className={`mt-[3px] block font-normal ${m.ask ? "text-gap opacity-85" : "text-ink-muted"}`}>
              {m.note}
            </span>
          </span>
        </p>
      ))}
    </div>
  );
}
