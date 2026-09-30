import type { PlannedOp } from "./types";
import type { Decisions, Wordings } from "./view";

/**
 * Everything the user can do on the Result screen, as one pure reducer.
 *
 * It used to be eleven `useState`s in the component, which is how an Add came
 * to have no Undo and a removal made to fit an Add outlived the Add. Every
 * change the user can make is one action here, tested without a browser.
 */

export type ReviewState = {
  decisions: Decisions;
  wordings: Wordings;
  /** The length the user has agreed to. Set from the first measurement. */
  pagesAllowed: number | null;
  /** The user has allowed the document to grow at least once. */
  growthAllowed: boolean;
  /** Lines removed to make room for an insert, keyed by that insert's id —
   *  so undoing the Add brings back what it pushed out. */
  removedFor: Record<string, string[]>;
  /** The insert most recently added, so a page overflow is filed under the Add
   *  that caused it rather than under whichever changed line comes last. */
  lastAdded: string | null;
  /** The card the user opened; null lets the list pick the first pending one. */
  currentOpId: string | null;
  /** Whether "Why this line?" is expanded for `currentOpId`. */
  whyOpen: boolean;
  selectedRequirement: string | null;
  compare: boolean;
  /** Pages the printer last counted for the file; null until it has answered. */
  pages: number | null;
  /** `pages` came from the drawn fallback layout: shown, never agreed to. */
  pagesFallback: boolean;
};

export type ReviewAction =
  | { type: "decide"; opId: string; approved: boolean }
  | { type: "undo"; opId: string }
  | { type: "nextWording"; opId: string }
  | { type: "open"; opId: string | null }
  | { type: "why"; opId: string }
  | { type: "selectRequirement"; requirementId: string; opId: string | null }
  | { type: "choosePageFit"; optionId: string; causedBy: string | null }
  | { type: "toggleCompare" }
  /** `fallback`: counted by the drawn fallback layout, not Chromium. */
  | { type: "measuredPages"; pages: number; fallback?: boolean };

/** What survives a refresh. `removedFor` is optional so older sessions load. */
export type Persisted = {
  decisions: Decisions;
  wordings: Wordings;
  pagesAllowed: number | null;
  /** Who counted `pagesAllowed`. Only a Chromium count of the template is kept
   *  across a refresh; anything else (an older layout's) is re-counted. */
  pagesSource?: "printer";
  growthAllowed: boolean;
  removedFor?: Record<string, string[]>;
};

export function fromStored(stored: Persisted | null): ReviewState {
  /* A session saved before `removedFor` existed, whose "Keep everything" set
     `growthAllowed` without raising `pagesAllowed`: its allowance is the old,
     shorter length, and would re-ask about a page already agreed to. The next
     measurement takes the current length instead. */
  const oldGrowth = Boolean(stored?.growthAllowed) && stored?.removedFor === undefined;
  /* An allowance the printer did not count was measured on a layout the file
     no longer has (the LaTeX template, the measured replica): drop it, and
     the first printed count becomes the allowance again. */
  const printed = stored?.pagesSource === "printer";
  return {
    decisions: stored?.decisions ?? {},
    wordings: stored?.wordings ?? {},
    pagesAllowed: oldGrowth || !printed ? null : (stored?.pagesAllowed ?? null),
    growthAllowed: stored?.growthAllowed ?? false,
    removedFor: stored?.removedFor ?? {},
    lastAdded: null,
    currentOpId: null,
    whyOpen: false,
    selectedRequirement: null,
    compare: false,
    pages: null,
    pagesFallback: false,
  };
}

export function toStored(state: ReviewState): Persisted {
  return {
    decisions: state.decisions,
    wordings: state.wordings,
    pagesAllowed: state.pagesAllowed,
    ...(state.pagesAllowed === null ? {} : { pagesSource: "printer" as const }),
    growthAllowed: state.growthAllowed,
    removedFor: state.removedFor,
  };
}

