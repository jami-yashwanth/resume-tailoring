"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { session } from "@/lib/session";
import { coverageOf } from "@/lib/tailor/coverage";
import { linesToDocument, resolveDocument } from "@/lib/tailor/document";
import { downloadResume } from "@/lib/tailor/download";
import { requirementRows } from "@/lib/tailor/requirement-rows";
import { createReviewReducer, fromStored, toStored } from "@/lib/tailor/review";
import { decisionAnnouncement, reviewList, undoAnnouncement, withDecisions } from "@/lib/tailor/review-list";
import type { Layout, Outline, TailorPlan } from "@/lib/tailor/types";
import { usePrintedPages } from "@/lib/tailor/usePrintedPages";
import { buildLines } from "@/lib/tailor/view";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { ResultHeader } from "./ResultHeader";
import { ReviewList } from "./ReviewList";
import { SummaryPanel } from "./SummaryPanel";

/** How long the fallback-layout note stays up before the finish screen. */
const NOTE_MS = 4000;

/**
 * The Result screen: see the value → make 0–3 decisions → finish.
 *
 * Layout and wiring only. What the user can do lives in `review.ts`, what the
 * screen shows in `review-list.ts` and `requirement-rows.ts`, both tested
 * without a browser. The design is docs/superpowers/specs/2026-09-29-result-screen-revamp-design.md.
 */
