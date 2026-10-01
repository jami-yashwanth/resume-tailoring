"use client";

import type { TemplateEntry } from "@/lib/tailor/document";
import type { ReviewAction } from "@/lib/tailor/review";
import type { ReviewItem } from "@/lib/tailor/review-list";
import { DecisionCard } from "../DecisionCard";
import { EditableText } from "./EditableText";
import { LineRow } from "./LineRow";

/**
 * One job, degree or project: its header as labelled fields, then its lines.
 * A draft waiting for Add it / Skip sits exactly where it would join, as the
 * decision card itself, so the question and its answer are in one place.
 */
const FIELDS: { key: "org" | "title" | "dates" | "place"; label: string }[] = [
  { key: "org", label: "Employer" },
  { key: "dates", label: "Dates" },
  { key: "title", label: "Title" },
  { key: "place", label: "Location" },
];

export function EntryCard({
  entry,
  items,
  edits,
  state,
  focusKey,
  disabled,
  onEdit,
  onUndo,
  onDecide,
  onNextWording,
  onWhy,
}: {
  entry: TemplateEntry;
  items: Map<string, ReviewItem>;
  edits: Record<string, string>;
  state: { whyOpen: boolean; currentOpId: string | null };
  focusKey: string | null;
  disabled: boolean;
  onEdit: (action: ReviewAction) => void;
  onUndo: (opId: string) => void;
  onDecide: (opId: string, approved: boolean) => void;
  onNextWording: (opId: string) => void;
  onWhy: (opId: string) => void;
}) {
  const fields = FIELDS.filter((f) => entry[f.key] !== null && entry.fields?.[f.key]);
  return (
    <div className="rounded-lg border border-line bg-paper-raised p-2">
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 max-[520px]:grid-cols-1">
          {fields.map((f) => {
            const slot = `${entry.fields![f.key]}:${f.key}`;
            const edited = slot in edits;
            return (
              <div key={f.key} className={f.key === "org" || f.key === "title" ? "min-w-0" : "min-w-0"}>
                <span className="block px-2 font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {f.label}
                  {edited ? " · Edited by you" : ""}
                </span>
                <EditableText
                  slot={slot}
                  value={entry[f.key] ?? ""}
                  original={edited ? undefined : (entry[f.key] ?? "")}
                  label={f.label}
                  focusKey={slot}
                  focused={focusKey === slot}
                  disabled={disabled}
                  highlighted={edited}
                  onCommit={onEdit}
                />
                {edited && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onEdit({ type: "undoEdit", slot })}
                    className="ml-2 cursor-pointer border-0 bg-transparent p-0 font-ui text-[12.5px] text-ink underline underline-offset-[3px]"
                  >
                    Undo
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
        {entry.items.map((item, i) => {
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
              key={item.key ?? `i-${i}`}
              item={item}
              label={item.bullet ? "Bullet" : "Line"}
              focusKey={item.key}
              focused={focusKey !== null && focusKey === item.key}
              disabled={disabled}
              onEdit={onEdit}
              onUndo={onUndo}
            />
          );
        })}
      </ul>
    </div>
  );
}
