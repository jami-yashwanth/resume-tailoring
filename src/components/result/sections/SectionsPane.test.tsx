import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TemplateDocument } from "@/lib/tailor/document";
import type { ReviewItem, ReviewList } from "@/lib/tailor/review-list";
import type { PlannedOp } from "@/lib/tailor/types";
import { SectionsPane } from "./SectionsPane";

const op = (id: string, over: Partial<PlannedOp> = {}): PlannedOp => ({
  id, op: "insert_after", block: "b1", text: "Worked with Kafka.", alternatives: [], claim: "added_by_user",
  value: 5, requirements: ["r1"], evidence: [], needsDecision: true, ...over,
});
const item = (id: string, state: ReviewItem["state"], over: Partial<ReviewItem> = {}): ReviewItem => ({
  op: op(id), state, skill: "Kafka", where: { label: "Inncircles", kind: "role" }, text: "Worked with Kafka.",
  wordingIndex: 0, wordingCount: 1, reason: null, sources: [], jobSays: ["Kafka"], ...over,
});

const doc: TemplateDocument = {
  name: "Priya Sharma",
  nameMark: { blockId: "n", state: "unchanged", key: "line-n" },
  contact: ["priya@example.com"],
  contactMarks: [{ blockId: "c", state: "unchanged", key: "line-c" }],
  sections: [
    { heading: "EXPERIENCE", kind: "experience", outlineIndex: 0, lead: [], skills: [], items: [], entries: [{
      org: "Inncircles", title: "Engineer", dates: "2023 – 2026", place: "Hyderabad",
      fields: { org: "9", title: "10", dates: "9", place: "11" },
      items: [
        { text: "Shipped X.", bullet: true, state: "unchanged", blockId: "b1", key: "line-b1" },
        { text: "Worked with Kafka.", bullet: true, state: "pending", opId: "d1", blockId: "b1", key: "line-d1" },
        { text: "My own words.", bullet: true, state: "edited", blockId: "b2", key: "line-b2" },
      ],
    }] },
    { heading: "EDUCATION", kind: "education", outlineIndex: 1, lead: [], entries: [], skills: [], items: [
      { text: "BTech", bullet: false, state: "unchanged", blockId: "e1", key: "line-e1" },
    ] },
  ],
};
const list: ReviewList = {
  toDecide: [item("d1", "pending")], current: item("d1", "pending"), position: 1, totalDecisions: 1,
  decided: [], reworded: [], removed: [], pageFit: null, status: "1 to decide · 1 page", ready: false,
};
const render = (over: Partial<Parameters<typeof SectionsPane>[0]> = {}) =>
  renderToStaticMarkup(
    <SectionsPane
      document={doc}
      list={list}
      items={new Map([["d1", item("d1", "pending")]])}
      state={{ compare: false, whyOpen: false, currentOpId: null, edits: { b2: "My own words." } }}
      coverage={{ covered: 6, total: 9, originalCovered: 3 }}
      rows={[]}
      selectedRequirement={null}
      open={{ "s-0": true, "s-1": false }}
      onToggle={() => {}}
      focusKey={null}
      sectionOrder={[0, 1]}
      pagesLabel="1 page"
      onEdit={() => {}}
      onDecide={() => {}}
      onUndo={() => {}}
      onNextWording={() => {}}
      onWhy={() => {}}
      onChoosePageFit={() => {}}
      onSelectRequirement={() => {}}
      onMoveSection={() => {}}
      {...over}
    />,
  );

