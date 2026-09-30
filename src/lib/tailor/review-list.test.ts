import { describe, expect, it } from "vitest";
import { createReviewReducer, fromStored, type ReviewState } from "./review";
import { decisionAnnouncement, pageFitOptions, reviewList, undoAnnouncement, withDecisions } from "./review-list";
import type { Layout, PlannedOp, TailorPlan } from "./types";

const block = (id: string, kind: Layout["blocks"][number]["kind"], text: string) => ({
  id, kind, text, section: "EXPERIENCE", style: null, lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0,
});
const layout: Layout = {
  format: "docx", pages: 1, fonts: [], warnings: [],
  blocks: [
    block("b5", "role", "Razorfin · Software Engineer, Backend\tAug 2024 – present"),
    block("b6", "bullet", "Worked on backend APIs for payments."),
    block("b7", "bullet", "Helped refactor the refunds module."),
    block("b8", "bullet", "• Built a nightly reconciliation job."),
    block("b13", "bullet", "Wrote unit tests."),
  ],
};
const base: Omit<PlannedOp, "id" | "op" | "block"> = {
  text: "Text.", alternatives: [], claim: "reworded", value: 5, requirements: [], evidence: [], needsDecision: false,
};
const ins1: PlannedOp = {
  ...base, id: "ins1", op: "insert_after", block: "b7", claim: "added_by_user", needsDecision: true,
  requirements: ["r3"], text: "Worked with Apache Kafka for event streaming and message processing.",
  alternatives: ["Used Kafka for event streaming.", "Worked with Apache Kafka for streaming events in production."],
  reason: "Kafka is a must-have for this role.",
};
// Listed before ins1 on purpose: the list must follow the document, not the plan.
const ins2: PlannedOp = {
  ...base, id: "ins2", op: "insert_after", block: "b8", claim: "added_by_user", needsDecision: true,
  requirements: ["r6"], text: "• Built payment service as part of a microservices architecture.",
};
const reph: PlannedOp = { ...base, id: "reph", op: "rephrase", block: "b6", text: "Designed REST APIs for payments.", evidence: ["b6"] };
const rem: PlannedOp = { ...base, id: "rem", op: "remove", block: "b13", text: undefined, value: 1 };

const plan: TailorPlan = {
  company: "Kosha Payments", role: "Backend Engineer",
  requirements: [
    { id: "r3", label: "Apache Kafka", wording: "Apache Kafka in production", kind: "skill", importance: "must", knockout: false },
    { id: "r6", label: "Microservices", wording: "Microservices experience", kind: "skill", importance: "must", knockout: false },
  ],
  matches: [],
  operations: [ins2, reph, ins1, rem],
  coverage: { covered: 0, total: 2, originalCovered: 0 },
};
const state = (over: Partial<ReviewState> = {}): ReviewState => ({ ...fromStored(null), pages: 1, pagesAllowed: 1, ...over });

