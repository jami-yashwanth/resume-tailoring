"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/rezz/Button";
import { Wordmark } from "@/components/rezz/Wordmark";
import { box, offset } from "@/components/rezz/skin";
import { session } from "@/lib/session";
import { coverageOf, pendingDecisions } from "@/lib/tailor/coverage";
import type { Layout, PlannedOp, TailorPlan } from "@/lib/tailor/types";
import {
  type Decisions,
  type Wordings,
  anchorLabel,
  buildLines,
  wordingFor,
  wordingOptions,
} from "@/lib/tailor/view";
import { ChangePopover } from "./ChangePopover";
import { DecisionBar } from "./DecisionBar";
import { DefaultTemplateSheet } from "./DefaultTemplateSheet";
import { JobPanel } from "./JobPanel";
import { type PageFitOption, PageFitPrompt } from "./PageFitPrompt";
import { ResultMargin } from "./ResultMargin";

/**
 * The Result screen: see the value → make 0–3 decisions → finish.
 *
 * One bar of chrome, three columns, one decision at a time. State lives here
 * because every part of the screen moves together: a decision changes the
 * document, the margin, the coverage count and the bottom bar at once.
 *
 * Every change the user can make is a key in `decisions` or `wordings`, and
 * both are written to sessionStorage — a refresh used to silently re-ask every
 * question, including the ones already skipped.
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
  /* Read once, at the first render, rather than in an effect: an effect that
     hydrates and an effect that persists run in the same commit, so the
     persisting one wrote the empty initial state back over what the other had
     just read. This component only ever mounts in the browser — the loader
     renders a placeholder until the session has been read — so a lazy
     initialiser is safe here. */
  const [restored] = useState(() => session.getDecisions());
  const [decisions, setDecisions] = useState<Decisions>(() => restored?.decisions ?? {});
  const [wordings, setWordings] = useState<Wordings>(() => restored?.wordings ?? {});
  const [activeOpId, setActiveOpId] = useState<string | null>(null);
  const [selectedRequirement, setSelectedRequirement] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [downloading, setDownloading] = useState(false);
  /* What the tailored document actually comes to, measured by the preview
     against the renderer's own page-break rule. `layout.pages` is the file
     the user uploaded, which is a different document and was what this
     screen used to report. */
  const [pageCount, setPageCount] = useState(1);
  const [visiblePage, setVisiblePage] = useState(1);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  /* How long the document is allowed to be. Set from the first measurement —
     what the tailoring came to before the user decided anything — and raised
     only when they say so. */
  const [pagesAllowed, setPagesAllowed] = useState<number | null>(
    () => restored?.pagesAllowed ?? null,
  );
  const [growthAllowed, setGrowthAllowed] = useState(() => restored?.growthAllowed ?? false);

  useEffect(() => {
    session.setDecisions({ decisions, wordings, pagesAllowed, growthAllowed });
  }, [decisions, wordings, pagesAllowed, growthAllowed]);

  const operations = useMemo(
    () => plan.operations.map((op) => ({ ...op, approved: decisions[op.id] })),
    [plan.operations, decisions],
  );

  const lines = useMemo(
    () => buildLines(layout, operations, decisions, compare, wordings),
    [layout, operations, decisions, compare, wordings],
  );

  // Always the tailored version, independent of the "Compare wording" toggle
  // above — a download must reflect the user's decisions, not whichever
  // preview mode they happen to be looking at.
  const downloadLines = useMemo(
    () => buildLines(layout, operations, decisions, false, wordings),
    [layout, operations, decisions, wordings],
  );

  const coverage = coverageOf(plan.requirements, plan.matches, operations);
  const pending = pendingDecisions(operations);
  const total = plan.operations.filter((op) => op.needsDecision).length;
  /* Counted off the operation, not the claim level: the document marks a line
     "Reworded" when the op is a rephrase, and a count that reads the claim
     instead reported zero for a line the screen had visibly highlighted. */
  const reworded = operations.filter(
    (op) => op.op === "rephrase" && op.approved !== false,
  ).length;
  const removed = operations.filter((op) => op.op === "remove" && op.approved === true).length;
  const added = operations.filter((op) => op.claim === "added_by_user" && op.approved === true)
    .length;
  const ready = pending.length === 0;

  /** What a drafted line is about, for copy that means something out of context. */
  const skillOf = useCallback(
    (op: PlannedOp | null) => {
      if (!op) return null;
      const labels = plan.requirements
        .filter((r) => op.requirements.includes(r.id))
        .map((r) => r.label);
      return labels.length ? labels.join(" and ") : null;
    },
    [plan.requirements],
  );

  function decide(opId: string, approved: boolean) {
    const op = plan.operations.find((o) => o.id === opId) ?? null;
    const left = pending.length - 1;
    const skill = skillOf(op);
    setDecisions((previous) => ({ ...previous, [opId]: approved }));
    setActiveOpId(null);
    // Polite live region, per the spec: name the skill, then what remains.
    setAnnouncement(
      `${skill ? `${skill} line` : "Line"} ${approved ? "added" : "skipped"}. ${
        left === 0 ? "No decisions left." : `${left} decision${left === 1 ? "" : "s"} left.`
      }`,
    );
    if (approved) setSelectedRequirement(null);
  }

  const onPageCount = useCallback((count: number) => {
    setPageCount(count);
    // The first measurement is the tailoring as planned — the length the user
    // is agreeing to before they have changed anything.
    setPagesAllowed((allowed) => allowed ?? count);
  }, []);

  /** Close the popover and put focus back where it came from. */
  const closePopover = useCallback((lineKey?: string) => {
    setActiveOpId(null);
    if (lineKey) document.getElementById(lineKey)?.focus();
  }, []);

  /**
   * Render the user's decisions into the one default Rezz template and hand
   * them the PDF.
   *
   * v1 override (28 Sep 2026, see CLAUDE.md): this used to send the file
   * itself to be edited in place. Now the client resolves the final content
   * — skipped lines and lines the user agreed to drop are excluded here, so a
   * line that was skipped cannot arrive in the document by some later accident
   * of state — and only that resolved (kind, text) list crosses the wire.
   */
  async function download() {
    if (!resume) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blocks = downloadLines
        .filter((line) => line.state !== "removed" && line.state !== "pending")
        .map((line) => ({ kind: line.kind, text: line.text }));

      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });

      // Read the status before the body: a gateway's HTML 502 used to surface
      // to the user as "Unexpected token '<'".
      if (!response.ok) {
        let message = "Could not write your file.";
        try {
          message = (await response.json()).error ?? message;
        } catch {
          /* Not JSON. The status is all we know, and the default says it. */
        }
        throw new Error(message);
      }

      const body = await response.json();
      if (typeof body.file !== "string") throw new Error("Could not write your file.");

      const bytes = Uint8Array.from(atob(body.file), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const name = `${safeName(filename ?? "resume").replace(/\.(docx|pdf)$/i, "")} — ${safeName(company)}.pdf`;
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      // In the document and revoked a tick later: a detached anchor and an
      // immediate revoke is a known way to lose the file in some browsers.
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      // Hand the finish screen what actually happened, rather than making it
      // re-derive counts from state the user is about to navigate away from.
      session.setFinish({
        filename: name,
        company,
        role,
        pages: body.pages ?? pageCount,
        pagesBefore: layout.pages,
        covered: coverage.covered,
        total: coverage.total,
        originalCovered: coverage.originalCovered,
        reworded,
        removed,
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
  const grown = pagesAllowed !== null && pageCount > pagesAllowed;
  const status = [
    reworded > 0 && `${reworded} line${reworded === 1 ? "" : "s"} reworded from your own facts.`,
    added > 0 && `${added} line${added === 1 ? "" : "s"} you added.`,
    removed > 0 && `${removed} line${removed === 1 ? "" : "s"} you removed to fit.`,
    pending.length > 0
      ? `${pending.length} line${pending.length === 1 ? "" : "s"} ${
          pending.length === 1 ? "needs" : "need"
        } your OK.`
      : total > 0 && "All decisions made.",
    grown && growthAllowed && `Now ${pageCount} pages, as you allowed.`,
    reworded === 0 && total === 0 && "Your resume already covers what this job asks for.",
  ]
    .filter(Boolean)
    .join(" ");

  /* A real tailoring whose file has gone from session storage — a quota
     failure on upload, or another tab. Not the sample, which says its own
     thing. */
  const missingFile = !sample && !resume;

  const activeOp = operations.find((op) => op.id === activeOpId) ?? null;
  const activeLine = lines.find((line) => line.opId === activeOpId);

  const highlightBlocks = useMemo(() => {
    if (!selectedRequirement) return null;
    const match = plan.matches.find((m) => m.requirementId === selectedRequirement);
    const fromOps = operations
      .filter((op) => op.requirements.includes(selectedRequirement))
      .map((op) => op.block);
    const blocks = [...(match?.evidence ?? []), ...fromOps];
    // Nothing to point at: leave the page alone rather than dimming all of it
    // to highlight nothing.
    return blocks.length ? blocks : null;
  }, [selectedRequirement, plan.matches, operations]);

  // The document outgrew what the user agreed to. Ask, rather than quietly
  // dropping one of their own lines to make it fit.
  const lastChanged = [...lines]
    .reverse()
    .find((line) => line.state === "added" || line.state === "reworded");
  const pageFit =
    grown && !growthAllowed && !compare && lastChanged
      ? {
          anchorKey: lastChanged.key,
          options: pageFitOptions({
            operations,
            layout,
            wordings,
            changedOpId: lastChanged.opId,
            pages: pageCount,
          }),
        }
      : null;

  function choosePageFit(optionId: string) {
    const [kind, id] = optionId.split(":");
    if (kind === "remove") {
      setDecisions((previous) => ({ ...previous, [id]: true }));
      setAnnouncement("Line removed to fit. Your resume is back to one page.");
    } else if (kind === "shorter") {
      const op = operations.find((o) => o.id === id);
      if (op) {
        const options = wordingOptions(op);
        const current = wordings[op.id] ?? 0;
        const shorter = shorterWording(options, current);
        if (shorter !== null) setWordings((previous) => ({ ...previous, [op.id]: shorter }));
      }
      setAnnouncement("Using a shorter wording.");
    } else {
      setGrowthAllowed(true);
      setAnnouncement(`Keeping everything. Your resume is now ${pageCount} pages.`);
    }
  }

  const pendingOp = pending[0] ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* One bar of chrome. The header and the status line are the same row:
          two stacked bars was the v1 mistake. */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 border-b-2 border-ink bg-paper-raised px-8 py-3 max-[900px]:grid-cols-1 max-[900px]:gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <span className={`inline-flex flex-none items-center ${box} rounded-md bg-paper-raised px-3 py-1.5 ${offset}`}>
              <Wordmark />
            </span>
            <h1 className="m-0 truncate text-[15px] font-semibold leading-[21px]">
              {role}, {company}
            </h1>
          </div>
          {/* Not a live region: the sr-only one below announces decisions, and
              two of them meant a screen reader heard every decision twice. */}
          <p className="m-0 mt-px text-[13px] leading-[18px] text-ink-muted">
            {compare ? "Showing your original wording in the Rezz template." : status}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[13px] leading-[18px] text-ink-muted">
            Page {Math.min(visiblePage, pageCount)} of {pageCount}
          </span>
          <button
            type="button"
            aria-pressed={compare}
            onClick={() => {
              setCompare((v) => !v);
              setActiveOpId(null);
            }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md ${box} ${offset}
                        bg-paper-raised py-0 pl-3 pr-4 font-ui text-sm font-medium leading-5 text-ink
                        transition-[box-shadow,transform] duration-150
                        hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--ink)]`}
          >
            <span
              aria-hidden
              className={`relative h-4 w-7 flex-none rounded-full transition-colors duration-150
                          ${compare ? "bg-ink" : "bg-line-strong"}`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-paper-raised transition-all duration-150
                            ${compare ? "left-[14px]" : "left-0.5"}`}
              />
            </span>
            Compare wording
          </button>
          {/* Always secondary: when the screen is ready the bar below carries
              the one primary, and two primaries is two answers to "what now". */}
          <Button variant="secondary" onClick={download} disabled={!resume || downloading}>
            {downloading ? "Writing your file…" : "Download resume"}
          </Button>
        </div>
      </header>

      {/* Why the Download button is not going to work. It used to be greyed out
          with nothing said, which is a dead end the user cannot diagnose: the
          file lives in this browser's session storage, and that can be gone
          without anything having visibly happened. */}
      {(sample || missingFile || downloadError) && (
        <p
          role={downloadError ? "alert" : undefined}
          className={`px-8 py-2 text-[13px] leading-[18px] ${
            downloadError
              ? "border-b-2 border-gap bg-gap-soft font-semibold text-gap"
              : "border-b border-line bg-paper-raised text-ink-muted"
          }`}
        >
          {downloadError ??
            (sample ? (
              <>
                Showing a saved sample tailoring. <a href="/upload">Tailor your own resume</a> to
                download a file.
              </>
            ) : (
              <>
                Your decisions are safe, but this browser no longer has your file, so we
                can&rsquo;t write the download. <a href="/upload">Upload it again</a> to finish.
              </>
            ))}
        </p>
      )}

      {/* 794px is A4's 595.28pt at 96dpi — the page `template_render.py` draws,
          at its true size. It is a ceiling rather than a fixed width: below
          ~1490px the track gives way to the two panels and the page renders a
          little under true size, keeping its proportions either way. The 620px
          in docs/03-ux-result-screen.md is superseded — a sheet narrower than
          the page broke lines the downloaded file does not break, which made
          the preview argue with the PDF. */}
      <div
        className="grid flex-1 justify-center gap-8 overflow-y-auto bg-paper-sunken px-8 pt-8
                   [grid-template-columns:264px_minmax(0,794px)_300px]
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

        <DefaultTemplateSheet
          layout={layout}
          lines={lines}
          activeOpId={activeOpId}
          highlightBlocks={highlightBlocks}
          onSelect={(opId) => setActiveOpId((current) => (current === opId ? null : opId))}
          onPageCount={onPageCount}
          onVisiblePage={setVisiblePage}
        />

        <div className="max-[1240px]:hidden">
          {!compare && (
            <ResultMargin
              lines={lines}
              operations={operations}
              activeOpId={activeOpId}
              onSelect={setActiveOpId}
            >
              {/* One floating thing at a time in the margin. The page-fit
                  question is the one that needs answering, so it wins. */}
              {activeOp && activeLine && !pageFit && (
                <ChangePopover
                  op={activeOp}
                  state={activeLine.state}
                  layout={layout}
                  requirements={plan.requirements}
                  anchorKey={activeLine.key}
                  wordingIndex={(wordings[activeOp.id] ?? 0) % Math.max(1, wordingOptions(activeOp).length)}
                  wordingCount={wordingOptions(activeOp).length}
                  onUndo={() => {
                    setDecisions((previous) => ({ ...previous, [activeOp.id]: false }));
                    setAnnouncement("Rewording undone. Your original line is back.");
                    closePopover(activeLine.key);
                  }}
                  onRedo={() => {
                    setDecisions((previous) => ({ ...previous, [activeOp.id]: undefined }));
                    setAnnouncement("Reworded line restored.");
                    closePopover(activeLine.key);
                  }}
                  onTryAnotherWording={() =>
                    setWordings((previous) => ({
                      ...previous,
                      [activeOp.id]: (previous[activeOp.id] ?? 0) + 1,
                    }))
                  }
                  onKeepLine={() => {
                    setDecisions((previous) => ({ ...previous, [activeOp.id]: false }));
                    setGrowthAllowed(true);
                    setAnnouncement("Line kept. Your resume may run longer.");
                    closePopover(activeLine.key);
                  }}
                  onClose={() => closePopover(activeLine.key)}
                />
              )}
              {pageFit && (
                <PageFitPrompt
                  anchorKey={pageFit.anchorKey}
                  pages={pageCount}
                  allowed={pagesAllowed ?? pageCount}
                  options={pageFit.options}
                  onChoose={choosePageFit}
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
          pending={pendingOp}
          text={pendingOp ? wordingFor(pendingOp, wordings) : ""}
          skill={skillOf(pendingOp)}
          where={pendingOp ? anchorLabel(layout, pendingOp.block) : null}
          index={total - pending.length + 1}
          total={total}
          onDecide={decide}
          ready={ready}
          coverage={coverage}
          pages={pageCount}
          onDownload={download}
          canDownload={Boolean(resume)}
          downloading={downloading}
        />
      )}
    </div>
  );
}

/** A shorter way of saying the same thing, if the planner offered one. */
function shorterWording(options: string[], current: number): number | null {
  const now = options[current]?.length ?? 0;
  let best: number | null = null;
  options.forEach((text, index) => {
    if (index === current || text.length >= now) return;
    if (best === null || text.length < options[best].length) best = index;
  });
  return best;
}

/**
 * The ways out of "this no longer fits", cheapest to the user first.
 *
 * "Swap first, grow last" — but every swap is one of the user's own lines, so
 * each one is named, quoted, and chosen rather than applied.
 */
function pageFitOptions({
  operations,
  layout,
  wordings,
  changedOpId,
  pages,
}: {
  operations: PlannedOp[];
  layout: Layout;
  wordings: Wordings;
  changedOpId?: string;
  pages: number;
}): PageFitOption[] {
  const options: PageFitOption[] = [];

  const changed = operations.find((op) => op.id === changedOpId);
  if (changed) {
    const wordingList = wordingOptions(changed);
    const shorter = shorterWording(wordingList, wordings[changed.id] ?? 0);
    if (shorter !== null) {
      options.push({
        id: `shorter:${changed.id}`,
        label: "Say it more briefly",
        quote: wordingList[shorter],
        verb: "Use the shorter wording",
      });
    }
  }

  const removable = operations
    .filter((op) => op.op === "remove" && op.approved === undefined)
    .sort((a, b) => a.value - b.value)
    .slice(0, 2);

  removable.forEach((op, index) => {
    options.push({
      id: `remove:${op.id}`,
      label: index === 0 ? "Remove the least relevant line" : "Remove a different line",
      quote: layout.blocks.find((b) => b.id === op.block)?.text,
      verb: "Remove that line",
    });
  });

  options.push({
    id: "grow",
    label: `Keep everything, allow ${pages} pages`,
    verb: `Allow ${pages} pages`,
  });

  return options;
}

/** Nothing from a job posting goes into a filename unfiltered. */
function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim() || "resume";
}