export function ResultScreen({
  layout,
  plan,
  outline = null,
  company,
  role,
  resume = null,
  filename = null,
  sample = false,
}: {
  layout: Layout;
  plan: TailorPlan;
  /** Claude's reading of the structure. When set, the preview and the
   *  download render the structured document; null keeps flat blocks. */
  outline?: Outline | null;
  company: string;
  role: string;
  /** The user's file, held in the browser. Absent when showing the sample. */
  resume?: string | null;
  filename?: string | null;
  sample?: boolean;
}) {
  const router = useRouter();
  const reducer = useMemo(() => createReviewReducer(plan.operations), [plan.operations]);
  /* Read once, in the initialiser: this only mounts in the browser (the loader
     renders a placeholder until the session is read), and hydrating in an
     effect raced the effect that persists. */
  const [state, dispatch] = useReducer(reducer, null, () => fromStored(session.getDecisions()));
  const [announcement, setAnnouncement] = useState("");
  const announceFrame = useRef(0);
  /* Cleared, then set on the next frame: a live region only speaks when its
     text changes, so the second "Line removed to fit." in a row was silent. */
  const announce = useCallback((text: string) => {
    cancelAnimationFrame(announceFrame.current);
    setAnnouncement("");
    announceFrame.current = requestAnimationFrame(() => setAnnouncement(text));
  }, []);
  useEffect(() => () => cancelAnimationFrame(announceFrame.current), []);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  /* Said when the file came from the fallback layout: the move to the finish
     screen waits long enough for it to be read. */
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(noteTimer.current), []);

  useEffect(() => {
    session.setDecisions(toStored(state));
  }, [state]);

  const operations = useMemo(() => withDecisions(plan.operations, state.decisions), [plan.operations, state.decisions]);
  const lines = useMemo(
    () => buildLines(layout, operations, state.decisions, state.compare, state.wordings),
    [layout, operations, state.decisions, state.compare, state.wordings],
  );
  /* The document path wants one line per change, not the sheet's grouped
     lines — so it gets its own build. */
  const documentLines = useMemo(
    () => (outline ? buildLines(layout, operations, state.decisions, state.compare, state.wordings, false) : null),
    [outline, layout, operations, state.decisions, state.compare, state.wordings],
  );
  /* Two documents from the same template. The preview follows Compare and
     shows drafts and removals, marked. The file is always the tailored
     version with only what the user kept: it is what the download prints and
     what the printer counts, so the length the user agrees to is the file's. */
  const previewDocument = useMemo(
    () =>
      outline && documentLines
        ? resolveDocument(outline, documentLines, { drafts: true })
        : linesToDocument(lines, { drafts: true }),
    [outline, documentLines, lines],
  );
  const fileDocument = useMemo(() => {
    const final = buildLines(layout, operations, state.decisions, false, state.wordings, !outline);
    return outline ? resolveDocument(outline, final) : linesToDocument(final);
  }, [outline, layout, operations, state.decisions, state.wordings]);

  const printed = usePrintedPages(fileDocument);
  /* Keyed on the flag as well as the number: a printer count of the same
     length after a fallback one must still clear "(fallback layout)" and
     become the allowance. */
  useEffect(() => {
    if (printed.pages !== null) dispatch({ type: "measuredPages", pages: printed.pages, fallback: printed.fallback });
  }, [printed.pages, printed.fallback]);

  const list = reviewList(plan, layout, state, { countFailed: printed.failed, checking: printed.checking });
  /* Download waits for the printer's count of the file on screen: until then
     the length is unknown or stale, and a file could grow a page nobody agreed
     to. If the printer gave up, Download comes back — `allowPages` below still
     refuses to save a file longer than agreed. */
  const countKnown = printed.failed || (!printed.checking && state.pages !== null);
  const coverage = coverageOf(plan.requirements, plan.matches, operations);
  const rows = requirementRows(plan.requirements, plan.matches, operations);
  const highlightBlocks = rows.find((r) => r.requirement.id === state.selectedRequirement)?.pointsTo ?? null;

  // A decided line's border tracks whether its "why" explanation is actually
  // open, not just whether it was last clicked — else a second click can't
  // clear it. An undecided line's border tracks which card is open instead.
  const openOpId = state.currentOpId ?? list.current?.op.id ?? null;
  const activeOpId = list.toDecide.some((i) => i.op.id === openOpId) ? openOpId : state.whyOpen ? state.currentOpId : null;

  function decide(opId: string, approved: boolean) {
    const item = list.toDecide.find((i) => i.op.id === opId);
    dispatch({ type: "decide", opId, approved });
    // The event names the choice, never the line: no document text leaves.
    track("decision_made", { approved });
    if (list.toDecide.length - 1 === 0) track("all_decided");
    announce(decisionAnnouncement(item?.skill ?? null, approved, list.toDecide.length - 1));
  }

  function undo(opId: string) {
    const item = [...list.decided, ...list.reworded, ...list.removed].find((i) => i.op.id === opId);
    dispatch({ type: "undo", opId });
    announce(item ? undoAnnouncement(item) : "");
  }

  function choosePageFit(optionId: string) {
    dispatch({ type: "choosePageFit", optionId, causedBy: list.pageFit?.causedBy ?? null });
    // "Your resume came to N pages…" is answered now; it would only mislead.
    setDownloadError(null);
    announce(
      optionId.startsWith("remove:")
        ? "Line removed to fit."
        : optionId.startsWith("shorter:")
          ? "Using a shorter wording."
          : `Keeping everything. Your resume is now ${state.pages} pages.`,
    );
  }

  /** A changed line on the page opens its card, or its row's explanation. */
  function focusLine(opId: string) {
    if (list.toDecide.some((i) => i.op.id === opId)) dispatch({ type: "open", opId });
    else dispatch({ type: "why", opId });
  }

  async function download() {
    if (!resume) return;
    setDownloading(true);
    setDownloadError(null);
    setDownloadNote(null);
    track("download_clicked");
    try {
      // Always the tailored version, whatever the compare toggle shows.
      const allowPages = state.growthAllowed ? null : state.pagesAllowed;
      const saved = await downloadResume(fileDocument, filename, company, allowPages);
      if (!saved.saved && saved.pages !== null) {
        // Longer than agreed: nothing saved. The page-fit card asks how it fits.
        dispatch({ type: "measuredPages", pages: saved.pages, fallback: saved.fallback });
        setDownloadError(`Your resume came to ${saved.pages} pages. Choose how it fits, then download again.`);
        return;
      }
      // Neither count known is the rare case both the printer and the fallback went quiet about length.
      const pages = saved.pages ?? state.pages ?? layout.pages;
      track("download_done", { pages });
      session.setFinish({
        filename: saved.name,
        company,
        role,
        pages,
        pagesBefore: layout.pages,
        covered: coverage.covered,
        total: coverage.total,
        originalCovered: coverage.originalCovered,
        reworded: list.reworded.filter((i) => i.state === "reworded").length,
        removed: list.removed.length,
        added: list.decided.filter((i) => i.state === "added").map((i) => i.text),
        operations,
      });
      // The fallback layout can differ from the preview; say so before moving on.
      if (saved.note) {
        setDownloadNote(saved.note);
        noteTimer.current = setTimeout(() => router.push("/done"), NOTE_MS);
      } else router.push("/done");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not write your file.");
    } finally {
      setDownloading(false);
    }
  }

  const notice = downloadNote ? (
    <p
      role="status"
      className="m-0 rounded-lg border border-line bg-paper-raised p-3 text-[13px] leading-[19px] text-ink-muted"
    >
      {downloadNote}
    </p>
  ) : downloadError || sample || !resume ? (
    <p
      role={downloadError ? "alert" : undefined}
      className={`m-0 rounded-lg border p-3 text-[13px] leading-[19px] ${
        downloadError ? "border-gap bg-gap-soft font-semibold text-gap" : "border-line bg-paper-raised text-ink-muted"
      }`}
    >
      {downloadError ??
        (sample ? (
          <>
            This is a demo of a saved sample tailoring. <a href="/upload">Tailor your own resume</a> to download a
            file.
          </>
        ) : (
          <>
            Your decisions are safe, but this browser no longer has your file, so we can&rsquo;t write the
            download. <a href="/upload">Upload it again</a> to finish.
          </>
        ))}
    </p>
  ) : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ResultHeader
        role={role}
        company={company}
        status={list.status}
        compare={state.compare}
        onToggleCompare={() => dispatch({ type: "toggleCompare" })}
        ready={list.ready}
        onDownload={download}
        // Not while the page-fit question is open or the count is still
        // coming: the file would be a length nobody agreed to. The status says why.
        canDownload={Boolean(resume) && countKnown && !list.pageFit && !downloadNote}
        checking={printed.checking}
        downloading={downloading}
      />

      {/* 220 · up to 794 (A4 at 96dpi, the page ResumePage draws) · 300.
          Below 1240 the summary folds into a strip above; below 900 the review
          list moves above the resume. Nothing is ever hidden. */}
      <div
        className="grid flex-1 content-start justify-center gap-8 overflow-y-auto bg-paper-sunken px-8 py-8
                   [grid-template-columns:220px_minmax(0,794px)_300px]
                   max-[1240px]:[grid-template-columns:minmax(0,1fr)_300px]
                   max-[900px]:[grid-template-columns:minmax(0,1fr)] max-[900px]:gap-4 max-[900px]:p-4"
      >
        <SummaryPanel
          className="self-start min-[1240px]:sticky min-[1240px]:top-0 min-[1240px]:max-h-[calc(100dvh-8rem)]
                     min-[1240px]:overflow-y-auto max-[1240px]:col-span-2 max-[900px]:col-span-1"
          rows={rows}
          coverage={coverage}
          selected={state.selectedRequirement}
          onSelect={(requirementId, opId) => dispatch({ type: "selectRequirement", requirementId, opId })}
        />

        <div className="flex min-w-0 flex-col gap-3 max-[900px]:order-3">
          <ResumePreview
            document={previewDocument}
            activeOpId={activeOpId}
            highlightBlocks={highlightBlocks}
            onSelect={focusLine}
          />
        </div>

        <ReviewList
          className="self-start min-[900px]:sticky min-[900px]:top-0 min-[900px]:max-h-[calc(100dvh-8rem)]
                     min-[900px]:overflow-y-auto max-[900px]:order-2"
          list={list}
          state={state}
          countFailed={printed.failed}
          coverage={coverage}
          notice={notice}
          onDecide={decide}
          onUndo={undo}
          onNextWording={(opId) => dispatch({ type: "nextWording", opId })}
          onOpen={(opId) => dispatch({ type: "open", opId })}
          onWhy={(opId) => dispatch({ type: "why", opId })}
          onChoosePageFit={choosePageFit}
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
