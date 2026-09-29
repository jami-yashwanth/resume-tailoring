"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FlowHeader } from "@/components/flow/FlowHeader";
import { ButtonLink } from "@/components/rezz/Button";
import { box, lead, offsetGap, offsetPage, title } from "@/components/rezz/skin";
import { session } from "@/lib/session";
import type { Stage } from "@/lib/tailor/pipeline";

/**
 * The ~15 seconds of work, shown as stages rather than a spinner.
 *
 * The spec asks for staged steps because they answer the question a spinner
 * leaves open: what is it doing to my resume? Each line ticks over as the
 * server reports it, so the wait is legible instead of merely tolerable.
 */

const STEPS: Array<{ stage: Stage; doing: string; done: string }> = [
  { stage: "reading_resume", doing: "Reading your resume", done: "Read your resume" },
  { stage: "reading_job", doing: "Reading the job", done: "Read the job" },
  { stage: "planning", doing: "Matching your experience", done: "Matched your experience" },
  { stage: "checking", doing: "Checking every claim", done: "Checked every claim" },
];

const ORDER = STEPS.map((s) => s.stage);

const page = "min-h-screen bg-paper-raised";
const column = "mx-auto max-w-[640px] px-16 pb-24 pt-16 max-[1100px]:px-8 max-[680px]:px-4";

export default function TailoringPage() {
  const router = useRouter();
  // Starts on the first stage rather than empty. Reading the resume genuinely
  // begins the moment this page mounts, and waiting for the server's first
  // event leaves a frame where four grey lines say nothing is happening.
  const [stage, setStage] = useState<Stage>("reading_resume");
  const [details, setDetails] = useState<Partial<Record<Stage, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // React runs effects twice in development. Without this the pipeline would
    // be billed twice on every page load.
    if (started.current) return;
    started.current = true;

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
            setStage(data.stage);
            if (data.detail) {
              setDetails((d) => ({ ...d, [data.stage as Stage]: data.detail }));
            }
          } else if (name === "done") {
            session.setResult(data);
            router.push("/result");
          } else if (name === "failed") {
            setError(data.message);
          }
        }
      }
    })();
  }, [router]);

  const current = ORDER.indexOf(stage);

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
      <main className={column}>
        <h1 className={title}>Tailoring your resume.</h1>
        <p className={`mt-6 ${lead}`}>
          About fifteen seconds. We keep your layout and mark every change.
        </p>

        {/* One drawn container; the stages inside stay hairlines. Four rows that
            tick over in sequence are something you read, not four things you
            act on, and drawing each one would make the wait louder than the
            work. */}
        <div className={`mt-10 ${box} ${offsetPage} rounded-md bg-paper-raised p-8 max-[680px]:p-6`}>
        <ol aria-live="polite" className="m-0 list-none p-0">
          {STEPS.map((step, index) => {
            const done = current > index;
            const active = current === index;
            return (
              <li
                key={step.stage}
                className="grid grid-cols-[20px_minmax(0,1fr)] items-baseline gap-3 border-b border-line py-3.5 last:border-b-0"
              >
                <span
                  aria-hidden
                  className={`font-mark text-[13px] leading-6 ${done ? "text-verified" : "text-ink-muted"}`}
                >
                  {done ? "✓" : active ? "·" : ""}
                </span>
                <span
                  className={`text-[15px] leading-6 ${done || active ? "text-ink" : "text-ink-muted opacity-60"}`}
                >
                  {done ? step.done : step.doing}
                  {details[step.stage] && (
                    <span className="text-ink-muted"> — {details[step.stage]}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        </div>
      </main>
    </div>
  );
}
