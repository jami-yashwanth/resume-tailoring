"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/rezz/Button";
import { Wordmark } from "@/components/rezz/Wordmark";
import { session } from "@/lib/session";
import { coverageOf, pendingDecisions } from "@/lib/tailor/coverage";
import type { Layout, TailorPlan } from "@/lib/tailor/types";
import { type Decisions, buildLines } from "@/lib/tailor/view";
import { ChangePopover } from "./ChangePopover";
import { DecisionBar } from "./DecisionBar";
import { JobPanel } from "./JobPanel";
import { ResultMargin } from "./ResultMargin";
import { TailoredSheet } from "./TailoredSheet";

/**
 * The Result screen: see the value → make 0–3 decisions → finish.
 *
 * One bar of chrome, three columns, one decision at a time. State lives here
 * because every part of the screen moves together: a decision changes the
 * document, the margin, the coverage count and the bottom bar at once.
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
  const [decisions, setDecisions] = useState<Decisions>({});
  const [activeOpId, setActiveOpId] = useState<string | null>(null);
  const [selectedRequirement, setSelectedRequirement] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const operations = useMemo(
    () => plan.operations.map((op) => ({ ...op, approved: decisions[op.id] })),
    [plan.operations, decisions],
  );

  const lines = useMemo(
    () => buildLines(layout, operations, decisions, compare),
    [layout, operations, decisions, compare],
  );

  const coverage = coverageOf(plan.matches, operations);
  const pending = pendingDecisions(operations);
  const total = plan.operations.filter((op) => op.needsDecision).length;
  const reworded = plan.operations.filter((op) => op.claim === "reworded").length;
  const ready = pending.length === 0;

  function decide(opId: string, approved: boolean) {
    const op = plan.operations.find((o) => o.id === opId);
    const left = pending.length - 1;
    setDecisions((previous) => ({ ...previous, [opId]: approved }));
    setActiveOpId(null);
    // Polite live region, per the spec: name what happened and what remains.
    setAnnouncement(
      `${approved ? "Line added" : "Line skipped"}. ${
        left === 0 ? "No decisions left." : `${left} decision${left === 1 ? "" : "s"} left.`
      }`,
    );
    if (op && approved) setSelectedRequirement(null);
  }

  /**
   * Write the decisions into the user's own file and hand it to them.
   *
   * The plan goes up with each operation's `approved` flag set, and the server
   * filters on it — a line that was skipped cannot arrive in the document by
   * some later accident of state.
   */
  async function download() {
    if (!resume) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          plan: { ...plan, operations },
          maxPages: layout.pages,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not write your file.");

      const bytes = Uint8Array.from(atob(body.file), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = (filename ?? "resume.docx").replace(/\.docx$/i, "") + ` — ${company}.docx`;
      link.click();
      URL.revokeObjectURL(url);

      // Hand the finish screen what actually happened, rather than making it
      // re-derive counts from state the user is about to navigate away from.
      session.setFinish({
        filename: link.download,
        company,
        role,
        pages: body.pages,
        pagesBefore: body.pagesBefore,
        covered: coverage.covered,
        total: coverage.total,
        originalCovered: coverage.originalCovered,
        reworded,
        added: operations.filter((op) => op.approved === true).map((op) => op.text ?? ""),
        operations,
      });
      router.push("/done");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not write your file.");
    } finally {
      setDownloading(false);
    }
  }

  /* Built from what actually happened rather than a template with numbers
     poured in. A run that reworded nothing should not open with "0 lines
     reworded" — that is a true sentence about nothing, and it reads as a
     failure report. */
  const added = operations.filter((op) => op.approved === true).length;
  const status = [
    reworded > 0 && `${reworded} line${reworded === 1 ? "" : "s"} reworded from your own facts.`,
    added > 0 && `${added} line${added === 1 ? "" : "s"} you added.`,
    pending.length > 0
      ? `${pending.length} line${pending.length === 1 ? "" : "s"} ${
          pending.length === 1 ? "needs" : "need"
        } your OK.`
      : total > 0 && "All decisions made.",
    reworded === 0 && total === 0 && "Your resume already covers what this job asks for.",
  ]
    .filter(Boolean)
    .join(" ");

  const activeOp = operations.find((op) => op.id === activeOpId) ?? null;
  const activeLine = lines.find((line) => line.opId === activeOpId);

  const highlightBlocks = useMemo(() => {
    if (!selectedRequirement) return null;
    const match = plan.matches.find((m) => m.requirementId === selectedRequirement);
    const fromOps = operations
      .filter((op) => op.requirements.includes(selectedRequirement))
      .map((op) => op.block);
    return [...(match?.evidence ?? []), ...fromOps];
  }, [selectedRequirement, plan.matches, operations]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* One bar of chrome. The header and the status line are the same row:
          two stacked bars was the v1 mistake. */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 border-b border-line bg-paper-raised px-8 py-3 max-[900px]:grid-cols-1 max-[900px]:gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-4">
            <Wordmark />
            <p className="m-0 truncate text-[15px] leading-[21px]">
              <a href="/tracker" className="text-ink-muted no-underline hover:underline">
                Your resumes
              </a>{" "}
              / <b className="font-semibold">{role}, {company}</b>
            </p>
          </div>
          <p role="status" className="m-0 mt-px text-[13px] leading-[18px] text-ink-muted">
            {compare ? "Showing the file you uploaded. No changes applied." : status}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[13px] leading-[18px] text-ink-muted">
            Page 1 of {layout.pages}
          </span>
          <button
            type="button"
            aria-pressed={compare}
            onClick={() => {
              setCompare((v) => !v);
              setActiveOpId(null);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong
                       bg-transparent py-0 pl-3 pr-4 font-ui text-sm font-medium leading-5 text-ink
                       hover:border-ink"
          >
            <span
              aria-hidden
              className={`relative h-4 w-7 flex-none rounded-full transition-colors duration-150
                          ${compare ? "bg-ink" : "bg-line-strong"}`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all duration-150
                            ${compare ? "left-[14px]" : "left-0.5"}`}
              />
            </span>
            Compare with original
          </button>
          <Button
            variant={ready ? "primary" : "secondary"}
            onClick={download}
            disabled={!resume || downloading}
            title={sample ? "This is the saved sample. Tailor your own resume to download." : undefined}
          >
            {downloading ? "Writing your file…" : "Download resume"}
          </Button>
        </div>
      </header>

      {(sample || downloadError) && (
        <p
          role={downloadError ? "alert" : undefined}
          className={`border-b px-8 py-2 text-[13px] leading-[18px] ${
            downloadError
              ? "border-line bg-gap-soft text-gap"
              : "border-line bg-paper-raised text-ink-muted"
          }`}
        >
          {downloadError ?? (
            <>
              Showing a saved sample tailoring. <a href="/upload">Tailor your own resume</a> to
              download a file.
            </>
          )}
        </p>
      )}

      <div
        className="grid flex-1 justify-center gap-8 overflow-y-auto bg-paper-sunken px-8 pt-8
                   [grid-template-columns:264px_minmax(0,620px)_300px]
                   max-[1240px]:[grid-template-columns:240px_minmax(0,1fr)]
                   max-[900px]:[grid-template-columns:minmax(0,1fr)] max-[900px]:p-4"
      >
        <div className="max-[900px]:hidden">
          <JobPanel
            requirements={plan.requirements}
            matches={plan.matches}
            operations={operations}
            coverage={coverage}
            selected={selectedRequirement}
            onSelect={setSelectedRequirement}
          />
        </div>

        <TailoredSheet
          layout={layout}
          lines={lines}
          activeOpId={activeOpId}
          highlightBlocks={highlightBlocks}
          onSelect={(opId) => setActiveOpId((current) => (current === opId ? null : opId))}
        />

        <div className="max-[1240px]:hidden">
          {!compare && (
            <ResultMargin
              lines={lines}
              operations={operations}
              activeOpId={activeOpId}
              onSelect={setActiveOpId}
            >
              {activeOp && activeLine && (
                <ChangePopover
                  op={activeOp}
                  layout={layout}
                  requirements={plan.requirements}
                  anchorKey={activeLine.key}
                  onUndo={() => setActiveOpId(null)}
                  onClose={() => setActiveOpId(null)}
                />
              )}
            </ResultMargin>
          )}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {!compare && (
        <DecisionBar
          pending={pending[0] ?? null}
          index={total - pending.length + 1}
          total={total}
          onDecide={decide}
          ready={ready}
          coverage={coverage}
          pages={layout.pages}
          onDownload={download}
        />
      )}
    </div>
  );
}
