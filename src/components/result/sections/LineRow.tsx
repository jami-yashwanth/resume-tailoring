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

/** The way back's accessible name: the same vocabulary the old review list used. */
function undoName(state: NonNullable<Item["state"]>, text: string, skill: string | null | undefined): string {
  switch (state) {
    case "added":
      return `Undo adding ${skill ?? "this"} line`;
    case "reworded":
      return `Undo rewording: ${text}`;
    case "edited":
      return `Undo edit: ${text}`;
    case "reverted":
      return `Use the rewording again: ${text}`;
    case "removed":
      return `Keep this line: ${text}`;
    default:
      return `Undo: ${text}`;
  }
}

export function LineRow({
  item,
  label,
  skill,
  focusKey,
  focused,
  disabled,
  onEdit,
  onUndo,
}: {
  item: Item | SkillRow;
  label: string;
  /** What an added line is about ("Kafka"), for its Undo's name. */
  skill?: string | null;
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
        // An added or pending line is the draft, keyed to the line it follows:
        // retyping it here would rewrite that neighbour. Drafts change through
        // "Try another wording".
        disabled={disabled || removed || !slot || state === "added" || state === "pending"}
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
            aria-label={undoName(state, text, skill)}
            onClick={() => (state === "edited" ? onEdit({ type: "undoEdit", slot }) : item.opId && onUndo(item.opId))}
          >
            {back}
          </Button>
        </div>
      )}
    </li>
  );
}
