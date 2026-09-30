import type { Item, Marks, TemplateDocument, TemplateEntry, TemplateSection } from "@/lib/tailor/document";
import { MARK_LABEL } from "@/lib/tailor/view";
import { RESUME_CSS } from "./resumeCss";

/**
 * The one resume template. It is the live preview in the browser and, rendered
 * to a string and printed, the downloaded PDF — so it stays a plain function
 * component: no hooks, no browser APIs. Text goes in as React children only,
 * which escapes it; rendering never alters what the user wrote.
 *
 * Every unit a page may break between is one `.rz-block`, numbered in the
 * order it is emitted. `range` renders only the blocks numbered in
 * [start, end), which is how the preview puts each of its pages on its own
 * sheet from the same template. The helpers below are plain calls, not
 * components, so the numbering is one synchronous pass over the document.
 */

type Walk = {
  marks: boolean;
  /** The next block's number. */
  n: number;
  range: [number, number] | null;
};

/** Claim the next block number; whether that block is drawn in this render. */
const take = (w: Walk) => {
  const index = w.n;
  w.n += 1;
  return w.range === null || (index >= w.range[0] && index < w.range[1]);
};

/**
 * With marks on, every line says where it came from and what happened to it,
 * and a changed line is a control: it opens its decision card or the
 * explanation for that change, where Undo lives — so the preview is reachable
 * by keyboard, not only by mouse. The print render passes marks off.
 *
 * The data marks go on the block (the `<li>` or `<div>` a page breaks
 * between); the control is the text inside it, so a list item keeps its
 * list semantics rather than turning into a button.
 */
const blockMarks = (line: Marks, on: boolean) =>
  on ? { "data-key": line.key, "data-block": line.blockId, "data-op": line.opId, "data-state": line.state } : {};

const controlOf = (line: Marks, said: string, on: boolean) => {
  if (!on || !line.opId) return {};
  const mark = line.state && line.state !== "unchanged" ? MARK_LABEL[line.state] : "Changed";
  // A draft opens its decision card, not an explanation.
  const action = line.state === "pending" ? "Open this decision." : "Why this line changed.";
  return { role: "button", tabIndex: 0, "aria-label": `${mark}: ${said}. ${action}` };
};

/* The text sits in its own span so a mark can be drawn behind the words
   rather than across the whole block; it carries no style of its own. */
const text = (item: Item, on: boolean) => (
  <span className="rz-text" {...controlOf(item, item.text, on)}>
    {item.text}
  </span>
);

/** Runs of bullets share one <ul>; plain lines between them break the run. */
function items(list: Item[], w: Walk, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < list.length; ) {
    if (!list[i].bullet) {
      if (take(w)) {
        out.push(
          <div key={`${key}-${i}`} className="rz-block rz-item" {...blockMarks(list[i], w.marks)}>
            {text(list[i], w.marks)}
          </div>,
        );
      }
      i += 1;
      continue;
    }
    const start = i;
    const lis: React.ReactNode[] = [];
    for (; i < list.length && list[i].bullet; i += 1) {
      if (!take(w)) continue;
      lis.push(
        <li key={i} className="rz-block rz-item rz-bullet" {...blockMarks(list[i], w.marks)}>
          {text(list[i], w.marks)}
        </li>,
      );
    }
    // A run wholly outside the range leaves no empty list behind.
    if (lis.length) {
      out.push(
        <ul key={`${key}-${start}`} className="rz-list">
          {lis}
        </ul>,
      );
    }
  }
  return out;
}

function entry(e: TemplateEntry, w: Walk, key: string): React.ReactNode[] {
  const hasHeader = e.org || e.place || e.dates;
  const out: React.ReactNode[] = [];
  /* One block, so a title never strands at the foot of a page away from its employer. */
  if ((hasHeader || e.title) && take(w)) {
    out.push(
      <div key={`${key}-h`} className="rz-block">
        {hasHeader && (
          <div className="rz-row">
            <span className="rz-org">
              {e.org}
              {e.place && <span className="rz-place">{e.org ? ", " : ""}{e.place}</span>}
            </span>
            {e.dates && <span className="rz-dates">{e.dates}</span>}
          </div>
        )}
        {e.title && <div className="rz-title">{e.title}</div>}
      </div>,
    );
  }
  out.push(...items(e.items, w, `${key}-i`));
  return out;
}

const isEmpty = (s: TemplateSection) =>
  !s.lead.length && !s.items.length && !s.skills.length &&
  s.entries.every((e) => !e.org && !e.place && !e.dates && !e.title && !e.items.length);

function section(s: TemplateSection, w: Walk, key: string): React.ReactNode[] {
  if (isEmpty(s)) return [];
  const out: React.ReactNode[] = [];
  if (s.heading && take(w)) {
    out.push(
      <div key={`${key}-h`} className="rz-block rz-heading">
        {s.heading}
      </div>,
    );
  }
  out.push(...items(s.lead, w, `${key}-l`));
  s.entries.forEach((e, i) => out.push(...entry(e, w, `${key}-e${i}`)));
  s.skills.forEach((row, i) => {
    if (!take(w)) return;
    out.push(
      <div key={`${key}-s${i}`} className="rz-block rz-skill" {...blockMarks(row, w.marks)}>
        <span className="rz-text" {...controlOf(row, row.label ? `${row.label}: ${row.items}` : row.items, w.marks)}>
          {row.label && <b>{row.label}:</b>} {row.items}
        </span>
      </div>,
    );
  });
  out.push(...items(s.items, w, `${key}-t`));
  return out;
}

export function ResumePage({
  document,
  marks = true,
  range = null,
}: {
  document: TemplateDocument;
  marks?: boolean;
  /** Only the blocks numbered in [start, end); every block when null. */
  range?: [number, number] | null;
}) {
  const w: Walk = { marks, n: 0, range };
  const out: React.ReactNode[] = [];
  if (document.name && take(w)) {
    out.push(
      <div key="name" className="rz-block rz-name">
        {document.name}
      </div>,
    );
  }
  if (document.contact.length > 0 && take(w)) {
    out.push(
      <div key="contact" className="rz-block rz-contact">
        {document.contact.join(" | ")}
      </div>,
    );
  }
  document.sections.forEach((s, i) => out.push(...section(s, w, `s${i}`)));
  return (
    <div className="rz-page">
      <style dangerouslySetInnerHTML={{ __html: RESUME_CSS }} />
      {out}
    </div>
  );
}
