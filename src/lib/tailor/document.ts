import type { BlockKind, Entry, Outline, SectionKind } from "./types";
import { cleanText, type LineState, type RenderedLine } from "./view";

/**
 * The resume as the template renders it: the outline's structure filled with
 * the user's decided text. Field names mirror the Pydantic models in docsvc.
 *
 * An Item keeps its bullet mark (a bullet is a fact about the file) and every
 * list of items is in document order, so a "Tech: ..." line after an entry's
 * bullets stays after them.
 */
/**
 * Review marks, copied from a line's RenderedLine so the editor can anchor to
 * it and show its state. Optional: docsvc ignores them and flat-block
 * documents have none.
 */
export type Marks = {
  key?: string;
  state?: LineState;
  opId?: string;
  blockId?: string;
};
export type Item = { text: string; bullet: boolean } & Marks;
/** "Languages: Python, Go" as label + items, with its line's marks. */
export type SkillRow = { label: string | null; items: string } & Marks;
export type TemplateEntry = {
  org: string | null;
  title: string | null;
  dates: string | null;
  place: string | null;
  items: Item[];
};
export type TemplateSection = {
  heading: string | null;
  kind: SectionKind;
  /** Loose lines that come before the section's first entry or skill row. */
  lead: Item[];
  entries: TemplateEntry[];
  skills: SkillRow[];
  /** Loose lines after that, in order. */
  items: Item[];
};
export type TemplateDocument = {
  name: string | null;
  contact: string[];
  sections: TemplateSection[];
};

/**
 * "Languages: Python, Go" -> label + items. The label survives only while the
 * (possibly reworded) text still starts with it; otherwise the whole text is
 * items, so a rewording can never leave a stale label in front of new content.
 */
export function splitSkillRow(
  text: string,
  label: string | null,
): { label: string | null; items: string } {
  if (label && text.startsWith(label)) {
    const rest = text.slice(label.length).replace(/^ */, "");
    if (rest.startsWith(":")) return { label, items: rest.slice(1).trim() };
  }
  return { label: null, items: text };
}

/**
 * What a document is for. The file (the default) holds only what the user has
 * kept; the preview also shows the drafts waiting for Add it / Skip and the
 * lines chosen for removal, marked, so both can be seen and reached on the page.
 */
export type DocumentOptions = { drafts?: boolean };

/** Whether a line belongs in the document being built. */
const kept = (l: RenderedLine, drafts: boolean) => drafts || (l.state !== "removed" && l.state !== "pending");

/**
 * Resolve the outline against `lines` (built with `group = false`). A block's
 * text is every line carrying its id that is not removed or pending, in order,
 * so rewordings replace, approved inserts follow their anchor and removals drop.
 * With `drafts`, removed and pending lines stay in, carrying their marks.
 */
export function resolveDocument(
  outline: Outline,
  lines: RenderedLine[],
  { drafts = false }: DocumentOptions = {},
): TemplateDocument {
  const byBlock = new Map<string, RenderedLine[]>();
  // Where a block first appears in `lines` (document order), whatever its state.
  const position = new Map<string, number>();
  lines.forEach((l, i) => {
    if (!position.has(l.blockId)) position.set(l.blockId, i);
    if (!kept(l, drafts)) return;
    const list = byBlock.get(l.blockId);
    if (list) list.push(l);
    else byBlock.set(l.blockId, [l]);
  });
  const at = (id: string) => position.get(id) ?? Infinity;
  const byPosition = (ids: string[]) => [...ids].sort((a, b) => at(a) - at(b));
  const resolved = (id: string) => byBlock.get(id) ?? [];
  const texts = (id: string) => resolved(id).map((l) => l.text);
  const marks = (l: RenderedLine): Marks => ({ key: l.key, state: l.state, opId: l.opId, blockId: l.blockId });
  const mark = (l: RenderedLine, bullet: boolean): Item => ({ text: l.text, bullet, ...marks(l) });
  const items = (ids: string[]): Item[] =>
    byPosition(ids).flatMap((id) => resolved(id).map((l) => mark(l, l.kind === "bullet")));
  // Inserted lines are the `added` ones (and, in a preview, the `pending`
  // drafts); the rest is the block's own line.
  const isInsert = (l: RenderedLine) => l.state === "added" || l.state === "pending";
  const own = (id: string) => resolved(id).find((l) => !isInsert(l))?.text ?? null;
  const insertedLines = (id: string) => resolved(id).filter(isInsert);
  // An insert anchored to a header or heading has no slot of its own: it
  // leads what follows, as a plain line.
  const plain = (l: RenderedLine): Item => mark(l, false);
  /* An insert after the name leads the document as a line of its own, in a
     heading-less first section — not folded into the contact string, where a
     draft could be neither marked nor opened. */
  const afterName = outline.name === null ? [] : insertedLines(outline.name).map(plain);
  const leading: TemplateSection[] = afterName.length
    ? [{ heading: null, kind: "other", lead: afterName, entries: [], skills: [], items: [] }]
    : [];

  return {
    name: outline.name === null ? null : own(outline.name),
    contact: outline.contact.flatMap(texts),
    sections: [...leading, ...outline.sections.map((s) => {
      const headerBlocks = (e: Entry) =>
        // A block split across fields (org + dates) is looked up once.
        [...new Set([e.org, e.title, e.dates, e.place].flatMap((r) => (r ? [r.block] : [])))];
      const structureStart = Math.min(
        Infinity,
        ...s.entries.flatMap((e) => [...headerBlocks(e), ...e.bullets, ...e.lines]).map(at),
        ...s.skills.map((r) => at(r.block)),
      );
      const lead = s.lines.filter((id) => at(id) < structureStart);
      const rest = s.lines.filter((id) => at(id) >= structureStart);
      return {
        heading: s.heading === null ? null : own(s.heading),
        kind: s.kind,
        lead: [...(s.heading === null ? [] : insertedLines(s.heading).map(plain)), ...items(lead)],
        // Header fields come from the ref, never from a reworded line: titles and
        // dates are not rewritten by rule. Empty entries are kept, not dropped.
        entries: s.entries.map((e) => ({
          org: e.org?.text ?? null,
          title: e.title?.text ?? null,
          dates: e.dates?.text ?? null,
          place: e.place?.text ?? null,
          items: [...headerBlocks(e).flatMap(insertedLines).map(plain), ...items([...e.bullets, ...e.lines])],
        })),
        skills: s.skills.flatMap((row): SkillRow[] => {
          const [first, ...inserts] = resolved(row.block);
          return [
            ...(first === undefined ? [] : [{ ...splitSkillRow(first.text, row.label), ...marks(first) }]),
            ...inserts.map((l) => ({ label: null, items: l.text, ...marks(l) })),
          ];
        }),
        items: items(rest),
      };
    })],
  };
}