describe("reviewList", () => {
  it("lists what is left to decide in document order and opens the first", () => {
    const list = reviewList(plan, layout, state());
    expect(list.toDecide.map((i) => i.op.id)).toEqual(["ins1", "ins2"]);
    expect(list.current?.op.id).toBe("ins1");
    expect(list).toMatchObject({ position: 1, totalDecisions: 2, status: "2 to decide · 1 page", ready: false });
    // Before the printer has answered, the status says so and asks nothing about length.
    const unchecked = reviewList(plan, layout, state({ pages: null }));
    expect(unchecked).toMatchObject({ status: "2 to decide · checking pages…", pageFit: null });
  });

  it("opens the card the user chose", () => {
    expect(reviewList(plan, layout, state({ currentOpId: "ins2" })).current?.op.id).toBe("ins2");
  });

  it("falls back to the first pending card when the chosen one is not pending", () => {
    expect(reviewList(plan, layout, state({ currentOpId: "reph" })).current?.op.id).toBe("ins1");
  });

  it("describes a card in words that make sense on their own", () => {
    const item = reviewList(plan, layout, state()).current!;
    expect(item).toMatchObject({
      skill: "Apache Kafka", where: { label: "Razorfin", kind: "role" }, wordingIndex: 0, wordingCount: 3,
      reason: "Kafka is a must-have for this role.", jobSays: ["Apache Kafka in production"], sources: [],
    });
  });

  it("strips a typed bullet from a drafted line", () => {
    const item = reviewList(plan, layout, state()).toDecide[1];
    expect(item.text).toBe("Built payment service as part of a microservices architecture.");
  });

  it("moves answered lines to decided, added or skipped", () => {
    const list = reviewList(plan, layout, state({ decisions: { ins1: true, ins2: false } }));
    expect(list.decided.map((i) => [i.op.id, i.state])).toEqual([["ins1", "added"], ["ins2", "skipped"]]);
    expect(list).toMatchObject({ toDecide: [], current: null, status: "All decided · 1 page", ready: true });
  });

  it("counts position from the decisions already made", () => {
    expect(reviewList(plan, layout, state({ decisions: { ins1: true } })).position).toBe(2);
  });

  it("shows a rewording, and the user's own line once undone", () => {
    expect(reviewList(plan, layout, state()).reworded[0]).toMatchObject({
      state: "reworded", text: "Designed REST APIs for payments.", sources: ["Worked on backend APIs for payments."],
    });
    expect(reviewList(plan, layout, state({ decisions: { reph: false } })).reworded[0]).toMatchObject({
      state: "reverted", text: "Worked on backend APIs for payments.",
    });
  });

  it("lists a removal only once the user chose it", () => {
    expect(reviewList(plan, layout, state()).removed).toEqual([]);
    expect(reviewList(plan, layout, state({ decisions: { rem: true } })).removed[0]).toMatchObject({
      state: "removed", text: "Wrote unit tests.",
    });
  });

  it("asks nothing about length while the document fits", () => {
    expect(reviewList(plan, layout, state({ pages: 1, pagesAllowed: 1 })).pageFit).toBeNull();
  });

  it("asks about length when the document outgrows what was agreed, and is not ready", () => {
    const list = reviewList(plan, layout, state({ decisions: { ins1: true, ins2: false }, pages: 2, pagesAllowed: 1 }));
    expect(list.pageFit).toMatchObject({ causedBy: "ins1", pages: 2, allowed: 1 });
    expect(list.pageFit!.options.map((o) => o.id)).toEqual(["shorter:ins1:1", "remove:rem", "grow"]);
    expect(list.ready).toBe(false);
    expect(list.status).toBe("Choose how it fits · 2 pages");
  });

  it("keeps the count of decisions in the status while the page-fit card is also showing", () => {
    const list = reviewList(plan, layout, state({ decisions: { ins1: true }, pages: 2, pagesAllowed: 1 }));
    expect(list.pageFit).not.toBeNull();
    expect(list.status).toBe("1 to decide · 2 pages");
  });

  it("files the overflow under the Add, even when a rewording sits later in the document", () => {
    // reph2 rewords b8, which comes after ins1's line: the last changed line
    // in document order is the rewording, but the Add is what made it grow.
    const reph2: PlannedOp = { ...base, id: "reph2", op: "rephrase", block: "b8", text: "Built a nightly job.", evidence: ["b8"] };
    const later = { ...plan, operations: [ins1, reph2, rem] };
    const grown = state({ decisions: { ins1: true }, lastAdded: "ins1", pages: 2, pagesAllowed: 1 });
    const list = reviewList(later, layout, grown);
    expect(list.pageFit?.causedBy).toBe("ins1");
    expect(list.pageFit!.options[0].id).toBe("shorter:ins1:1");
  });

  it("brings back the line removed for an Add when that Add is undone, with a rewording after it", () => {
    const reph2: PlannedOp = { ...base, id: "reph2", op: "rephrase", block: "b8", text: "Built a nightly job.", evidence: ["b8"] };
    const later = { ...plan, operations: [ins1, reph2, rem] };
    const reduce = createReviewReducer(later.operations);

    let s = reduce(state({ pages: 1, pagesAllowed: 1 }), { type: "decide", opId: "ins1", approved: true });
    s = reduce(s, { type: "measuredPages", pages: 2 });
    const causedBy = reviewList(later, layout, s).pageFit!.causedBy;
    s = reduce(s, { type: "choosePageFit", optionId: "remove:rem", causedBy });
    expect(reviewList(later, layout, s).removed.map((i) => i.op.id)).toEqual(["rem"]);

    s = reduce(s, { type: "undo", opId: "ins1" });
    expect(s.decisions.rem).toBeUndefined();
    expect(reviewList(later, layout, s).removed).toEqual([]);
  });

  it("never asks about length while comparing", () => {
    expect(reviewList(plan, layout, state({ pages: 2, pagesAllowed: 1, compare: true })).pageFit).toBeNull();
  });

  it("says so when there is nothing to do at all", () => {
    const empty = { ...plan, operations: [] };
    expect(reviewList(empty, layout, state())).toMatchObject({
      status: "Your resume already covers what this job asks for.", ready: true,
    });
  });

  it("says nothing is left to decide when only rewordings were made", () => {
    const onlyReworded = { ...plan, operations: [reph] };
    expect(reviewList(onlyReworded, layout, state({ pages: 2, pagesAllowed: 2 })).status).toBe("Nothing to decide · 2 pages");
  });
});

describe("pageFitOptions", () => {
  it("offers the cheapest ways out first and always the extra page last", () => {
    const operations = withDecisions(plan.operations, { ins1: true });
    const options = pageFitOptions({ operations, layout, wordings: {}, changedOpId: "ins1", pages: 2 });
    expect(options.map((o) => o.label)).toEqual([
      "Say it more briefly", "Remove the least relevant line", "Keep everything, allow 2 pages",
    ]);
    expect(options[0].quote).toBe("Used Kafka for event streaming.");
    expect(options[1].quote).toBe("Wrote unit tests.");
  });

  it("offers only the extra page when nothing else would help", () => {
    const options = pageFitOptions({ operations: [], layout, wordings: {}, pages: 3 });
    expect(options).toEqual([{ id: "grow", label: "Keep everything, allow 3 pages", verb: "Allow 3 pages" }]);
  });
});

describe("announcements", () => {
  it("names the skill and what remains", () => {
    expect(decisionAnnouncement("Apache Kafka", true, 1)).toBe("Apache Kafka line added. 1 decision left.");
    expect(decisionAnnouncement(null, false, 0)).toBe("Line skipped. No decisions left.");
    expect(decisionAnnouncement("Kubernetes", false, 2)).toBe("Kubernetes line skipped. 2 decisions left.");
  });

  it("says what an undo did", () => {
    const list = reviewList(plan, layout, state({ decisions: { ins1: true, rem: true } }));
    expect(undoAnnouncement(list.decided[0])).toBe("Apache Kafka line is back to decide.");
    expect(undoAnnouncement(list.reworded[0])).toBe("Rewording undone. Your original line is back.");
    expect(undoAnnouncement(list.removed[0])).toBe("Line kept.");
  });
});
