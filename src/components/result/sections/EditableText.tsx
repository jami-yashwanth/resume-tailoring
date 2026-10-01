"use client";

import { useEffect, useRef, useState } from "react";
import type { ReviewAction } from "@/lib/tailor/review";
import { commitEdit } from "@/lib/tailor/sections";

/**
 * One of the user's own lines or fields, retyped in place.
 *
 * Shown as text until it is clicked or activated; then a textarea with the
 * same words. Enter commits, Escape cancels, leaving commits. What gets
 * committed is decided by `commitEdit`, so a blank or an unchanged line never
 * becomes a mark, and typing the original back is an undo.
 */
export function EditableText({
  slot,
  value,
  original,
  label,
  focusKey,
  focused,
  disabled = false,
  highlighted = false,
  className = "",
  onCommit,
}: {
  slot: string;
  value: string;
  /** The text before any edit, when known. */
  original?: string;
  /** Accessible name: "Employer", "Bullet", … */
  label: string;
  /** DOM anchor the screen focuses when a line is clicked on the page. */
  focusKey?: string;
  focused?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
  className?: string;
  onCommit: (action: ReviewAction) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focused && !editing) buttonRef.current?.focus();
  }, [focused, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = areaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing]);

  const open = () => {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  };
  const close = () => {
    setEditing(false);
    // Back to the text, so keyboard focus does not fall to <body>.
    requestAnimationFrame(() => buttonRef.current?.focus());
  };
  const commit = () => {
    const action = commitEdit({ slot, current: value, next: draft, original });
    if (action) onCommit(action);
    close();
  };

  if (editing) {
    return (
      <textarea
        ref={areaRef}
        aria-label={label}
        value={draft}
        rows={1}
        onChange={(e) => {
          setDraft(e.target.value);
          e.target.style.height = "0px";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
        className={`m-0 block w-full resize-none overflow-hidden rounded-md border border-line-strong bg-paper
                    px-2 py-1 font-resume text-[15px] leading-[22px] text-ink ${className}`}
      />
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      data-focus-key={focusKey}
      aria-label={`${label}: ${value}. Edit`}
      disabled={disabled}
      onClick={open}
      className={`m-0 block w-full cursor-text rounded-md border border-transparent bg-transparent px-2 py-1 text-left
                  font-resume text-[15px] leading-[22px] text-ink transition-colors duration-150
                  hover:border-line disabled:cursor-default ${className}`}
    >
      <span className={highlighted ? "bg-highlighter text-on-highlighter" : ""}>{value}</span>
    </button>
  );
}
