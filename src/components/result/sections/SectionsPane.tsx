"use client";

import { useEffect, useRef } from "react";
import type { TemplateDocument, TemplateSection } from "@/lib/tailor/document";
import type { RequirementRow } from "@/lib/tailor/requirement-rows";
import type { ReviewAction, ReviewState } from "@/lib/tailor/review";
import type { ReviewItem, ReviewList } from "@/lib/tailor/review-list";
import { countsLabel, moveTargets, sectionCounts, sectionKey, sectionName } from "@/lib/tailor/sections";
import type { Coverage } from "@/lib/tailor/types";
import { Button } from "@/components/rezz/Button";
import { DecisionCard } from "../DecisionCard";
import { PageFitCard } from "../PageFitCard";
import { CoverageStrip } from "./CoverageStrip";
import { EntryCard } from "./EntryCard";
import { LineRow } from "./LineRow";
import { SectionRow } from "./SectionRow";

/**
 * The user's resume as sections they can open, edit and reorder — the left
 * pane. It renders from the same preview document as the page on the right,
 * so what is here is exactly what is there: every decision sits where it
 * lands, and the counts on a closed row are the marks inside it.
 */
export function SectionsPane({
  document,
  list,
  items,
  state,
  coverage,
  rows,
  selectedRequirement,
  open,
  onToggle,
  focusKey,
  sectionOrder,
  pagesLabel,
  onEdit,
  onDecide,
  onUndo,
  onNextWording,
  onWhy,
  onChoosePageFit,
  onSelectRequirement,
  onMoveSection,
  className = "",
}: {
  document: TemplateDocument;
  list: ReviewList;
  /** opId → item, for every decision card and way back. */
  items: Map<string, ReviewItem>;
  state: Pick<ReviewState, "compare" | "whyOpen" | "currentOpId" | "edits">;
  coverage: Coverage;
  rows: RequirementRow[];
  selectedRequirement: string | null;
  open: Record<string, boolean>;
  onToggle: (key: string) => void;
  focusKey: string | null;
  /** The order shown now (outline indices), for the move buttons. */
  sectionOrder: number[];
  /** "1 page", "checking pages…", … for the all-decided line. */
  pagesLabel: string;
  onEdit: (action: ReviewAction) => void;
  onDecide: (opId: string, approved: boolean) => void;
  onUndo: (opId: string) => void;
  onNextWording: (opId: string) => void;
  onWhy: (opId: string) => void;
  onChoosePageFit: (optionId: string) => void;
  onSelectRequirement: (requirementId: string, opId: string | null) => void;
  onMoveSection: (index: number, to: number, order: number[]) => void;
  className?: string;
}) {
  const disabled = state.compare;
  const paneRef = useRef<HTMLDivElement>(null);
  const allDecidedRef = useRef<HTMLParagraphElement>(null);
  const currentId = list.current?.op.id ?? null;
  /** undefined until the first paint, so nothing is focused on arrival. */
  const previousCurrent = useRef<string | null | undefined>(undefined);
  const pageFitLength = list.pageFit ? `${list.pageFit.pages}-${list.pageFit.allowed}` : null;
  const answeredPageFit = useRef<string | null>(null);

  /* Where focus goes when the thing that had it disappears. The card that was
     answered unmounts, and focus on an unmounted element drops to <body>: a
     keyboard user would start again from the top. */
  const focusNext = (opId: string | null) => {
    const target = opId
      ? globalThis.document.getElementById(`decision-${opId}`)
      : (allDecidedRef.current ?? globalThis.document.getElementById("page-fit-heading"));
    target?.focus();
  };

  useEffect(() => {
    const before = previousCurrent.current;
    previousCurrent.current = currentId;
    if (before === undefined) return;
    // The last decision made: say so where the cards were.
    if (before !== null && currentId === null) focusNext(null);
    // A card came back with none open before it (an Undo from "All decided").
    if (before === null && currentId !== null) focusNext(currentId);
  }, [currentId]);

  useEffect(() => {
    const answered = answeredPageFit.current;
    if (answered === null) return;
    if (state.compare || (pageFitLength !== null && pageFitLength !== answered)) {
      answeredPageFit.current = null;
    } else if (pageFitLength === null) {
      answeredPageFit.current = null;
      focusNext(currentId);
    }
  }, [pageFitLength, currentId, state.compare]);

  const choosePageFit = (optionId: string) => {
    answeredPageFit.current = pageFitLength;
    onChoosePageFit(optionId);
  };

  // A line clicked on the page: bring its field into view.
  useEffect(() => {
    if (!focusKey || !paneRef.current) return;
    const el = paneRef.current.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusKey]);

  const movable = document.sections.filter((s) => (s.outlineIndex ?? -1) >= 0).map((s) => s.outlineIndex as number);
  const order = sectionOrder.length ? sectionOrder : movable;

  const draftOrLine = (item: TemplateSection["lead"][number], i: number, label: string) => {
    if (item.state === "pending" && item.opId && items.has(item.opId)) {
      const ri = items.get(item.opId)!;
      return (
        <li key={item.key ?? `d-${i}`} className="list-none py-1">
          <DecisionCard
            item={ri}
            compact
            whyOpen={state.whyOpen && state.currentOpId === ri.op.id}
            onDecide={onDecide}
            onNextWording={onNextWording}
            onWhy={onWhy}
          />
        </li>
      );
    }
    return (
      <LineRow
        key={item.key ?? `l-${i}`}
        item={item}
        label={label}
        skill={item.opId ? items.get(item.opId)?.skill : null}
        focusKey={item.key}
        focused={focusKey !== null && focusKey === item.key}
        disabled={disabled}
        onEdit={onEdit}
        onUndo={onUndo}
      />
    );
  };

  /* A skipped draft leaves the page (the spec forbids re-asking), but the
     decision stays undoable until download, so it is listed once, plainly. */
  const skipped = list.decided.filter((i) => i.state === "skipped");

  return (
    <div ref={paneRef} aria-label="Your resume" role="region" className={`flex flex-col gap-3 ${className}`}>
      <CoverageStrip coverage={coverage} rows={rows} selected={selectedRequirement} onSelect={onSelectRequirement} />

      {state.compare && (
        <p className="m-0 rounded-lg border border-line bg-paper-raised p-3 font-ui text-[13px] leading-[19px] text-ink-muted">
          Turn off compare to make changes.
        </p>
      )}

      <fieldset disabled={disabled} className={`m-0 flex min-w-0 flex-col gap-3 border-0 p-0 ${disabled ? "opacity-60" : ""}`}>
        {list.pageFit && (
          <PageFitCard
            key={`${pageFitLength}-${list.pageFit.options.map((o) => o.id).join(",")}`}
            pageFit={list.pageFit}
            onChoose={choosePageFit}
          />
        )}
        {list.toDecide.length === 0 && list.totalDecisions > 0 && !list.pageFit && (
          <p
            ref={allDecidedRef}
            tabIndex={-1}
            className="m-0 rounded-lg border border-line bg-paper-raised p-4 font-ui text-[15px] font-semibold leading-[22px] outline-offset-4"
          >
            All decided. Covers {coverage.covered} of {coverage.total} · {pagesLabel}.
          </p>
        )}

        <SectionRow
          id="personal"
          name="Personal information"
          counts={null}
          open={open.personal ?? false}
          onToggle={() => onToggle("personal")}
          movable={false}
          canMoveUp={false}
          canMoveDown={false}
          onMoveUp={() => {}}
          onMoveDown={() => {}}
          disabled={disabled}
        >
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {document.name !== null && (
              <LineRow
                item={{ text: document.name, bullet: false, ...(document.nameMark ?? {}) }}
                label="Name"
                focusKey={document.nameMark?.key}
                focused={focusKey !== null && focusKey === document.nameMark?.key}
                disabled={disabled}
                onEdit={onEdit}
                onUndo={onUndo}
              />
            )}
            {document.contact.map((c, i) => (
              <LineRow
                key={document.contactMarks?.[i]?.key ?? `c-${i}`}
                item={{ text: c, bullet: false, ...(document.contactMarks?.[i] ?? {}) }}
                label="Contact"
                focusKey={document.contactMarks?.[i]?.key}
                focused={focusKey !== null && focusKey === document.contactMarks?.[i]?.key}
                disabled={disabled}
                onEdit={onEdit}
                onUndo={onUndo}
              />
            ))}
          </ul>
        </SectionRow>

        {document.sections.map((s, i) => {
          const key = sectionKey(s, i);
          const name = sectionName(s);
          const idx = s.outlineIndex ?? -1;
          const targets = idx >= 0 ? moveTargets(order, idx) : { up: null, down: null };
          return (
            <SectionRow
              key={key}
              id={key}
              name={name}
              counts={countsLabel(sectionCounts(s))}
              open={open[key] ?? false}
              onToggle={() => onToggle(key)}
              movable={idx >= 0}
              canMoveUp={targets.up !== null}
              canMoveDown={targets.down !== null}
              onMoveUp={() => targets.up !== null && onMoveSection(idx, targets.up, order)}
              onMoveDown={() => targets.down !== null && onMoveSection(idx, targets.down, order)}
              disabled={disabled}
            >
              {s.lead.length > 0 && <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{s.lead.map((it, j) => draftOrLine(it, j, it.bullet ? "Bullet" : "Line"))}</ul>}
              {s.entries.map((e, j) => (
                <EntryCard
                  key={`${key}-e${j}`}
                  entry={e}
                  items={items}
                  edits={state.edits}
                  state={state}
                  focusKey={focusKey}
                  disabled={disabled}
                  onEdit={onEdit}
                  onUndo={onUndo}
                  onDecide={onDecide}
                  onNextWording={onNextWording}
                  onWhy={onWhy}
                />
              ))}
              {s.skills.length > 0 && <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{s.skills.map((row, j) => draftOrLine({ text: row.label ? `${row.label}: ${row.items}` : row.items, bullet: false, key: row.key, state: row.state, opId: row.opId, blockId: row.blockId }, j, "Skills"))}</ul>}
              {s.items.length > 0 && <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{s.items.map((it, j) => draftOrLine(it, j, it.bullet ? "Bullet" : "Line"))}</ul>}
            </SectionRow>
          );
        })}

        {skipped.length > 0 && (
          <section aria-label="Skipped" className="rounded-lg border border-line bg-paper-raised p-2 font-ui">
            <h3 className="m-0 px-2 text-[13px] font-semibold leading-[18px] text-ink-muted">Skipped</h3>
            <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
              {skipped.map((i) => (
                <li key={i.op.id} className="flex items-center gap-2 px-2 py-1 text-[13px] leading-[18px] text-ink">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{i.skill ?? "Line"}</span> · Skipped
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={disabled}
                    aria-label={`Undo skipping ${i.skill ?? "this"} line`}
                    onClick={() => onUndo(i.op.id)}
                  >
                    Undo
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </fieldset>
    </div>
  );
}
