"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/rezz/Button";
import { Wordmark } from "@/components/rezz/Wordmark";
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
    `${finish.pages} page${finish.pages === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-[72px] max-w-[1312px] items-center justify-between px-16 max-[1100px]:px-8 max-[680px]:px-4">
          <Wordmark />
          <a href="/resumes" className="text-sm leading-[21px] text-ink-muted no-underline hover:underline">
            Your resumes
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-16 pb-24 pt-16 max-[1100px]:px-8 max-[680px]:px-4">
        <h1 className="m-0 text-[clamp(28px,3vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em]">
          Your resume is ready for {finish.company}.
        </h1>
        <p className="mt-4 max-w-[54ch] text-[17px] leading-7 text-ink-muted">
          Downloaded as <b className="font-semibold text-ink">{finish.filename}</b>. Same file,
          same design, same fonts — with the changes you approved.
        </p>

        {/* Counts, not a score. Each one is something the user can open the
            file and check for themselves. */}
        <ul className="mt-10 list-none border-t border-line p-0">
          {facts.map((fact) => (
            <li
              key={fact}
              className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 border-b border-line py-3.5"
            >
              <span aria-hidden className="font-mark text-[13px] leading-6 text-verified">
                ✓
              </span>
              <span className="text-[15px] leading-6">{fact}</span>
            </li>
          ))}
        </ul>

        {finish.added.length > 0 && (
          <section className="mt-14">
            <h2 className="m-0 text-[24px] font-semibold leading-8 tracking-[-0.02em]">
              Be ready for what you added.
            </h2>
            <p className="mt-3 max-w-[58ch] text-[15px] leading-6 text-ink-muted">
              You added {finish.added.length} line{finish.added.length === 1 ? "" : "s"} that
              {finish.added.length === 1 ? " wasn't" : " weren't"} in your resume before. A
              recruiter may ask about {finish.added.length === 1 ? "it" : "them"}, so here is what
              to expect and how to answer honestly.
            </p>

            {prep === null && (
              <p className="mt-6 text-[15px] leading-6 text-ink-muted">Preparing questions…</p>
            )}

            {prep?.map((item) => (
              <div key={item.line} className="mt-8 border-t border-line pt-6">
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
                <p className="mt-3 max-w-[60ch] rounded-md bg-paper-raised p-4 text-[15px] leading-6">
                  {item.honest}
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

        <div className="mt-14 flex items-center gap-4 border-t border-line pt-8 max-[680px]:flex-col max-[680px]:items-stretch">
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
          <ButtonLink href="/resumes" variant="secondary">
            See your resumes
          </ButtonLink>
        </div>
      </main>
    </>
  );
}
