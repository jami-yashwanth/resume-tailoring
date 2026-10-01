"use client";

import { Button } from "@/components/rezz/Button";
import type { Item, SkillRow } from "@/lib/tailor/document";
import type { ReviewAction } from "@/lib/tailor/review";
import { MARK_LABEL } from "@/lib/tailor/view";
import { EditableText } from "./EditableText";

/**
 * One line of the user's resume inside a section: editable, and when it
 * changed, marked with what happened and the way back. The copy and the
 * vocabulary are `MARK_LABEL`'s — the same words the page's marks use.
 */
const WAY_BACK: Partial<Record<NonNullable<Item["state"]>, string>> = {
  reworded: "Undo",
  edited: "Undo",
  added: "Undo",
  reverted: "Use the rewording",
  removed: "Keep it",
};

export function LineRow({
  item,
  label,
  focusKey,
  focused,
  disabled,
  onEdit,
  onUndo,
}: {
  item: Item | SkillRow;
  label: string;
  focusKey?: string;
  focused?: boolean;
  disabled: boolean;
  onEdit: (action: ReviewAction) => void;
  onUndo: (opId: string) => void;
}) {
  const text = "text" in item ? item.text : item.label ? `${item.label}: ${item.items}` : item.items;
  const state = item.state ?? "unchanged";
  const slot = item.blockId ?? "";
  const back = WAY_BACK[state];
  const highlighted = state === "reworded" || state === "edited" || state === "added";
  const removed = state === "removed";

  return (
    <li className={`list-none ${removed ? "opacity-60" : ""}`}>
      <EditableText
        slot={slot}
        value={text}
        original={state === "edited" ? undefined : text}
        label={label}
        focusKey={focusKey}
        focused={focused}
        disabled={disabled || removed || !slot}
        highlighted={highlighted}
        className={removed ? "line-through" : ""}
      onCommit={onEdit}
      />
      {state !== "unchanged" && back && (
        <div className="flex items-center gap-2 px-2 pb-1">
          <span className="font-mark text-[11.5px] leading-4 text-ink-muted">{MARK_LABEL[state]}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            aria-label={`${back}: ${text}`}
            onClick={() => (state === "edited" ? onEdit({ type: "undoEdit", slot }) : item.opId && onUndo(item.opId))}
          >
            {back}
          </Button>
        </div>
      )}
    </li>
  );
}
