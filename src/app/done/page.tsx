"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlowHeader } from "@/components/flow/FlowHeader";
import { Button } from "@/components/rezz/Button";
import { box, h3, lead, offsetAccent, offsetPage, title } from "@/components/rezz/skin";
import { type Finish, session } from "@/lib/session";
import type { PrepItem } from "@/lib/tailor/prep";

/**
 * The finish screen.
 *
 * It exists because a file dropping silently into Downloads is a poor place to
 * end. Three checkable facts, prep for every line the user chose to add, and
 * one obvious next action.
 *
 * The facts are counts, never a score — the same rule as the Result screen.
 * Nothing here is a prediction about whether they will get the job.
 */

const page = "min-h-screen bg-paper-raised";
const column = "mx-auto max-w-[760px] px-16 pb-24 pt-16 max-[1100px]:px-8 max-[680px]:px-4";

export default function DonePage() {
  const router = useRouter();
  const [finish, setFinish] = useState<Finish | null>(null);
  const [prep, setPrep] = useState<PrepItem[] | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const stored = session.getFinish();
    if (!stored) {
      router.replace(session.getResume() ? "/job" : "/upload");
      return;
    }
    setFinish(stored);
    setChecked(true);

    if (!stored.added.length) {
      setPrep([]);
      return;
    }
    fetch("/api/prep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations: stored.operations }),
    })
      .then((r) => r.json())
      .then((b) => setPrep(b.items ?? []))
      .catch(() => setPrep([]));
  }, [router]);

  if (!checked || !finish) return null;

  const facts = [
    `Covers ${finish.covered} of ${finish.total} requirements`,
    finish.reworded > 0 &&
      `${finish.reworded} line${finish.reworded === 1 ? "" : "s"} reworded from your own facts`,
    finish.added.length > 0 &&
      `${finish.added.length} line${finish.added.length === 1 ? "" : "s"} you added`,
    /* Removals were never reported anywhere. A fact list that counts what went
       in and stays quiet about what came out is not a fact list. */
    (finish.removed ?? 0) > 0 &&
      `${finish.removed} line${finish.removed === 1 ? "" : "s"} you removed to fit`,
    `${finish.pages} page${finish.pages === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];

  return (
    <div className={page}>
      <FlowHeader step="Done" />

      <main className={column}>
        <h1 className={title}>Your resume is ready for {finish.company}.</h1>
        {/* v1 override (28 Sep 2026, see CLAUDE.md): the download is one clean
            Rezz template, not the file they uploaded. This line used to promise
            "same file, same design, same fonts", which stopped being true the
            day the override landed. */}
        <p className={`mt-6 max-w-[54ch] ${lead}`}>
          Downloaded as <b className="font-semibold text-ink">{finish.filename}</b>. One clean
          Rezz template, your own words, and only the changes you approved.
        </p>

        {/* Counts, not a score. Each one is something the user can open the
            file and check for themselves. The block is drawn; the facts inside
            stay hairlines, because they are read rather than acted on. The
            highlighter offset is allowed here: this block is the promise kept. */}
        <div className={`mt-10 ${box} ${offsetAccent} rounded-md bg-paper-raised p-8 max-[680px]:p-6`}>
          <ul className="m-0 list-none p-0">
            {facts.map((fact) => (
              <li
                key={fact}
                className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 border-b border-line py-3.5 last:border-b-0"
              >
                <span aria-hidden className="font-mark text-[13px] leading-6 text-verified">
                  ✓
                </span>
                <span className="text-[15px] leading-6">{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        {finish.added.length > 0 && (
          <section className="mt-16">
            <h2 className={h3}>Be ready for what you added.</h2>
            <p className="mt-3 max-w-[58ch] text-[15px] leading-6 text-ink-muted">
              You added {finish.added.length} line{finish.added.length === 1 ? "" : "s"} that
              {finish.added.length === 1 ? " wasn't" : " weren't"} in your resume before. A
              recruiter may ask about {finish.added.length === 1 ? "it" : "them"}, so here is what
              to expect and how to answer honestly.
            </p>

            {prep === null && (
              <p className="mt-6 text-[15px] leading-6 text-ink-muted">Preparing questions…</p>
            )}

            {/* One drawn card per added line, the way the landing page draws each
                change: the line itself, then what it costs you to keep it. */}
            {prep?.map((item) => (
              <div
                key={item.line}
                className={`mt-6 ${box} ${offsetPage} rounded-md bg-paper-raised p-6`}
              >
                <p className="m-0 font-doc text-[15px] leading-[23px]">
                  <mark>{item.line}</mark>
                </p>
                <ul className="mt-4 list-none p-0">
                  {item.questions.map((q) => (
                    <li key={q} className="mb-2 grid grid-cols-[20px_minmax(0,1fr)] gap-3">
                      <span aria-hidden className="font-mark text-[13px] leading-6 text-ink-muted">
                        ?
                      </span>
                      <span className="text-[15px] leading-6">{q}</span>
                    </li>
                  ))}
                </ul>
                <p className="m-0 mt-4 border-t border-line pt-4 text-[15px] leading-6">
                  {item.honest}
                </p>
                <p className="mt-3 flex items-center gap-2 font-mark text-xs leading-4 text-verified before:h-[2px] before:w-[18px] before:bg-verified before:content-['']">
                  you chose to add this line
                </p>
              </div>
            ))}

            {prep?.length === 0 && finish.added.length > 0 && (
              <p className="mt-6 text-[15px] leading-6 text-ink-muted">
                Couldn&rsquo;t prepare questions this time. The lines you added are listed above —
                be ready to talk about what you actually know.
              </p>
            )}
          </section>
        )}

        <div className="mt-16 flex items-center gap-5 border-t-2 border-ink pt-10 max-[680px]:flex-col max-[680px]:items-stretch">
          <Button
            size="lg"
            onClick={() => {
              // The resume stays; only the job and its result go. This is the
              // one-step path for every job after the first.
              session.clearJob();
              router.push("/job");
            }}
          >
            Tailor for another job
          </Button>
        </div>
      </main>
    </div>
  );
}