export function createReviewReducer(operations: PlannedOp[]) {
  const byId = new Map(operations.map((op) => [op.id, op]));

  return function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
    switch (action.type) {
      case "decide":
        return {
          ...state,
          decisions: { ...state.decisions, [action.opId]: action.approved },
          lastAdded: action.approved ? action.opId : state.lastAdded,
          currentOpId: null,
          whyOpen: false,
        };
      case "undo":
        return undo(state, byId.get(action.opId));
      case "nextWording":
        return {
          ...state,
          wordings: { ...state.wordings, [action.opId]: (state.wordings[action.opId] ?? 0) + 1 },
        };
      case "open":
        return { ...state, currentOpId: action.opId, whyOpen: false };
      case "why": {
        const same = state.currentOpId === action.opId;
        return { ...state, currentOpId: action.opId, whyOpen: same ? !state.whyOpen : true };
      }
      case "selectRequirement": {
        const same = state.selectedRequirement === action.requirementId;
        return {
          ...state,
          selectedRequirement: same ? null : action.requirementId,
          currentOpId: !same && action.opId ? action.opId : state.currentOpId,
          whyOpen: false,
        };
      }
      case "choosePageFit":
        return choosePageFit(state, action.optionId, action.causedBy);
      case "toggleCompare":
        return { ...state, compare: !state.compare, whyOpen: false };
      case "measuredPages": {
        /* A fallback count is shown but never becomes the allowance: the
           drawn layout sets differently from the template, so agreeing to
           its length would be agreeing to the wrong file's. */
        const fallback = Boolean(action.fallback);
        return {
          ...state,
          pages: action.pages,
          pagesFallback: fallback,
          pagesAllowed: fallback ? state.pagesAllowed : (state.pagesAllowed ?? action.pages),
        };
      }
    }
  };
}

function undo(state: ReviewState, op: PlannedOp | undefined): ReviewState {
  if (!op) return state;
  const decisions = { ...state.decisions };

  if (op.op === "rephrase") {
    // Undo shows the user's own words; undoing that takes the rewording again.
    decisions[op.id] = decisions[op.id] === false ? undefined : false;
    return { ...state, decisions };
  }

  if (op.op === "remove") {
    // "Keep it": the line stays, and no insert is owed it any more.
    decisions[op.id] = undefined;
    const removedFor: Record<string, string[]> = {};
    for (const [cause, ids] of Object.entries(state.removedFor)) {
      const kept = ids.filter((id) => id !== op.id);
      if (kept.length) removedFor[cause] = kept;
    }
    return { ...state, decisions, removedFor };
  }

  // An insert: back to undecided, and whatever was dropped to fit it returns.
  decisions[op.id] = undefined;
  for (const id of state.removedFor[op.id] ?? []) decisions[id] = undefined;
  const removedFor = { ...state.removedFor };
  delete removedFor[op.id];
  const lastAdded = state.lastAdded === op.id ? null : state.lastAdded;
  return { ...state, decisions, removedFor, lastAdded, currentOpId: op.id, whyOpen: false };
}

function choosePageFit(state: ReviewState, optionId: string, causedBy: string | null): ReviewState {
  const [kind, id, index] = optionId.split(":");

  if (kind === "remove" && id) {
    const removedFor = causedBy
      ? { ...state.removedFor, [causedBy]: [...(state.removedFor[causedBy] ?? []), id] }
      : state.removedFor;
    return { ...state, decisions: { ...state.decisions, [id]: true }, removedFor };
  }

  if (kind === "shorter" && id && index !== undefined) {
    return { ...state, wordings: { ...state.wordings, [id]: Number(index) } };
  }

  if (kind === "grow") {
    // Agreeing to this length is not agreeing to any length: growing again asks again.
    // With no count yet there is no new length to agree to; the allowance stands.
    return { ...state, growthAllowed: true, pagesAllowed: state.pages ?? state.pagesAllowed };
  }

  return state;
}
