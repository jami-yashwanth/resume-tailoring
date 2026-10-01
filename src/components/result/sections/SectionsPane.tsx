"use client";

import { useEffect, useRef } from "react";
import type { TemplateDocument, TemplateSection } from "@/lib/tailor/document";
import type { RequirementRow } from "@/lib/tailor/requirement-rows";
import type { ReviewAction, ReviewState } from "@/lib/tailor/review";
import type { ReviewItem, ReviewList } from "@/lib/tailor/review-list";
import { countsLabel, moveTargets, sectionCounts, sectionName } from "@/lib/tailor/sections";
import type { Coverage } from "@/lib/tailor/types";
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

  // A line clicked on the page: bring its field into view.
  useEffect(() => {
    if (!focusKey || !paneRef.current) return;
    const el = paneRef.current.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusKey]);

  const sectionKey = (s: TemplateSection, i: number) => `s-${s.outlineIndex ?? `p${i}`}`;
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
        focusKey={item.key}
        focused={focusKey !== null && focusKey === item.key}
        disabled={disabled}
        onEdit={onEdit}
        onUndo={onUndo}
      />
    );
  };

  return (
    <div ref={paneRef} aria-label="Your resume" role="region" className={`flex flex-col gap-3 ${className}`}>
      <CoverageStrip coverage={coverage} rows={rows} selected={selectedRequirement} onSelect={onSelectRequirement} />

      {state.compare && (
        <p className="m-0 rounded-lg border border-line bg-paper-raised p-3 font-ui text-[13px] leading-[19px] text-ink-muted">
          Turn off compare to make changes.
        </p>
      )}

      <fieldset disabled={disabled} className={`m-0 flex min-w-0 flex-col gap-3 border-0 p-0 ${disabled ? "opacity-60" : ""}`}>
        {list.pageFit && <PageFitCard key={`${list.pageFit.pages}-${list.pageFit.allowed}`} pageFit={list.pageFit} onChoose={onChoosePageFit} />}

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
      </fieldset>
    </div>
  );
}
