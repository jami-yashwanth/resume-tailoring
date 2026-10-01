"use client";

import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A section's row: name, what is waiting inside, and the controls to open it
 * or move it. Move up / Move down are buttons, always in the tab order, so
 * reordering never needs a pointer.
 */
export function SectionRow({
  id,
  name,
  counts,
  open,
  onToggle,
  movable,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  disabled,
  children,
}: {
  id: string;
  name: string;
  counts: string | null;
  open: boolean;
  onToggle: () => void;
  movable: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const panelId = `${id}-panel`;
  const moveButton = "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-ink-muted hover:border-line disabled:cursor-default disabled:opacity-35";
  return (
    <section aria-labelledby={`${id}-name`} className="rounded-lg border border-line bg-paper-raised">
      <div className="flex items-center gap-1 px-2 py-1">
        {movable ? (
          <GripVertical aria-hidden className="h-5 w-5 flex-none text-ink-muted" strokeWidth={1.5} />
        ) : (
          <span aria-hidden className="h-5 w-5 flex-none" />
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent px-1 text-left"
        >
          <span id={`${id}-name`} className="font-ui text-[15px] font-semibold leading-[22px] text-ink">
            {name}
          </span>
          {counts && <span className="font-mark text-[11.5px] leading-4 text-ink-muted">{counts}</span>}
          <ChevronDown
            aria-hidden
            className={`ml-auto h-5 w-5 flex-none text-ink-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            strokeWidth={1.5}
          />
        </button>
        {movable && (
          <div className="flex flex-none items-center">
            <button type="button" aria-label={`Move ${name} up`} disabled={disabled || !canMoveUp} onClick={onMoveUp} className={moveButton}>
              <ChevronUp aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button type="button" aria-label={`Move ${name} down`} disabled={disabled || !canMoveDown} onClick={onMoveDown} className={moveButton}>
              <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
      {open && (
        <div id={panelId} className="flex flex-col gap-2 border-t border-line p-2">
          {children}
        </div>
      )}
    </section>
  );
}