/**
 * A result with no outline has only flat blocks; give them the structure the
 * template needs. A role's text carries the employer and dates around a tab,
 * a following job_title is its title, and bullets and paragraphs attach to the
 * current entry (or, before any role, to the section). Nothing is reworded.
 */
type FlatBlock = { kind: BlockKind; text: string } & Pick<Item, "key" | "state" | "opId" | "blockId">;

/** An item's review marks, when the block carries them (a RenderedLine does). */
const marksOf = (b: FlatBlock): Omit<Item, "text" | "bullet"> =>
  b.key === undefined ? {} : { key: b.key, state: b.state, opId: b.opId, blockId: b.blockId };

export function blocksToDocument(blocks: FlatBlock[]): TemplateDocument {
  const doc: TemplateDocument = { name: null, contact: [], sections: [] };
  const newSection = (heading: string | null): TemplateSection => {
    const s: TemplateSection = { heading, kind: "other", lead: [], entries: [], skills: [], items: [] };
    doc.sections.push(s);
    return s;
  };
  let section: TemplateSection | null = null;
  let entry: TemplateEntry | null = null;
  for (const b of blocks) {
    // A line inserted after the name is a line of its own, marked, like any other.
    if (b.kind === "name" && (b.state === "added" || b.state === "pending")) {
      section ??= newSection(null);
      section.items.push({ text: b.text, bullet: false, ...marksOf(b) });
    }
    // Nothing the user wrote is dropped: a stray second name is kept as a contact line.
    else if (b.kind === "name") {
      if (doc.name === null) doc.name = b.text;
      else doc.contact.push(b.text);
    }
    else if (b.kind === "contact") doc.contact.push(cleanText("contact", b.text));
    else if (b.kind === "heading") {
      section = newSection(b.text);
      entry = null;
    } else if (b.kind === "role") {
      section ??= newSection(null);
      const tab = b.text.indexOf("\t");
      entry = {
        org: (tab < 0 ? b.text : b.text.slice(0, tab)).trim() || null,
        dates: tab < 0 ? null : b.text.slice(tab + 1).trim() || null,
        title: null, place: null, items: [],
      };
      section.entries.push(entry);
    } else if (b.kind === "job_title") {
      if (entry && entry.title === null) entry.title = b.text;
      else {
        // No entry to title, or it already has one: keep the text as a plain line.
        section ??= newSection(null);
        (entry ? entry.items : section.items).push({ text: b.text, bullet: false, ...marksOf(b) });
      }
    } else {
      section ??= newSection(null);
      const item: Item = { text: cleanText(b.kind, b.text), bullet: b.kind === "bullet", ...marksOf(b) };
      (entry ? entry.items : section.items).push(item);
    }
  }
  return doc;
}

/**
 * The document for a result with no outline: the screen's grouped lines (role
 * runs already folded), less what the file leaves out, through
 * `blocksToDocument`. Items keep their lines' marks. `cleanText` there is a
 * no-op on text `buildLines` has already cleaned.
 */
export function linesToDocument(lines: RenderedLine[], { drafts = false }: DocumentOptions = {}): TemplateDocument {
  return blocksToDocument(lines.filter((l) => kept(l, drafts)));
}
