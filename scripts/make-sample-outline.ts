/**
 * Give fixtures/sample-plan.json a verified outline, so the demo at /result
 * and `npm run check:result` exercise the structured editor (fields, section
 * order) rather than the flat fallback. Derived from the fixture's own blocks
 * and checked with the same `checkOutline` the pipeline uses: every value is a
 * verbatim piece of a line, every block placed once.
 *
 *   npx tsx scripts/make-sample-outline.ts
 */
import fs from "node:fs";
import path from "node:path";
import { checkOutline } from "../src/lib/tailor/outline";
import type { Entry, Layout, Outline, Section, SectionKind } from "../src/lib/tailor/types";

const file = path.join(process.cwd(), "fixtures", "sample-plan.json");
const fixture = JSON.parse(fs.readFileSync(file, "utf8")) as { layout: Layout; outline?: Outline };

const KIND: Record<string, SectionKind> = {
  SUMMARY: "summary", EXPERIENCE: "experience", SKILLS: "skills", EDUCATION: "education",
};

const outline: Outline = { name: null, contact: [], sections: [] };
let section: Section | null = null;
let entry: Entry | null = null;
for (const b of fixture.layout.blocks) {
  if (b.kind === "name") outline.name = b.id;
  else if (b.kind === "contact") outline.contact.push(b.id);
  else if (b.kind === "heading") {
    section = { heading: b.id, kind: KIND[b.text] ?? "other", entries: [], skills: [], lines: [] };
    entry = null;
    outline.sections.push(section);
  } else if (b.kind === "role" && section) {
    const [left, dates] = b.text.split("\t");
    const [org, title] = left.split(" · ");
    entry = {
      org: { block: b.id, text: org.trim() },
      title: title ? { block: b.id, text: title.trim() } : null,
      dates: dates ? { block: b.id, text: dates.trim() } : null,
      place: null,
      bullets: [],
      lines: [],
    };
    section.entries.push(entry);
  } else if (b.kind === "bullet" && entry) entry.bullets.push(b.id);
  else if (section?.kind === "skills") section.skills.push({ block: b.id, label: null, items: b.text });
  else if (section) section.lines.push(b.id);
}

const checked = checkOutline(fixture.layout, outline);
if (!checked.ok) {
  console.error("outline rejected:", checked.reason, checked.missing);
  process.exit(1);
}
fs.writeFileSync(file, `${JSON.stringify({ ...fixture, outline: checked.outline }, null, 2)}\n`);
console.log("wrote outline:", checked.outline.sections.map((s) => s.kind).join(", "));
