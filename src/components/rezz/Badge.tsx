import type { ReactNode } from "react";

/**
 * A small pill. `radius-full` is reserved for chips in the brand book, and
 * this is the chip — everything else on the page separates with a rule.
 * Each tone reuses a token that already carries a meaning elsewhere in the
 * product; there is no tone here that doesn't.
 */
/* Radius lives on the tone, not the base: `radius-full` is reserved for chips
   and every app tone is one, but `brutal` is not. On the landing page it was
   the only round object among 22 square ones — a leftover from the old skin
   rather than a decision, so it takes the same radius as everything there. */
const TONES = {
  neutral: "rounded-full border border-line-strong bg-transparent text-ink",
  verified: "rounded-full bg-verified-soft text-verified",
  gap: "rounded-full bg-gap-soft text-gap",
  changed: "rounded-full bg-highlighter text-on-highlighter",
  /* Landing page only. Drawn in ink with a hard offset instead of tinted — it
     carries no state, so it borrows no state colour. */
  brutal: "rounded-md border-2 border-ink bg-paper-raised text-ink shadow-[4px_4px_0_0_var(--ink)]",
} as const;

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: keyof typeof TONES;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 font-ui text-[13px] font-medium leading-4
                  ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
