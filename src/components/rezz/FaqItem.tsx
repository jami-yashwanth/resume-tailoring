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
      className="group border-b border-line py-4 first-of-type:border-t first-of-type:border-t-ink"
    >
      <summary
        className="flex cursor-pointer list-none justify-between gap-4 text-[18px] font-semibold leading-[27px]
                   [&::-webkit-details-marker]:hidden
                   after:font-normal after:text-ink-muted after:content-['+']
                   group-open:after:content-['–']"
      >
        {question}
      </summary>
      <div className="mt-3 max-w-[68ch] text-base leading-[26px] text-ink-muted">{children}</div>
    </details>
  );
}
