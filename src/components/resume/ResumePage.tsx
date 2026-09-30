import type { Item, TemplateDocument, TemplateEntry, TemplateSection } from "@/lib/tailor/document";
import { RESUME_CSS } from "./resumeCss";

/**
 * The one resume template. It is the live preview in the browser and, rendered
 * to a string and printed, the downloaded PDF — so it stays a plain function
 * component: no hooks, no browser APIs. Text goes in as React children only,
 * which escapes it; rendering never alters what the user wrote.
 */

type Marks = { marks: boolean };

const marksOf = (item: Item, on: boolean) =>
  on
    ? { "data-key": item.key, "data-block": item.blockId, "data-op": item.opId, "data-state": item.state }
    : {};

function ItemBlock({ item, marks }: { item: Item } & Marks) {
  return (
    <div className="rz-block rz-item" {...marksOf(item, marks)}>
      {item.text}
    </div>
  );
}

/** Runs of bullets share one <ul>; plain lines between them break the run. */
function Items({ items, marks }: { items: Item[] } & Marks) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < items.length; ) {
    if (!items[i].bullet) {
      out.push(<ItemBlock key={i} item={items[i]} marks={marks} />);
      i += 1;
      continue;
    }
    const start = i;
    while (i < items.length && items[i].bullet) i += 1;
    out.push(
      <ul key={start} className="rz-list">
        {items.slice(start, i).map((item, j) => (
          <li key={j} className="rz-block rz-item rz-bullet" {...marksOf(item, marks)}>
            {item.text}
          </li>
        ))}
      </ul>,
    );
  }
  return <>{out}</>;
}

function Entry({ entry, marks }: { entry: TemplateEntry } & Marks) {
  const hasHeader = entry.org || entry.place || entry.dates;
  return (
    <>
      {/* One block, so a title never strands at the foot of a page away from its employer. */}
      {(hasHeader || entry.title) && (
        <div className="rz-block">
          {hasHeader && (
            <div className="rz-row">
              <span className="rz-org">
                {entry.org}
                {entry.place && <span className="rz-place">{entry.org ? ", " : ""}{entry.place}</span>}
              </span>
              {entry.dates && <span className="rz-dates">{entry.dates}</span>}
            </div>
          )}
          {entry.title && <div className="rz-title">{entry.title}</div>}
        </div>
      )}
      <Items items={entry.items} marks={marks} />
    </>
  );
}

const isEmpty = (s: TemplateSection) =>
  !s.lead.length && !s.items.length && !s.skills.length &&
  s.entries.every((e) => !e.org && !e.place && !e.dates && !e.title && !e.items.length);

function Section({ section, marks }: { section: TemplateSection } & Marks) {
  if (isEmpty(section)) return null;
  return (
    <>
      {section.heading && <div className="rz-block rz-heading">{section.heading}</div>}
      <Items items={section.lead} marks={marks} />
      {section.entries.map((e, i) => (
        <Entry key={i} entry={e} marks={marks} />
      ))}
      {section.skills.map((row, i) => (
        <div key={i} className="rz-block rz-skill">
          {row.label && <b>{row.label}:</b>} {row.items}
        </div>
      ))}
      <Items items={section.items} marks={marks} />
    </>
  );
}

export function ResumePage({ document, marks = true }: { document: TemplateDocument; marks?: boolean }) {
  return (
    <div className="rz-page">
      <style dangerouslySetInnerHTML={{ __html: RESUME_CSS }} />
      {document.name && <div className="rz-block rz-name">{document.name}</div>}
      {document.contact.length > 0 && (
        <div className="rz-block rz-contact">{document.contact.join(" | ")}</div>
      )}
      {document.sections.map((s, i) => (
        <Section key={i} section={s} marks={marks} />
      ))}
    </div>
  );
}
