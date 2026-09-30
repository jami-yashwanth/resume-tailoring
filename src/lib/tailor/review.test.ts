import { describe, expect, it } from "vitest";
import { type ReviewState, createReviewReducer, fromStored, toStored } from "./review";
import type { PlannedOp } from "./types";

const base: Omit<PlannedOp, "id" | "op" | "block"> = {
  text: "Text.", alternatives: [], claim: "reworded", value: 5, requirements: [], evidence: [], needsDecision: false,
};
const ops: PlannedOp[] = [
  { ...base, id: "ins1", op: "insert_after", block: "b7", claim: "added_by_user", needsDecision: true, requirements: ["r3"] },
  { ...base, id: "ins2", op: "insert_after", block: "b8", claim: "added_by_user", needsDecision: true, requirements: ["r6"] },
  { ...base, id: "reph", op: "rephrase", block: "b6", evidence: ["b6"] },
  { ...base, id: "rem", op: "remove", block: "b13", text: undefined, value: 1 },
  { ...base, id: "rem2", op: "remove", block: "b14", text: undefined, value: 2 },
];
const reduce = createReviewReducer(ops);
const start = (over: Partial<ReviewState> = {}): ReviewState => ({ ...fromStored(null), ...over });

describe("decide", () => {
  it("remembers the most recent Add, and forgets it when that Add is undone", () => {
    let state = reduce(start(), { type: "decide", opId: "ins1", approved: true });
    expect(state.lastAdded).toBe("ins1");
    state = reduce(state, { type: "decide", opId: "ins2", approved: false });
    expect(state.lastAdded).toBe("ins1");
    state = reduce(state, { type: "undo", opId: "ins2" });
    expect(state.lastAdded).toBe("ins1");
    state = reduce(state, { type: "undo", opId: "ins1" });
    expect(state.lastAdded).toBeNull();
  });

  it("records the answer and lets the list pick the next card", () => {
    const next = reduce(start({ currentOpId: "ins1", whyOpen: true }), { type: "decide", opId: "ins1", approved: true });
    expect(next.decisions.ins1).toBe(true);
    expect(next.currentOpId).toBeNull();
    expect(next.whyOpen).toBe(false);
  });
});

describe("undo", () => {
  it("puts an added line back to undecided and opens it", () => {
    const next = reduce(start({ decisions: { ins1: true } }), { type: "undo", opId: "ins1" });
    expect(next.decisions.ins1).toBeUndefined();
    expect(next.currentOpId).toBe("ins1");
  });

  it("puts a skipped line back to undecided", () => {
    const next = reduce(start({ decisions: { ins1: false } }), { type: "undo", opId: "ins1" });
    expect(next.decisions.ins1).toBeUndefined();
  });

  it("toggles a rewording between the user's words and the rewording", () => {
    const undone = reduce(start(), { type: "undo", opId: "reph" });
    expect(undone.decisions.reph).toBe(false);
    const redone = reduce(undone, { type: "undo", opId: "reph" });
    expect(redone.decisions.reph).toBeUndefined();
  });

  it("brings back the lines removed to make room for an Add that is undone", () => {
    let state = start({ decisions: { ins1: true }, pages: 2, pagesAllowed: 1 });
    state = reduce(state, { type: "choosePageFit", optionId: "remove:rem", causedBy: "ins1" });
    expect(state.decisions.rem).toBe(true);
    expect(state.removedFor).toEqual({ ins1: ["rem"] });

    state = reduce(state, { type: "undo", opId: "ins1" });
    expect(state.decisions.ins1).toBeUndefined();
    expect(state.decisions.rem).toBeUndefined();
    expect(state.removedFor).toEqual({});
  });

  it("keeps one removed line without touching anything else", () => {
    const state = start({
      decisions: { ins1: true, rem: true, rem2: true },
      removedFor: { ins1: ["rem", "rem2"] },
    });
    const next = reduce(state, { type: "undo", opId: "rem" });
    expect(next.decisions).toEqual({ ins1: true, rem: undefined, rem2: true });
    expect(next.removedFor).toEqual({ ins1: ["rem2"] });
  });

  it("ignores an id it does not know", () => {
    const state = start();
    expect(reduce(state, { type: "undo", opId: "nope" })).toBe(state);
  });
});

describe("page fit", () => {
  it("uses the chosen shorter wording", () => {
    const next = reduce(start(), { type: "choosePageFit", optionId: "shorter:ins1:2", causedBy: "ins1" });
    expect(next.wordings.ins1).toBe(2);
  });

  it("raises the allowance to the current length, so further growth asks again", () => {
    const next = reduce(start({ pages: 2, pagesAllowed: 1 }), { type: "choosePageFit", optionId: "grow", causedBy: null });
    expect(next.pagesAllowed).toBe(2);
    expect(next.growthAllowed).toBe(true);
  });

  it("records a removal with no known cause without linking it", () => {
    const next = reduce(start(), { type: "choosePageFit", optionId: "remove:rem", causedBy: null });
    expect(next.decisions.rem).toBe(true);
    expect(next.removedFor).toEqual({});
  });
});

