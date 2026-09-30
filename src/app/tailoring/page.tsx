"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlowHeader } from "@/components/flow/FlowHeader";
import { TailoringSheet } from "@/components/flow/TailoringSheet";
import { ButtonLink } from "@/components/rezz/Button";
import { box, lead, offsetGap, offsetPage, title } from "@/components/rezz/skin";
import { track } from "@/lib/analytics";
import { session } from "@/lib/session";
import type { Stage } from "@/lib/tailor/pipeline";

/**
 * The ~15 seconds of work, shown as stages rather than a spinner.
 *
 * The spec asks for staged steps because they answer the question a spinner
 * leaves open: what is it doing to my resume? Each line ticks over as the
 * server reports it, so the wait is legible instead of merely tolerable.
 *
 * Server events are queued and each stage is held on screen for at least
 * DWELL. Reading the resume can finish in a fraction of a second, and a tick
 * that lands and moves on before anyone can read it is the flicker this
 * screen exists to avoid. The hold only costs time when the server is faster
 * than the screen — at most about a second on a real run.
 */

const STEPS: Array<{ stage: Stage; doing: string; done: string }> = [
  { stage: "reading_resume", doing: "Reading your resume", done: "Read your resume" },
  { stage: "reading_job", doing: "Reading the job", done: "Read the job" },
  { stage: "planning", doing: "Matching your experience", done: "Matched your experience" },
  { stage: "checking", doing: "Checking every claim", done: "Checked every claim" },
];

const ORDER = STEPS.map((s) => s.stage);

/** "done" sits one past the last step, so every row reads as finished. */
const indexOf = (stage: Stage) => (stage === "done" ? STEPS.length : ORDER.indexOf(stage));

/** Minimum time a stage stays on screen before the next one may replace it. */
const DWELL = 600;
/** The screen's fade-out before the result opens: the house 150ms. */
const LEAVE = 150;

type Incoming =
  | { kind: "progress"; stage: Stage; detail?: string }
  | { kind: "done"; data: unknown }
  | { kind: "failed"; message: string };

const count = (detail: string | undefined, pattern: RegExp) => {
  const match = detail?.match(pattern);
  return match ? Number(match[1]) : null;
};

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const page = "min-h-screen bg-paper-raised dark:bg-paper";
const column = "mx-auto max-w-[640px] px-16 pt-[clamp(24px,6dvh,64px)] pb-[clamp(24px,6dvh,96px)] max-[1100px]:px-8 max-[680px]:px-4";
const wide = "mx-auto max-w-[1120px] px-16 pt-[clamp(24px,6dvh,64px)] pb-[clamp(24px,6dvh,96px)] max-[1100px]:px-8 max-[680px]:px-4";

