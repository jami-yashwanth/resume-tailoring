"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlowHeader } from "@/components/flow/FlowHeader";
import { Button } from "@/components/rezz/Button";
import { box, lead, offset, title } from "@/components/rezz/skin";
import { track } from "@/lib/analytics";
import { looksLikeUrl } from "@/lib/job-fetch";
import { session } from "@/lib/session";

/**
 * Add the job. Step two, and the only step for every job after the first.
 *
 * A textarea, because pasting a job description is what people actually do.
 * Screenshot, link and the Chrome extension are the other three routes in the
 * spec; this is the one that works without any of them.
 */
const MINIMUM = 50;

/* A flex column, so the textarea takes whatever height the window has left
   rather than a fixed 16 rows. At 100% zoom on a 768px laptop the fixed rows
   pushed "Tailor my resume" below the fold, on the one screen that is nothing
   but a field and a button. */
const page = "flex min-h-dvh flex-col bg-paper-raised dark:bg-paper";
const column = "mx-auto flex w-full flex-1 flex-col max-w-[720px] px-16 pt-[clamp(24px,6dvh,64px)] pb-[clamp(24px,6dvh,96px)] max-[1100px]:px-8 max-[680px]:px-4";

export default function JobPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    track("jd_submitted");
    session.setJob(text.trim());
    router.push("/tailoring");
  }

  // A lone pasted link is an offer, not a command: the fetched text fills the
  // textarea so the user sees and can edit exactly what will be used.
  const pastedUrl = looksLikeUrl(text) ? text.trim() : null;

  async function fetchPosting() {
    if (!pastedUrl || fetching) return;
    setFetching(true);
    setFetchError(null);
    try {
      const response = await fetch("/api/job-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pastedUrl }),
      });
      const body = await response.json();
      if (!response.ok) {
        setFetchError(body.error ?? "That page wouldn't let us read it — paste the description instead.");
        return;
      }
      track("jd_link_fetched");
      setText(body.text);
    } catch {
      setFetchError("That page wouldn't let us read it — paste the description instead.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className={page}>
      <FlowHeader step="Step 2 of 2" />
      <main className={column}>
        <h1 className={title}>Add the job.</h1>
        <p className={`mt-6 max-w-[54ch] ${lead}`}>
          Paste the description &mdash; or just the posting&rsquo;s link. We read what it asks for,
          then show you which of those your resume already covers.
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
          className={`mt-6 min-h-40 max-h-[520px] w-full flex-1 basis-0 resize-y rounded-md ${box} ${offset} bg-paper-raised p-4
                      font-ui text-[15px] leading-6 text-ink placeholder:text-ink-muted`}
        />

        {pastedUrl && (
          <div className="mt-4 flex items-center gap-4">
            <Button variant="secondary" onClick={() => void fetchPosting()} disabled={fetching}>
              {fetching ? "Reading that page…" : "Read the posting from that link"}
            </Button>
            <p className="m-0 text-sm leading-[21px] text-ink-muted">
              You&rsquo;ll see the text before anything happens.
            </p>
          </div>
        )}

        {fetchError && (
          <p role="alert" className="mt-4 max-w-[58ch] text-[15px] leading-6 font-semibold text-gap">
            {fetchError}
          </p>
        )}

        <div className="mt-8 flex items-center gap-5 max-[680px]:flex-col max-[680px]:items-stretch">
          <Button onClick={submit} disabled={short || Boolean(pastedUrl)} size="lg">
            Tailor my resume
          </Button>
          <p className="m-0 text-sm leading-[21px] text-ink-muted">
            {pastedUrl
              ? "Read the posting first, or paste its text."
              : short
                ? "Paste the job description to continue."
                : "About fifteen seconds. Nothing is added without your OK."}
          </p>
        </div>
      </main>
    </div>
  );
}
