"use client";

import { Check, Minus, PenLine } from "lucide-react";
import { Button } from "@/components/rezz/Button";
import type { ItemState, ReviewItem } from "@/lib/tailor/review-list";
import { shorten } from "@/lib/tailor/text";
import { WhyThisLine } from "./WhyThisLine";

/**
 * One decided, reworded or removed line: a single row with the way back.
 * Nothing here re-asks on its own — the row only changes when the user presses
 * its button.
 */
const COPY: Partial<
  Record<ItemState, { tag: string; Icon: typeof Check; tone: string; action: string; aria: (what: string) => string }>
> = {
  added: { tag: "Added", Icon: Check, tone: "text-verified", action: "Undo", aria: (w) => `Undo adding ${w} line` },
  skipped: { tag: "Skipped", Icon: Minus, tone: "text-ink-muted", action: "Undo", aria: (w) => `Undo skipping ${w} line` },
  reworded: { tag: "Reworded", Icon: PenLine, tone: "text-ink", action: "Undo", aria: (w) => `Undo rewording: ${w}` },
  reverted: {
    tag: "Your original", Icon: Minus, tone: "text-ink-muted", action: "Use the rewording",
    aria: (w) => `Use the rewording again: ${w}`,
  },
  removed: { tag: "Removed to fit", Icon: Minus, tone: "text-ink-muted", action: "Keep it", aria: (w) => `Keep this line: ${w}` },
};

export function ItemRow({
  item,
  open,
  onWhy,
  onUndo,
}: {
  item: ReviewItem;
  open: boolean;
  onWhy: (opId: string) => void;
  onUndo: (opId: string) => void;
}) {
  const copy = COPY[item.state];
  if (!copy) return null;

  const snippet = shorten(item.text, 48) ?? "";
  const decision = item.op.needsDecision;
  const [lead, rest] = decision ? [item.skill ?? "Line", copy.tag] : [copy.tag, snippet];

  return (
    <li className="rounded-lg border border-line bg-paper-raised">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onWhy(item.op.id)}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0
                     text-left text-[13px] leading-[18px] text-ink"
        >
          <copy.Icon aria-hidden className={`h-4 w-4 flex-none ${copy.tone}`} strokeWidth={1.5} />
          <span className="min-w-0 truncate">
            <span className="font-semibold">{lead}</span> · {rest}
          </span>
        </button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-none"
          aria-label={copy.aria(decision ? (item.skill ?? "this") : snippet)}
          onClick={() => onUndo(item.op.id)}
        >
          {copy.action}
        </Button>
      </div>
      {open && (
        <div className="px-3 pb-3">
          <WhyThisLine item={item} onClose={() => onWhy(item.op.id)} />
        </div>
      )}
    </li>
  );
}
