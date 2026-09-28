import type { ReactNode } from "react";

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
      className="group border-b-2 border-ink py-3 first-of-type:border-t-2 first-of-type:border-t-ink"
    >
      {/* The marker is a bordered square rather than a bare glyph, so it reads as
          a control on a page where every other control is drawn the same way.
          `py-2` is load-bearing, not spacing: the summary IS the click target,
          and at its natural 28px it was a thin strip inside a 780px-wide row
          that looks entirely clickable. 28 + 16 clears the 44px the brand book
          requires. */}
      <summary
        className="flex cursor-pointer list-none items-start justify-between gap-4 py-2 text-lg font-semibold leading-[29px]
                   [&::-webkit-details-marker]:hidden
                   after:flex after:h-7 after:w-7 after:flex-none after:items-center after:justify-center
                   after:border-2 after:border-ink after:text-[17px] after:font-semibold after:leading-none
                   after:content-['+'] group-open:after:bg-ink group-open:after:text-paper
                   group-open:after:content-['–']"
      >
        {question}
      </summary>
      <div className="mt-3 max-w-[68ch] text-base leading-[26px] text-ink-muted">{children}</div>
    </details>
  );
}
