"use client";

import { Check, ChevronDown, CircleAlert, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import type { RequirementGroup, RequirementRow } from "@/lib/tailor/requirement-rows";
import type { Coverage } from "@/lib/tailor/types";

/**
 * The gain, and what the job asked for. Every row either lights its lines in
 * the resume or says in one short line why it cannot — a button that lights
 * nothing, or a row that looks like one and is not, is what this replaced.
 *
 * Wide, it is a sticky column. Below 1240px it folds into a strip above the
 * resume with the list behind "See requirements", so nothing is hidden.
 */
const COLLAPSED: Exclude<RequirementGroup, "to_decide">[] = ["covered", "skipped", "not_offered", "cannot_change"];

const TITLE: Record<Exclude<RequirementGroup, "to_decide">, (n: number) => string> = {
  covered: (n) => `${n} in your resume`,
  skipped: (n) => `${n} you skipped`,
  not_offered: (n) => `${n} not in your resume`,
  cannot_change: (n) => `${n} we can't change`,
};

const ICON: Record<RequirementGroup, { Icon: typeof Check; tone: string; label: string }> = {
  to_decide: { Icon: CircleAlert, tone: "text-gap", label: "Needs your OK" },
  covered: { Icon: Check, tone: "text-verified", label: "In your resume" },
  skipped: { Icon: Minus, tone: "text-ink-muted", label: "Skipped" },
  not_offered: { Icon: Minus, tone: "text-ink-muted", label: "Not in your resume" },
  cannot_change: { Icon: Minus, tone: "text-ink-muted", label: "Can't change" },
};

export function SummaryPanel({
  rows,
  coverage,
  selected,
  onSelect,
  className = "",
}: {
  rows: RequirementRow[];
  coverage: Coverage;
  selected: string | null;
  onSelect: (requirementId: string, opId: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [listOpen, setListOpen] = useState(false);

  // A requirement selected inside a collapsed group should stay visible.
  useEffect(() => {
    const group = rows.find((r) => r.requirement.id === selected)?.group;
    if (group && group !== "to_decide") setOpen((o) => ({ ...o, [group]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const toDecide = rows.filter((r) => r.group === "to_decide");

  const row = (r: RequirementRow) => {
    const icon = ICON[r.group];
    const label = r.group === "covered" && r.added ? "Added by you" : icon.label;
    const body = (
      <>
        <icon.Icon aria-hidden className={`mt-0.5 h-4 w-4 flex-none ${icon.tone}`} strokeWidth={1.5} />
        <span className="min-w-0">
          {r.requirement.label}
          <span className="sr-only"> — {label}</span>
          {r.reason ? (
            <small className="mt-0.5 block text-[12.5px] leading-[17px] text-ink-muted">{r.reason}</small>
          ) : null}
        </span>
      </>
    );
    const grid = "grid w-full grid-cols-[16px_minmax(0,1fr)] gap-2.5 px-2 py-2.5 text-[14px] leading-5";
    return (
      <li key={r.requirement.id} className="border-b border-line last:border-b-0">
        {r.pointsTo ? (
          <button
            type="button"
            aria-pressed={selected === r.requirement.id}
            onClick={() => onSelect(r.requirement.id, r.opId)}
            className={`${grid} min-h-11 cursor-pointer border-0 text-left text-ink transition-colors duration-150
                        hover:bg-paper-sunken ${selected === r.requirement.id ? "bg-paper-sunken" : "bg-transparent"}`}
          >
            {body}
          </button>
        ) : (
          <div className={`${grid} text-ink-muted`}>{body}</div>
        )}
      </li>
    );
  };

  return (
    <aside aria-label="What this job asks for" className={`rounded-lg border border-line bg-paper-raised p-4 font-ui ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="m-0 text-[13px] font-semibold leading-[18px] text-ink-muted">
            This job asks for {coverage.total} thing{coverage.total === 1 ? "" : "s"}
          </h2>
          <p className="m-0 mt-1 text-[26px] font-semibold leading-[30px] tracking-[-0.03em] tabular-nums">
            Covers {coverage.covered} of {coverage.total}
          </p>
          <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
            Your original covered {coverage.originalCovered}
            {coverage.covered === coverage.originalCovered ? " too" : ""}.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={listOpen}
          onClick={() => setListOpen((v) => !v)}
          className="hidden min-h-11 cursor-pointer items-center gap-1 border-0 bg-transparent px-2 text-[13px]
                     font-semibold text-ink underline underline-offset-[3px] max-[1240px]:inline-flex"
        >
          {listOpen ? "Hide requirements" : "See requirements"}
        </button>
      </div>

      <div className={listOpen ? "" : "max-[1240px]:hidden"}>
        {toDecide.length > 0 && (
          <div className="mt-4">
            <h3 className="m-0 px-2 text-[13px] font-semibold leading-[18px] text-ink-muted">Needs your OK</h3>
            <ul className="m-0 mt-1 list-none border-t border-line p-0">{toDecide.map(row)}</ul>
          </div>
        )}
        {COLLAPSED.map((group) => {
          const items = rows.filter((r) => r.group === group);
          if (!items.length) return null;
          const isOpen = open[group] ?? false;
          return (
            <div key={group} className="mt-3">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((o) => ({ ...o, [group]: !isOpen }))}
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent
                           px-2 text-left text-[13px] font-semibold leading-[18px] text-ink-muted"
              >
                {TITLE[group](items.length)}
                <ChevronDown
                  aria-hidden
                  className={`h-4 w-4 flex-none transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                  strokeWidth={1.5}
                />
              </button>
              {isOpen && <ul className="m-0 list-none border-t border-line p-0">{items.map(row)}</ul>}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
