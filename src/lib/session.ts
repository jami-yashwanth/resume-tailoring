"use client";

import type { Layout, TailorPlan } from "@/lib/tailor/types";
import type { Decisions, Wordings } from "@/lib/tailor/view";

/**
 * Where a tailoring lives between screens.
 *
 * In the browser, deliberately. There are no accounts yet and no database, and
 * for a product selling "your data is yours" the right default is that the
 * resume never sits on a server it does not need to. It is posted when there
 * is work to do — tailoring, or writing the file — and nothing is kept.
 *
 * sessionStorage, not localStorage: closing the tab should end it. Every
 * access is guarded, because it throws in private windows and with site data
 * blocked, and losing a draft must never be an unhandled exception.
 */

const KEYS = {
  resume: "rezz.resume",
  filename: "rezz.filename",
  job: "rezz.job",
  result: "rezz.result",
  decisions: "rezz.decisions",
  finish: "rezz.finish",
} as const;

export type StoredResult = { layout: Layout; plan: TailorPlan };

/**
 * What the user has decided on the Result screen so far.
 *
 * Kept because a refresh used to throw all of it away and ask again — including
 * for lines the user had already skipped, which is the one thing the spec says
 * never to do. It lives beside the result and dies with it.
 */
export type StoredDecisions = {
  decisions: Decisions;
  wordings: Wordings;
  /** The page count the user has agreed the document may reach. */
  pagesAllowed: number | null;
  /** They chose "keep everything" over losing a line, so stop asking. */
  growthAllowed: boolean;
  /** Lines removed to make room for an insert, keyed by that insert. Absent in
   *  sessions saved before 29 Sep 2026, which is why it is optional. */
  removedFor?: Record<string, string[]>;
};

/** What the finish screen needs, written at the moment of a successful
 *  download so `/done` reports what actually happened rather than re-deriving
 *  it from state the user has already navigated away from. */
export type Finish = {
  filename: string;
  company: string;
  role: string;
  pages: number;
  pagesBefore: number;
  covered: number;
  total: number;
  originalCovered: number;
  reworded: number;
  /** Lines the user chose to drop so the page count would hold. */
  removed: number;
  added: string[];
  operations: TailorPlan["operations"];
};

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    window.sessionStorage.setItem(key, value);
    // Read back rather than trusting the absence of a throw: some browsers
    // fail a quota write without one, and a swallowed loss here surfaces as an
    // unexplained bounce back to /upload two screens later.
    return window.sessionStorage.getItem(key) === value;
  } catch {
    // Private window, blocked storage, or the value is over quota. The caller
    // decides whether that is fatal; most flows work within one page.
    return false;
  }
}

function drop(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

export const session = {
  getResume: () => read(KEYS.resume),
  /** True only if the file survived the write — the resume is the one value
   *  big enough to hit the storage quota, and losing it silently costs the
   *  user their upload. All-or-nothing: a failed pair is dropped whole, so a
   *  previous upload's bytes can never sit under the new file's name. */
  setResume: (base64: string, filename: string): boolean => {
    if (write(KEYS.resume, base64) && write(KEYS.filename, filename)) return true;
    drop(KEYS.resume);
    drop(KEYS.filename);
    return false;
  },
  getFilename: () => read(KEYS.filename),

  getJob: () => read(KEYS.job),
  setJob: (text: string) => write(KEYS.job, text),

  getResult: (): StoredResult | null => {
    const raw = read(KEYS.result);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredResult;
    } catch {
      return null;
    }
  },
  /** A new tailoring is a new set of questions, so old answers go with it.
   *  True only if the result survived the write: layout + plan share the
   *  resume's quota, and a silently lost result bounces the user back to
   *  /job with no explanation. */
  setResult: (result: StoredResult): boolean => {
    drop(KEYS.decisions);
    return write(KEYS.result, JSON.stringify(result));
  },

  getDecisions: (): StoredDecisions | null => {
    const raw = read(KEYS.decisions);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredDecisions;
    } catch {
      return null;
    }
  },
  setDecisions: (state: StoredDecisions) => write(KEYS.decisions, JSON.stringify(state)),

  getFinish: (): Finish | null => {
    const raw = read(KEYS.finish);
    if (!raw) return null;
    try { return JSON.parse(raw) as Finish; } catch { return null; }
  },
  setFinish: (finish: Finish) => write(KEYS.finish, JSON.stringify(finish)),

  /** Used by "Tailor for another job": the resume stays, the job goes. */
  clearJob: () => {
    drop(KEYS.job);
    drop(KEYS.result);
    drop(KEYS.decisions);
    drop(KEYS.finish);
  },
  clearAll: () => Object.values(KEYS).forEach(drop),
};
