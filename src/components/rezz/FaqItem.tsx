import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Built on <details> so it opens with a keyboard and is readable with the page
 * printed or JavaScript off. The native marker is replaced with a +/– because
 * the default triangle reads as a file tree rather than a question.
 */
export function FaqItem({
  question,
  children,
  defaultOpen = false,
}: {
  question: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b-2 border-edge py-3 first-of-type:border-t-2 first-of-type:border-t-edge"
    >
      {/* The marker is a bordered square rather than a bare glyph, so it reads as
          a control on a page where every other control is drawn the same way.
          `py-2` is load-bearing, not spacing: the summary IS the click target,
          and at its natural 28px it was a thin strip inside a 780px-wide row
          that looks entirely clickable. 28 + 16 clears the 44px the brand book
          requires.

          The + and – are drawn Lucide glyphs, not `after:content`. As text they
          were a plus sign and an en dash set in Geist at whatever the row
          happened to inherit: two different stroke weights, two different
          optical widths, and neither matching the 1.5px line icons used
          everywhere else in the product. The dash in particular read as a
          hyphen sitting slightly high in its box.

          The question itself underlines on hover — the whole row is the target,
          so the row has to say so. */}
      <summary
        className="flex cursor-pointer list-none items-start justify-between gap-4 py-2 text-lg font-semibold leading-[29px]
                   [&::-webkit-details-marker]:hidden"
      >
        <span className="group-hover:underline group-hover:underline-offset-4">{question}</span>
        <span
          aria-hidden
          className="flex h-7 w-7 flex-none items-center justify-center border-2 border-edge
                     transition-colors duration-150 group-open:bg-ink group-open:text-paper"
        >
          <Plus className="h-4 w-4 group-open:hidden" strokeWidth={2} />
          <Minus className="hidden h-4 w-4 group-open:block" strokeWidth={2} />
        </span>
      </summary>
      <div className="mt-3 max-w-[68ch] text-base leading-[26px] text-ink-muted">{children}</div>
    </details>
  );
}
