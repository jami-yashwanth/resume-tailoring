"use client";

import { type ButtonHTMLAttributes, useEffect } from "react";
import type { ReviewItem } from "@/lib/tailor/review-list";

/**
 * "Why this line?" — the reason, the user's own line it came from, and the
 * job's exact words. Level two of two; the spec allows no deeper. It opens
 * inside the card or row it explains, so it can never sit beside the wrong line.
 */
export function WhyThisLine({ item, onClose }: { item: ReviewItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const added = item.op.claim === "added_by_user";

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 text-sm leading-[21px]">
      {item.reason ? <p className="m-0">{item.reason}</p> : null}
      {item.sources.length > 0 && (
        <Quotes label={`Based on your line${item.sources.length > 1 ? "s" : ""}`} items={item.sources} />
      )}
      {item.jobSays.length > 0 && <Quotes label="The job says" items={item.jobSays} />}
      <span className={`font-mark text-[11px] leading-4 ${added ? "text-gap" : "text-verified"}`}>
        {added ? "— not in your resume" : "— your own words, reworded"}
      </span>
    </div>
  );
}

function Quotes({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <span className="mb-[3px] block font-mark text-[11px] leading-4 text-ink-muted">{label}</span>
      {items.map((text, index) => (
        <q
          key={`${index}-${text.slice(0, 16)}`}
          className="mt-1 block rounded-md bg-paper-sunken px-3 py-2 text-[13px] leading-5 text-ink-muted [quotes:none]"
        >
          {text}
        </q>
      ))}
    </div>
  );
}

/** A quiet text action: underlined, never a drawn button, still 44px to tap. */
export function TextAction({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 font-ui
                 text-[13px] font-medium leading-[18px] text-ink underline underline-offset-[3px]
                 disabled:cursor-not-allowed disabled:opacity-45"
      {...rest}
    >
      {children}
    </button>
  );
}
