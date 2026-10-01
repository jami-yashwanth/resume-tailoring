"use client";

import { useState } from "react";
import type { RequirementRow } from "@/lib/tailor/requirement-rows";
import type { Coverage } from "@/lib/tailor/types";
import { SummaryPanel } from "../SummaryPanel";

/**
 * The value, in one line, before any effort: "Covers 6 of 9 · Your original
 * covered 3". The requirement rows wait behind "See requirements".
 */
export function CoverageStrip({
  coverage,
  rows,
  selected,
  onSelect,
}: {
  coverage: Coverage;
  rows: RequirementRow[];
  selected: string | null;
  onSelect: (requirementId: string, opId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="font-ui">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
        <p className="m-0 text-[15px] font-semibold leading-[22px] text-ink tabular-nums">
          Covers {coverage.covered} of {coverage.total}
        </p>
        <p className="m-0 text-[13px] leading-[19px] text-ink-muted">Your original covered {coverage.originalCovered}</p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[13px] font-semibold text-ink underline underline-offset-[3px]"
        >
          {open ? "Hide requirements" : "See requirements"}
        </button>
      </div>
      {open && <SummaryPanel rows={rows} coverage={coverage} selected={selected} onSelect={onSelect} className="mt-2" />}
    </div>
  );
}
