"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlowHeader } from "@/components/flow/FlowHeader";
import { Button } from "@/components/rezz/Button";
import { box, lead, offset, title } from "@/components/rezz/skin";
import { session } from "@/lib/session";

/**
 * Add the job. Step two, and the only step for every job after the first.
 *
 * A textarea, because pasting a job description is what people actually do.
 * Screenshot, link and the Chrome extension are the other three routes in the
 * spec; this is the one that works without any of them.
 */
const MINIMUM = 50;

const page = "min-h-screen bg-paper-raised";
const column = "mx-auto max-w-[720px] px-16 pb-24 pt-16 max-[1100px]:px-8 max-[680px]:px-4";

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
    <div className={page}>
      <FlowHeader step="Step 2 of 2" />
      <main className={column}>
        <h1 className={title}>Add the job.</h1>
        <p className={`mt-6 max-w-[54ch] ${lead}`}>
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
        {/* 4px, not 8px: you act on this one. The offset is the whole reason the
            field reads as a control on a screen where nothing else is bordered. */}
        <textarea
          id="jd"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          placeholder="Paste the whole job posting — requirements, responsibilities, everything."
          className={`mt-6 w-full resize-y rounded-md ${box} ${offset} bg-paper-raised p-4
                      font-ui text-[15px] leading-6 text-ink placeholder:text-ink-muted`}
        />

        <div className="mt-8 flex items-center gap-5 max-[680px]:flex-col max-[680px]:items-stretch">
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
    </div>
  );
}
