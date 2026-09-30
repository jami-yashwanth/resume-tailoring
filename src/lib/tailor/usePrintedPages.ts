import { useEffect, useRef, useState } from "react";
import type { TemplateDocument } from "./document";
import { fetchPageCount } from "./pages";

/**
 * The page count the download will have, asked of the printer.
 *
 * The screen's own pagination is a display guide; this is the number the user
 * is shown and agrees a length with, because it comes from printing the same
 * HTML the download prints. Every decision changes the document, so requests
 * are debounced, and each new one aborts the last: only the answer for the
 * document on screen may land.
 */

export type PrintedPages = { pages: number | null; checking: boolean };

type Count = (document: TemplateDocument, signal: AbortSignal) => Promise<number>;

/** The scheduler under the hook, kept free of React so it can be tested without a DOM. */
export function createPageCounter(count: Count, delayMs: number) {
  let state: PrintedPages = { pages: null, checking: false };
  const listeners = new Set<(state: PrintedPages) => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;
  // Bumped by every update: an answer whose number is not current was superseded.
  let latest = 0;
  let disposed = false;

  const set = (next: PrintedPages) => {
    state = next;
    for (const listener of listeners) listener(state);
  };

  return {
    update(document: TemplateDocument) {
      if (disposed) return;
      const request = ++latest;
      clearTimeout(timer);
      controller?.abort();
      controller = null;
      set({ ...state, checking: true });
      timer = setTimeout(() => {
        const own = new AbortController();
        controller = own;
        count(document, own.signal).then(
          (pages) => {
            if (request === latest && !disposed) set({ pages, checking: false });
          },
          () => {
            // The last count stands: a failed check is not a new length.
            if (request === latest && !disposed) set({ ...state, checking: false });
          },
        );
      }, delayMs);
    },
    subscribe(listener: (state: PrintedPages) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      listeners.clear();
    },
  };
}

export type PageCounter = ReturnType<typeof createPageCounter>;

export function usePrintedPages(document: TemplateDocument, delayMs = 800): PrintedPages {
  const [state, setState] = useState<PrintedPages>({ pages: null, checking: false });
  const counter = useRef<PageCounter | null>(null);

  useEffect(() => {
    const own = createPageCounter(fetchPageCount, delayMs);
    counter.current = own;
    const unsubscribe = own.subscribe(setState);
    return () => {
      unsubscribe();
      own.dispose();
      if (counter.current === own) counter.current = null;
    };
  }, [delayMs]);

  // Declared after the effect above, so on mount the counter exists first.
  useEffect(() => {
    counter.current?.update(document);
  }, [document, delayMs]);

  return state;
}
