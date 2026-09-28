"use client";

import type { Layout, TailorPlan } from "@/lib/tailor/types";

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
  finish: "rezz.finish",
} as const;

export type StoredResult = { layout: Layout; plan: TailorPlan };

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

function write(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Private window or blocked storage. The flow still works within one page;
    // it just will not survive a navigation, which is better than crashing.
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
  setResume: (base64: string, filename: string) => {
    write(KEYS.resume, base64);
    write(KEYS.filename, filename);
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
  setResult: (result: StoredResult) => write(KEYS.result, JSON.stringify(result)),

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
    drop(KEYS.finish);
  },
  clearAll: () => Object.values(KEYS).forEach(drop),
};