describe("SectionsPane", () => {
  it("renders personal information first and sections in document order with counts", () => {
    const html = render();
    const i = (s: string) => html.indexOf(s);
    expect(i("Personal information")).toBeGreaterThan(-1);
    expect(i("Personal information")).toBeLessThan(i("EXPERIENCE"));
    expect(i("EXPERIENCE")).toBeLessThan(i("EDUCATION"));
    expect(html).toContain("1 to decide · 1 edited");
    expect(html).toContain("Covers 6 of 9");
  });

  it("renders a pending draft as a decision card where it lands", () => {
    const html = render();
    const first = html.indexOf("Shipped X.");
    const card = html.indexOf("Kafka isn&#x27;t in your resume.");
    const after = html.indexOf("My own words.");
    expect(first).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(first);
    expect(after).toBeGreaterThan(card);
    expect(html).toContain("Add it");
    expect(html).toContain("Skip");
  });

  it("renders move controls with accessible names", () => {
    const html = render();
    expect(html).toContain('aria-label="Move EXPERIENCE down"');
    expect(html).toContain('aria-label="Move EDUCATION up"');
    expect(html).toMatch(/aria-label="Move EXPERIENCE up"[^>]*disabled/);
  });

  it('marks an edited line "Edited by you"', () => {
    const html = render();
    expect(html).toContain("Edited by you");
    expect(html).toContain("Undo");
  });

  it("is read-only in compare mode", () => {
    const html = render({ state: { compare: true, whyOpen: false, currentOpId: null, edits: {} } });
    expect(html).toContain("Turn off compare to make changes.");
    expect(html).toMatch(/<fieldset[^>]*disabled/);
  });

  it("names the skill on an added line's Undo and keeps a skipped draft's Undo", () => {
    const added: TemplateDocument = { ...doc, sections: [{ ...doc.sections[0], entries: [{ ...doc.sections[0].entries[0], items: [
      { text: "Shipped X.", bullet: true, state: "unchanged", blockId: "b1", key: "line-b1" },
      { text: "Worked with Kafka.", bullet: true, state: "added", opId: "d1", blockId: "b1", key: "line-d1" },
    ] }] }, doc.sections[1]] };
    const skipped = item("d2", "skipped", { skill: "Kubernetes" });
    const html = render({
      document: added,
      list: { ...list, toDecide: [], current: null, decided: [item("d1", "added"), skipped] },
      items: new Map([["d1", item("d1", "added")], ["d2", skipped]]),
    });
    expect(html).toContain('aria-label="Undo adding Kafka line"');
    expect(html).toContain('aria-label="Undo skipping Kubernetes line"');
    expect(html).toContain("Kubernetes");
    expect(html).toContain("Skipped");
  });

  it("shows header fields read-only when a flat result has no field ids", () => {
    const flat: TemplateDocument = { ...doc, sections: [{ ...doc.sections[0], entries: [{
      org: "Razorfin", title: "Software Engineer", dates: "Aug 2024 – present", place: null, items: [],
    }] }] };
    const html = render({ document: flat });
    expect(html).toContain("Razorfin");
    expect(html).toContain("Aug 2024 – present");
    expect(html).toMatch(/aria-label="Employer: Razorfin\. Edit"[^>]*disabled/);
  });

  it("says all decided when nothing is left, with the coverage and the pages", () => {
    const html = render({
      list: { ...list, toDecide: [], current: null, decided: [item("d1", "added")] },
      pagesLabel: "1 page",
    });
    expect(html).toContain("All decided. Covers 6 of 9 · 1 page.");
  });

  it("never lets an added line be edited in place, and gives a draft card its focus key", () => {
    const added: TemplateDocument = { ...doc, sections: [{ ...doc.sections[0], entries: [{ ...doc.sections[0].entries[0], items: [
      { text: "Worked with Kafka.", bullet: true, state: "added", opId: "d1", blockId: "b1", key: "line-d1" },
      { text: "Needs OK.", bullet: true, state: "pending", opId: "d2", blockId: "b1", key: "line-d2" },
    ] }] }, doc.sections[1]] };
    const html = render({
      document: added,
      list: { ...list, toDecide: [item("d2", "pending")], current: item("d2", "pending"), decided: [item("d1", "added")] },
      items: new Map([["d1", item("d1", "added")], ["d2", item("d2", "pending")]]),
    });
    expect(html).toMatch(/aria-label="Bullet: Worked with Kafka\.\. Edit"[^>]*disabled/);
    expect(html).toMatch(/<section[^>]*data-focus-key="line-d2"/);
  });

  it("has no decorative grip", () => {
    expect(render()).not.toContain("lucide-grip-vertical");
  });
});
