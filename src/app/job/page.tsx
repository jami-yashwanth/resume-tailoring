"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlowHeader } from "@/components/flow/FlowHeader";
import { Button } from "@/components/rezz/Button";
import { session } from "@/lib/session";

/**
 * Add the job. Step two, and the only step for every job after the first.
 *
 * A textarea, because pasting a job description is what people actually do.
 * Screenshot, link and the Chrome extension are the other three routes in the
 * spec; this is the one that works without any of them.
 */
const MINIMUM = 50;

export default function JobPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // No resume means this page was opened directly; send them to step one
    // rather than letting them write a job description into nothing.
    if (!session.getResume()) {
      router.replace("/upload");
      return;
    }
    setFilename(session.getFilename());
    setText(session.getJob() ?? "");
    setChecked(true);
  }, [router]);

  if (!checked) return null;

  const short = text.trim().length < MINIMUM;

  function submit() {
    if (short) return;
    session.setJob(text.trim());
    router.push("/tailoring");
  }

  return (
    <>
      <FlowHeader step="Step 2 of 2" />
      <main className="mx-auto max-w-[720px] px-16 pt-16 max-[1100px]:px-8 max-[680px]:px-4">
        <h1 className="m-0 text-[clamp(28px,3vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em]">
          Add the job.
        </h1>
        <p className="mt-4 max-w-[54ch] text-[17px] leading-7 text-ink-muted">
          Paste the description. We read what it asks for, then show you which of those your
          resume already covers.
        </p>

        {filename && (
          <p className="mt-6 text-sm leading-[21px] text-ink-muted">
            Tailoring <b className="font-semibold text-ink">{filename}</b>.{" "}
            <a href="/upload">Use a different file</a>
          </p>
        )}

        <label htmlFor="jd" className="sr-only">
          Job description
        </label>
        <textarea
          id="jd"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          placeholder="Paste the whole job posting — requirements, responsibilities, everything."
          className="mt-6 w-full resize-y rounded-lg border border-line-strong bg-paper-raised p-4
                     font-ui text-[15px] leading-6 text-ink placeholder:text-ink-muted"
        />

        <div className="mt-6 flex items-center gap-4 max-[680px]:flex-col max-[680px]:items-stretch">
          <Button onClick={submit} disabled={short} size="lg">
            Tailor my resume
          </Button>
          <p className="m-0 text-sm leading-[21px] text-ink-muted">
            {short
              ? "Paste the job description to continue."
              : "About fifteen seconds. Nothing is added without your OK."}
          </p>
        </div>
      </main>
    </>
  );
}
