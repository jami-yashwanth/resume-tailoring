import type { CSSProperties, ReactNode } from "react";
import { PAGE, pct } from "@/lib/tailor/template-metrics";

/**
 * The user's document.
 *
 * The `sheet` class is not decoration — globals.css hangs the theme-proof token
 * overrides off it, so the document stays paper-white with light marks in both
 * themes. Keep the class even if the styling here changes.
 *
 * The type is `font-doc` (Georgia) rather than the product's sans, because
 * every word inside this element is the user's, not ours. In the real product
 * this face comes from their parsed file; Georgia is the sample's.
 */
/* `tight` is the hero's, where the sheet is 500px wide — a real page's ~1in
   margin costs too much of the measure there and wraps the role/date row. It
   stays a Tailwind class because it is a free choice; the page's margin is not
   one, so it is computed below instead. */
const TIGHT_PAD = "px-10 pt-9 pb-11";

/* `page` is the real template, so its margin and the page it holds open are
   the renderer's — `template-metrics.ts` holds those numbers and says why they
   live in one place.

   A percentage padding resolves against the page's own width, and `cqi` is 1%
   of that same width, so the margin stays 50pt-worth and the page stays A4 at
   whatever size the column renders them. The height is a floor rather than a
   fixed height: longer content spills past it, which is what a second page
   looks like until the preview paginates for real.

   Inline rather than Tailwind for two reasons: these are computed, and
   Tailwind only sees class strings it can read in the source; and an inline
   style beats anything a caller passes in `className`, where two competing
   padding utilities would have been resolved by Tailwind's generated order
   rather than by ours. */
const pageStyle: CSSProperties = {
  padding: pct(PAGE.margin / PAGE.width),
  minHeight: `${+((PAGE.height / PAGE.width) * 100).toFixed(4)}cqi`,
  /* A column, only so that the blocks' margins stop collapsing. The renderer
     advances its cursor by every `space()` it makes, one after another, while
     CSS collapses two adjacent margins down to the larger of them — which ate
     the 6pt under the contact line and pulled the first heading 8px up the
     page. Flex children don't collapse, so the margins add the way the
     renderer's spaces do. */
  display: "flex",
  flexDirection: "column",
};

/**
 * `name` and `contact` are the shorthand the landing page uses, where the
 * document is an illustration. The Result screen passes neither: it renders
 * every line, including those two, from the runs parsed out of the real file,
 * because there the sheet has to *be* the document rather than look like one.
 */
export function ResumeSheet({
  name,
  contact,
  label,
  children,
  pad = "page",
  className = "",
  font = "doc",
}: {
  name?: string;
  contact?: string;
  label?: string;
  children: ReactNode;
  pad?: "page" | "tight";
  className?: string;
  /**
   * "doc" (default) is the user's own font, parsed out of their file.
   * "ui" is Geist — used only by the v1 default-template render, which has
   * no original file to keep a font from (see CLAUDE.md's dated override).
   */
  font?: "doc" | "ui";
}) {
  const sheet = (
    <article
      aria-label={label ?? (name ? `${name}'s resume, tailored` : "Your resume, tailored")}
      className={`sheet rounded-sheet bg-sheet text-sheet-ink shadow-sheet
                  ${font === "ui" ? "font-ui" : "font-doc"} text-[13.5px] leading-[21px]
                  ${pad === "tight" ? TIGHT_PAD : ""} ${className}`}
      style={pad === "page" ? pageStyle : undefined}
    >
      {name ? (
        <div className="text-[21px] font-bold leading-[26px] tracking-[-0.01em]">{name}</div>
      ) : null}
      {contact ? <div className="text-[12.5px] text-ink-muted">{contact}</div> : null}
      {children}
    </article>
  );

  /* The page floor is measured against the sheet's own width, which needs a
     containment context around it. Only the `page` variant asks for one — the
     hero's illustration is sized by its own grid and would gain nothing from a
     wrapper but a wrapper. */
  return pad === "page" ? <div className="@container">{sheet}</div> : sheet;
}

export function SheetRule() {
  return <hr className="my-3 mt-4 border-0 border-t border-sheet-line" />;
}

/**
 * `as` exists for the landing page, where the sheet is an illustration rather
 * than the user's actual document. As an <h4> its "Experience" and "Skills"
 * landed in the page outline between the <h1> and the first <h2>, so anyone
 * navigating by heading heard the sample's structure as the page's structure.
 * On the Result screen the sheet IS the document and the heading is real, so
 * that stays the default.
 */
export function SheetHeading({ children, as: Tag = "h4" }: { children: ReactNode; as?: "h4" | "div" }) {
  return (
    <Tag className="mb-1.5 mt-0 text-[11px] font-bold uppercase leading-[14px] tracking-[0.1em] text-ink-muted">
      {children}
    </Tag>
  );
}

export function SheetRole({ role, dates }: { role: string; dates: string }) {
  return (
    <div className="flex justify-between gap-3 font-bold">
      <span>{role}</span>
      {/* A date range never breaks across lines — "Aug 2024 –" / "present" reads
          as a typesetting failure on a document whose whole pitch is that its
          layout survived. The role title wraps instead, which is normal. */}
      <span className="shrink-0 whitespace-nowrap">{dates}</span>
    </div>
  );
}

/** A line the user has not written — dashed in the corrector's red, never colour alone. */
export function NotYours({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[2px] bg-gap-soft outline outline-[1.5px] outline-offset-[3px] outline-dashed outline-gap">
      {children}
    </span>
  );
}
