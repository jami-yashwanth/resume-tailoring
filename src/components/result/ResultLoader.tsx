"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ResumeSheet } from "@/components/rezz/ResumeSheet";
import { session } from "@/lib/session";
import type { Layout, Outline, TailorPlan } from "@/lib/tailor/types";
import { ResultScreen } from "./ResultScreen";

/**
 * Prefers a real tailoring from this session; falls back to the saved sample.
 *
 * The fallback is what makes the screen reviewable without running the whole
 * flow, and it is genuine planner output rather than hand-written data, so
 * reviewing it means reviewing the real thing.
 *
 * With neither, this used to render nothing at all — for ever. Every other
 * screen in the flow sends you where you can actually do something, and so
 * does this one now.
 */
export function ResultLoader({
  fallback,
}: {
  fallback: { layout: Layout; plan: TailorPlan; outline?: Outline | null } | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<{
    layout: Layout;
    plan: TailorPlan;
    outline: Outline | null;
    resume: string | null;
    filename: string | null;
    sample: boolean;
  } | null>(null);

  useEffect(() => {
    const stored = session.getResult();
    if (stored) {
      setState({
        ...stored,
        outline: stored.outline ?? null,
        resume: session.getResume(),
        filename: session.getFilename(),
        sample: false,
      });
      return;
    }
    if (fallback) {
      setState({ ...fallback, outline: fallback.outline ?? null, resume: null, filename: null, sample: true });
      return;
    }
    router.replace(session.getResume() ? "/job" : "/upload");
  }, [fallback, router]);

  if (!state) return <OpeningResume />;

  return (
    <ResultScreen
      layout={state.layout}
      plan={state.plan}
      outline={state.outline}
      resume={state.resume}
      filename={state.filename}
      sample={state.sample}
      role={state.plan.role || "the role"}
      company={state.plan.company || "this job"}
    />
  );
}

/** The page's shape while the browser reads the session, so the first paint is
 *  the screen arriving rather than a white flash. */
function OpeningResume() {
  return (
    <div className="flex h-screen items-start justify-center bg-paper-sunken p-8">
      <div className="w-full max-w-[794px]" aria-hidden>
        <ResumeSheet font="template">
          <span />
        </ResumeSheet>
      </div>
      <p className="sr-only" role="status">
        Opening your resume.
      </p>
    </div>
  );
}