describe("measuredPages", () => {
  it("starts with pages null and adopts the first printed count as the allowance", () => {
    const fresh = start();
    expect(fresh.pages).toBeNull();
    expect(fresh.pagesAllowed).toBeNull();
    const state = reduce(fresh, { type: "measuredPages", pages: 2 });
    expect(state).toMatchObject({ pages: 2, pagesAllowed: 2 });
  });

  it("growing before any count keeps the stored allowance", () => {
    const next = reduce(start({ pagesAllowed: 1 }), { type: "choosePageFit", optionId: "grow", causedBy: null });
    expect(next.pagesAllowed).toBe(1);
  });

  it("shows a fallback-layout count but never adopts it as the allowance", () => {
    let state = reduce(start(), { type: "measuredPages", pages: 3, fallback: true });
    expect(state).toMatchObject({ pages: 3, pagesFallback: true, pagesAllowed: null });
    // The printer's own count, when it comes, is the one agreed to.
    state = reduce(state, { type: "measuredPages", pages: 2 });
    expect(state).toMatchObject({ pages: 2, pagesFallback: false, pagesAllowed: 2 });
  });

  it("takes the first measurement as the allowance and never lowers or raises it after", () => {
    let state = reduce(start(), { type: "measuredPages", pages: 2 });
    expect(state).toMatchObject({ pages: 2, pagesAllowed: 2 });
    state = reduce(state, { type: "measuredPages", pages: 3 });
    expect(state).toMatchObject({ pages: 3, pagesAllowed: 2 });
  });
});

describe("open, why, select, compare, wording", () => {
  it("opens a card with its explanation closed", () => {
    expect(reduce(start({ whyOpen: true }), { type: "open", opId: "ins2" })).toMatchObject({ currentOpId: "ins2", whyOpen: false });
  });

  it("toggles why for the same line and opens it fresh for another", () => {
    const once = reduce(start(), { type: "why", opId: "reph" });
    expect(once).toMatchObject({ currentOpId: "reph", whyOpen: true });
    expect(reduce(once, { type: "why", opId: "reph" }).whyOpen).toBe(false);
    expect(reduce(once, { type: "why", opId: "ins1" })).toMatchObject({ currentOpId: "ins1", whyOpen: true });
  });

  it("selects a requirement, opens its line, and deselects on a second click", () => {
    const picked = reduce(start(), { type: "selectRequirement", requirementId: "r3", opId: "ins1" });
    expect(picked).toMatchObject({ selectedRequirement: "r3", currentOpId: "ins1" });
    expect(reduce(picked, { type: "selectRequirement", requirementId: "r3", opId: "ins1" }).selectedRequirement).toBeNull();
  });

  it("flips compare and closes any explanation", () => {
    expect(reduce(start({ whyOpen: true }), { type: "toggleCompare" })).toMatchObject({ compare: true, whyOpen: false });
  });

  it("steps to the next wording", () => {
    const once = reduce(start(), { type: "nextWording", opId: "ins1" });
    expect(reduce(once, { type: "nextWording", opId: "ins1" }).wordings.ins1).toBe(2);
  });
});

describe("storage", () => {
  it("loads a session saved before removedFor existed", () => {
    const state = fromStored({
      decisions: { ins1: true }, wordings: { ins1: 1 }, pagesAllowed: 1, pagesSource: "printer", growthAllowed: false,
    });
    expect(state).toMatchObject({ decisions: { ins1: true }, wordings: { ins1: 1 }, pagesAllowed: 1, growthAllowed: false, removedFor: {} });
  });

  it("drops an allowance that was not counted by the printer", () => {
    // Sessions from before the Chromium printer measured a different layout;
    // that length is not the file's, so the next printed count replaces it.
    const old = fromStored({ decisions: { ins1: true }, wordings: {}, pagesAllowed: 1, growthAllowed: false, removedFor: {} });
    expect(old.pagesAllowed).toBeNull();
    expect(old.decisions).toEqual({ ins1: true });
  });

  it("stores the allowance with its source, and only when there is one", () => {
    expect(toStored(start({ pagesAllowed: 2 }))).toMatchObject({ pagesAllowed: 2, pagesSource: "printer" });
    expect(toStored(start()).pagesSource).toBeUndefined();
    expect(fromStored(toStored(start({ pagesAllowed: 2 }))).pagesAllowed).toBe(2);
  });

  it("re-reads the length of an old session that had already allowed growth", () => {
    // Before this branch "Keep everything" set growthAllowed without raising
    // pagesAllowed, so the stored allowance is the old, shorter length.
    const old = fromStored({ decisions: { ins1: true }, wordings: {}, pagesAllowed: 1, growthAllowed: true });
    expect(old).toMatchObject({ pagesAllowed: null, growthAllowed: true });
    const current = fromStored({
      decisions: {}, wordings: {}, pagesAllowed: 2, pagesSource: "printer", growthAllowed: true, removedFor: {},
    });
    expect(current.pagesAllowed).toBe(2);
  });

  it("starts empty with nothing stored", () => {
    expect(fromStored(null)).toMatchObject({ decisions: {}, pagesAllowed: null, compare: false, currentOpId: null });
  });

  it("stores only what should survive a refresh", () => {
    const stored = toStored(start({ decisions: { ins1: true }, currentOpId: "ins2", compare: true, pagesAllowed: 1 }));
    expect(Object.keys(stored).sort()).toEqual(["decisions", "growthAllowed", "pagesAllowed", "pagesSource", "removedFor", "wordings"]);
  });
});
