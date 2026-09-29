"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { session } from "@/lib/session";
import { coverageOf } from "@/lib/tailor/coverage";
import { downloadResume } from "@/lib/tailor/download";
import { requirementRows } from "@/lib/tailor/requirement-rows";
import { createReviewReducer, fromStored, toStored } from "@/lib/tailor/review";
import { decisionAnnouncement, reviewList, undoAnnouncement, withDecisions } from "@/lib/tailor/review-list";
import type { Layout, TailorPlan } from "@/lib/tailor/types";
import { buildLines } from "@/lib/tailor/view";
import { DefaultTemplateSheet } from "./DefaultTemplateSheet";
import { ResultHeader } from "./ResultHeader";
import { ReviewList } from "./ReviewList";
import { SummaryPanel } from "./SummaryPanel";

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
  company,
  role,
  resume = null,
  filename = null,
  sample = false,
}: {
  layout: Layout;
  plan: TailorPlan;
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
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    session.setDecisions(toStored(state));
  }, [state]);

  const operations = useMemo(() => withDecisions(plan.operations, state.decisions), [plan.operations, state.decisions]);
  const lines = useMemo(
    () => buildLines(layout, operations, state.decisions, state.compare, state.wordings),
    [layout, operations, state.decisions, state.compare, state.wordings],
  );
  const list = reviewList(plan, layout, state);
  const coverage = coverageOf(plan.requirements, plan.matches, operations);
  const rows = requirementRows(plan.requirements, plan.matches, operations);
  const highlightBlocks = rows.find((r) => r.requirement.id === state.selectedRequirement)?.pointsTo ?? null;

  const onPageCount = useCallback((pages: number) => dispatch({ type: "measuredPages", pages }), []);

  function decide(opId: string, approved: boolean) {
    const item = list.toDecide.find((i) => i.op.id === opId);
    dispatch({ type: "decide", opId, approved });
    setAnnouncement(decisionAnnouncement(item?.skill ?? null, approved, list.toDecide.length - 1));
  }

  function undo(opId: string) {
    const item = [...list.decided, ...list.reworded, ...list.removed].find((i) => i.op.id === opId);
    dispatch({ type: "undo", opId });
    setAnnouncement(item ? undoAnnouncement(item) : "");
  }

  function choosePageFit(optionId: string) {
    dispatch({ type: "choosePageFit", optionId, causedBy: list.pageFit?.causedBy ?? null });
    setAnnouncement(
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
    try {
      // Always the tailored version, whatever the compare toggle shows.
      const final = buildLines(layout, operations, state.decisions, false, state.wordings);
      const saved = await downloadResume(final, filename, company);
      session.setFinish({
        filename: saved.name,
        company,
        role,
        pages: saved.pages ?? state.pages,
        pagesBefore: layout.pages,
        covered: coverage.covered,
        total: coverage.total,
        originalCovered: coverage.originalCovered,
        reworded: list.reworded.filter((i) => i.state === "reworded").length,
        removed: list.removed.length,
        added: list.decided.filter((i) => i.state === "added").map((i) => i.text),
        operations,
      });
      router.push("/done");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not write your file.");
    } finally {
      setDownloading(false);
    }
  }

  const notice =
    downloadError || sample || !resume ? (
      <p
        role={downloadError ? "alert" : undefined}
        className={`m-0 rounded-lg border p-3 text-[13px] leading-[19px] ${
          downloadError ? "border-gap bg-gap-soft font-semibold text-gap" : "border-line bg-paper-raised text-ink-muted"
        }`}
      >
        {downloadError ??
          (sample ? (
            <>
              Showing a saved sample tailoring. <a href="/upload">Tailor your own resume</a> to download a file.
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
        // Not while the page-fit question is open: the file would be a length
        // nobody agreed to. The status says why.
        canDownload={Boolean(resume) && !list.pageFit}
        downloading={downloading}
      />

      {/* 220 · up to 794 (A4 at 96dpi, the page template_render.py draws) · 300.
          Below 1240 the summary folds into a strip above; below 900 the review
          list moves above the resume. Nothing is ever hidden. */}
      <div
        className="grid flex-1 content-start justify-center gap-8 overflow-y-auto bg-paper-sunken px-8 py-8
                   [grid-template-columns:220px_minmax(0,794px)_300px]
                   max-[1240px]:[grid-template-columns:minmax(0,1fr)_300px]
                   max-[900px]:[grid-template-columns:minmax(0,1fr)] max-[900px]:gap-4 max-[900px]:p-4"
      >
        <SummaryPanel
          className="self-start min-[1241px]:sticky min-[1241px]:top-0 max-[1240px]:col-span-2 max-[900px]:col-span-1"
          rows={rows}
          coverage={coverage}
          selected={state.selectedRequirement}
          onSelect={(requirementId, opId) => dispatch({ type: "selectRequirement", requirementId, opId })}
        />

        <DefaultTemplateSheet
          className="max-[900px]:order-3"
          layout={layout}
          lines={lines}
          activeOpId={state.currentOpId ?? list.current?.op.id ?? null}
          highlightBlocks={highlightBlocks}
          onSelect={focusLine}
          onPageCount={onPageCount}
        />

        <ReviewList
          className="self-start min-[901px]:sticky min-[901px]:top-0 min-[901px]:max-h-[calc(100dvh-8rem)]
                     min-[901px]:overflow-y-auto max-[900px]:order-2"
          list={list}
          state={state}
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
