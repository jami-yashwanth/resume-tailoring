"use client";

import { Check, ChevronDown, CircleAlert, Minus } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { displayStatus } from "@/lib/tailor/coverage";
import type { Coverage, Match, PlannedOp, Requirement } from "@/lib/tailor/types";

/**
 * "What this job asks for."
 *
 * A big honest number, then three groups instead of one long list: what needs
 * your OK (open — it's the only thing to decide), what's already in your
 * resume, and what we can't change (both collapsed — nothing to do there, so
 * they shouldn't compete for attention on load). No card, no score. Status is
 * an icon plus a word plus a colour, never colour alone. A knockout is not a
 * button, because there is nothing to act on.
 */

const STATUS = {
  matched: { Icon: Check, label: "In your resume", className: "text-verified" },
  added: { Icon: Check, label: "Added by you", className: "text-verified" },
  needs_ok: { Icon: CircleAlert, label: "Needs your OK", className: "text-gap" },
  cannot_change: { Icon: Minus, label: "Can't change", className: "text-ink-muted" },
} as const;

function RequirementRow({
  requirement,
  kind,
  note,
  selected,
  onSelect,
}: {
  requirement: Requirement;
  kind: keyof typeof STATUS;
  note?: string;
  selected: string | null;
  onSelect: (requirementId: string | null) => void;
}) {
  const status = STATUS[kind];
  const isSelected = selected === requirement.id;
  const fixed = requirement.knockout;

  const body = (
    <>
      <status.Icon aria-hidden className={`mt-0.5 h-5 w-5 flex-none ${status.className}`} strokeWidth={1.5} />
      <span>
        {requirement.label}
        <span className="sr-only"> — {status.label}</span>
        {note ? (
          <small className="mt-0.5 block text-[12.5px] leading-[17px] text-ink-muted">{note}</small>
        ) : null}
      </span>
    </>
  );

  if (fixed) {
    return (
      <li className="border-b border-line last:border-b-0">
        <div className="grid w-full grid-cols-[20px_minmax(0,1fr)] gap-3 px-2 py-3 text-[15px] leading-[21px] text-ink-muted">
          {body}
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => onSelect(isSelected ? null : requirement.id)}
        aria-pressed={isSelected}
        className={`grid w-full min-h-11 grid-cols-[20px_minmax(0,1fr)] gap-3 border-0 px-2 py-3
                    text-left text-[15px] leading-[21px] text-ink transition-colors duration-150
                    hover:bg-paper-raised ${isSelected ? "bg-paper-raised" : "bg-transparent"}`}
      >
        {body}
      </button>
    </li>
  );
}

function CollapsibleGroup({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 border-0 bg-transparent
                   px-2 py-1 text-left text-[13px] font-semibold leading-[18px] text-ink-muted"
      >
        {title}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 flex-none text-ink-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>
      {open ? <ul className="list-none border-t border-line p-0">{children}</ul> : null}
    </div>
  );
}

export function JobPanel({
  requirements,
  matches,
  operations,
  coverage,
  selected,
  onSelect,
}: {
  requirements: Requirement[];
  matches: Match[];
  /** Carries the user's decisions, so the list and the count agree. */
  operations: PlannedOp[];
  coverage: Coverage;
  selected: string | null;
  onSelect: (requirementId: string | null) => void;
}) {
  const [showCovered, setShowCovered] = useState(false);
  const [showFixed, setShowFixed] = useState(false);

  const withStatus = requirements.map((requirement) => {
    const match = matches.find((m) => m.requirementId === requirement.id);
    const kind = match ? displayStatus(match, operations) : "needs_ok";
    return { requirement, kind, note: kind === "needs_ok" ? match?.note : undefined };
  });

  const needsOk = withStatus.filter((r) => r.kind === "needs_ok");
  const covered = withStatus.filter((r) => r.kind === "matched" || r.kind === "added");
  const fixed = withStatus.filter((r) => r.kind === "cannot_change");

  // A requirement selected inside a still-collapsed group should stay visible.
  useEffect(() => {
    if (!selected) return;
    if (covered.some((r) => r.requirement.id === selected)) setShowCovered(true);
    if (fixed.some((r) => r.requirement.id === selected)) setShowFixed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <aside aria-label="What this job asks for" className="font-ui">
      <h2 className="m-0 text-[13px] font-semibold leading-[18px] text-ink-muted">
        This job asks for {requirements.length} things
      </h2>
      <p className="mb-1 mt-2 text-[34px] font-semibold leading-[38px] tracking-[-0.03em] tabular-nums">
        Covers {coverage.covered} of {coverage.total}
      </p>
      <p className="m-0 text-sm leading-[21px] text-ink-muted">
        Your original covered {coverage.originalCovered}.
      </p>

      {needsOk.length > 0 && (
        <div className="mt-6">
          <h3 className="m-0 px-2 text-[13px] font-semibold leading-[18px] text-ink-muted">
            Needs your OK
          </h3>
          <ul className="mt-1 list-none border-t border-line p-0">
            {needsOk.map(({ requirement, kind, note }) => (
              <RequirementRow
                key={requirement.id}
                requirement={requirement}
                kind={kind}
                note={note}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      )}

      {covered.length > 0 && (
        <CollapsibleGroup
          title={`${covered.length} already in your resume`}
          open={showCovered}
          onToggle={() => setShowCovered((v) => !v)}
        >
          {covered.map(({ requirement, kind }) => (
            <RequirementRow
              key={requirement.id}
              requirement={requirement}
              kind={kind}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </CollapsibleGroup>
      )}

      {fixed.length > 0 && (
        <CollapsibleGroup
          title={`${fixed.length} we can't change`}
          open={showFixed}
          onToggle={() => setShowFixed((v) => !v)}
        >
          {fixed.map(({ requirement, kind }) => (
            <RequirementRow
              key={requirement.id}
              requirement={requirement}
              kind={kind}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </CollapsibleGroup>
      )}

      <p className="mt-6 text-[12.5px] leading-[18px] text-ink-muted">
        Choose a requirement to find its line in your resume.
      </p>
    </aside>
  );
}