export default function TailoringPage() {
  const router = useRouter();
  // Starts on the first stage rather than empty. Reading the resume genuinely
  // begins the moment this page mounts, and waiting for the server's first
  // event leaves a frame where four grey lines say nothing is happening.
  const [stage, setStage] = useState<Stage>("reading_resume");
  const [details, setDetails] = useState<Partial<Record<Stage, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);

  const queue = useRef<Incoming[]>([]);
  const timer = useRef<number | null>(null);
  const shown = useRef<Stage>("reading_resume");
  const lastShift = useRef(0);

  const apply = useCallback(
    (event: Incoming) => {
      if (event.kind === "progress") {
        if (event.stage !== shown.current) {
          shown.current = event.stage;
          lastShift.current = performance.now();
          setStage(event.stage);
        }
        if (event.detail) setDetails((d) => ({ ...d, [event.stage]: event.detail }));
      } else if (event.kind === "done") {
        track("tailor_done");
        // setResult says whether the result actually survived the write —
        // layout + plan share the resume's sessionStorage quota, and a
        // silently lost result used to bounce the user back to /job with no
        // explanation.
        if (!session.setResult(event.data as Parameters<typeof session.setResult>[0])) {
          setError(
            "Your tailored result is ready, but this browser couldn't hold it for the next screen. " +
              "Free some space or use a regular window, then tailor again.",
          );
          return;
        }
        setLeaving(true);
        window.setTimeout(() => router.push("/result"), LEAVE);
      } else {
        track("tailor_failed");
        setError(event.message);
      }
    },
    [router],
  );

  // Applies queued events in order. A detail on the stage already showing
  // applies at once; anything that moves the screen on waits out DWELL.
  const pump = useCallback(() => {
    if (timer.current !== null) return;
    const next = queue.current[0];
    if (!next) return;
    const shifts =
      next.kind === "done" || (next.kind === "progress" && next.stage !== shown.current);
    const wait =
      next.kind === "failed" || !shifts
        ? 0
        : Math.max(0, lastShift.current + DWELL - performance.now());
    timer.current = window.setTimeout(() => {
      timer.current = null;
      queue.current.shift();
      apply(next);
      pump();
    }, wait);
  }, [apply]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  const current = indexOf(stage);
  const finished = current >= STEPS.length;

  // Elapsed time, beside the "about fifteen seconds" it is measured against.
  // Stops when the work does, so the last number shown is the real one.
  useEffect(() => {
    if (finished || error) return;
    const begun = performance.now() - elapsed * 1000;
    const tick = window.setInterval(
      () => setElapsed(Math.floor((performance.now() - begun) / 1000)),
      1000,
    );
    return () => window.clearInterval(tick);
    // `elapsed` is read once to resume from, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, error]);

  useEffect(() => {
    // React runs effects twice in development. Without this the pipeline would
    // be billed twice on every page load.
    if (started.current) return;
    started.current = true;
    lastShift.current = performance.now();

    const resume = session.getResume();
    const jobDescription = session.getJob();
    const filename = session.getFilename();
    if (!resume || !jobDescription) {
      router.replace(resume ? "/job" : "/upload");
      return;
    }

    (async () => {
      const response = await fetch("/api/tailor/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobDescription, filename }),
      }).catch(() => null);

      if (!response?.ok || !response.body) {
        const message = await response?.json().catch(() => null);
        setError(message?.error ?? "Could not reach the tailoring service.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Server-sent events arrive as "event: x\ndata: y\n\n", and a chunk can
      // split one in half, so events are only parsed once a blank line lands.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let split: number;
        while ((split = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);

          const name = frame.match(/^event: (.+)$/m)?.[1];
          const payload = frame.match(/^data: (.+)$/m)?.[1];
          if (!name || !payload) continue;
          const data = JSON.parse(payload);

          if (name === "progress") {
            queue.current.push({ kind: "progress", stage: data.stage, detail: data.detail });
          } else if (name === "done") {
            queue.current.push({ kind: "done", data });
          } else if (name === "failed") {
            queue.current = [{ kind: "failed", message: data.message }];
          }
          pump();
        }
      }
    })();
  }, [router, pump]);

  if (error) {
    return (
      <div className={page}>
        <FlowHeader step="Something went wrong" />
        <main className={column}>
          <h1 className={title}>Tailoring stopped.</h1>
          {/* The corrector's red, the same box the landing page gives the one
              thing that needs the user. A failure is exactly that. */}
          <div className={`mt-8 rounded-md border-2 border-gap bg-paper-raised p-6 ${offsetGap}`}>
            <p className="m-0 max-w-[58ch] text-[15px] leading-6">{error}</p>
            <p className="mt-3 flex items-center gap-2 font-mark text-xs leading-4 text-gap before:h-[2px] before:w-[18px] before:bg-gap before:content-['']">
              your resume and the job are still here
            </p>
          </div>
          <div className="mt-8">
            <ButtonLink href="/job">Back to the job</ButtonLink>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={page}>
      <FlowHeader step="Tailoring" />
      <main
        className={`${wide} transition-opacity duration-150 ease-out ${leaving ? "opacity-0" : "opacity-100"}`}
      >
        <h1 className={title}>Tailoring your resume.</h1>
        <p className={`mt-6 short:mt-4 ${lead}`}>
          About fifteen seconds. We keep your layout and mark every change.
        </p>

        <div className="mt-10 short:mt-7 grid grid-cols-[minmax(0,560px)_minmax(0,1fr)] items-start gap-12 max-[1100px]:grid-cols-1">
          {/* The document being worked on. Hidden on narrow screens, where the
              margin marks have no margin to hang in; the stages say it all.
              The sheet is a fixed drawing (~500px tall), so on short windows it
              is zoomed rather than cropped: at 100% on a 768px laptop it alone
              pushed the page past the fold. It is aria-hidden decoration, and
              the stages beside it keep their real size. */}
          <div className="max-[680px]:hidden short:[zoom:0.85] [@media(max-height:700px)]:[zoom:0.72]">
            <TailoringSheet
              current={current}
              requirements={count(details.reading_job, /(\d+) requirements?/)}
              drafted={count(details.planning, /(\d+) changes?/)}
              rejected={count(details.checking, /(\d+) rejected/)}
            />
          </div>

          {/* One drawn container; the stages inside stay hairlines. Four rows
              that tick over in sequence are something you read, not four
              things you act on, and drawing each one would make the wait
              louder than the work. */}
          <div className={`${box} ${offsetPage} rounded-md bg-paper-raised p-8 short:px-8 short:py-5 max-[680px]:p-6`}>
            <ol aria-live="polite" className="m-0 list-none p-0">
              {STEPS.map((step, index) => {
                const done = current > index;
                const active = current === index;
                const detail = details[step.stage];
                return (
                  <li
                    key={step.stage}
                    className="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-3 border-b border-line py-3.5 short:py-2.5 last:border-b-0"
                  >
                    <Indicator state={done ? "done" : active ? "active" : "pending"} />
                    <span
                      className={`text-[15px] leading-6 transition-colors duration-150 ${
                        done || active ? "text-ink" : "text-ink-muted/60"
                      }`}
                    >
                      {done ? step.done : step.doing}
                      {detail && (
                        <span key={detail} className="tailor-fade text-ink-muted">
                          {" "}
                          — {detail}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p aria-hidden className="mb-0 mt-5 border-t border-line pt-4 font-mark text-xs leading-4 text-ink-muted">
              {clock(elapsed)} {finished ? "· done" : "so far"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Pending is a faint outline, running is an ink ring with a slow pulse, done
 * is a check. All three sit in one cell and crossfade, so a stage finishing
 * reads as the ring becoming a tick rather than one glyph replacing another.
 */
function Indicator({ state }: { state: "pending" | "active" | "done" }) {
  const layer = "col-start-1 row-start-1 transition-opacity duration-150 ease-out";
  return (
    <span aria-hidden className="grid size-5 place-items-center">
      <span
        className={`${layer} size-2.5 rounded-full border border-line-strong ${state === "pending" ? "opacity-60" : "opacity-0"}`}
      />
      <span
        className={`${layer} size-3 rounded-full border-2 border-ink ${state === "active" ? "tailor-ring opacity-100" : "opacity-0"}`}
      />
      <span
        className={`${layer} font-mark text-[13px] leading-none text-verified ${state === "done" ? "opacity-100" : "opacity-0"}`}
      >
        ✓
      </span>
    </span>
  );
}
