"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FlowHeader } from "@/components/flow/FlowHeader";
import { Button } from "@/components/rezz/Button";
import { session } from "@/lib/session";

/**
 * Upload your resume. Step one, and only the first time.
 *
 * One drop zone, no account, nothing to configure. The file is read in the
 * browser and sent to be parsed — which is also the honest check's first job.
 * A file we cannot read is named here, not fifteen seconds into a tailoring.
 *
 * DOCX only for now, said on the screen rather than accepted and failed later:
 * the in-place editor is proven on Word files, and a resume that comes back
 * subtly broken is worse than one that was never accepted.
 */

const ACCEPTED = ".docx";
const MAX_BYTES = 10 * 1024 * 1024;

type Check = { pages: number; fonts: string[]; warnings: string[]; name: string | null };

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Chunked: spreading a megabyte of bytes into String.fromCharCode blows the
  // argument limit on real resumes.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function accept(file: File | undefined) {
    if (!file) return;
    setCheck(null);

    if (!file.name.toLowerCase().endsWith(ACCEPTED)) {
      setError(
        `Rezz edits Word files today, so it needs a .docx. “${file.name}” isn’t one. ` +
          "PDF and LaTeX are coming.",
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const base64 = toBase64(await file.arrayBuffer());
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64 }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "We couldn't read that file.");
        setBusy(false);
        return;
      }

      session.setResume(base64, file.name);
      setFilename(file.name);

      // Nothing to say about a clean file, so don't make them click through a
      // screen that only reports success.
      if (!body.warnings?.length) {
        router.push("/job");
        return;
      }
      setCheck(body);
      setBusy(false);
    } catch {
      setError("That file could not be read. Try saving it again from Word.");
      setBusy(false);
    }
  }

  if (check) {
    return (
      <>
        <FlowHeader step="Step 1 of 2" />
        <main className="mx-auto max-w-[720px] px-16 pt-16 max-[1100px]:px-8 max-[680px]:px-4">
          <h1 className="m-0 text-[clamp(28px,3vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em]">
            We read your resume.
          </h1>
          <p className="mt-4 max-w-[54ch] text-[17px] leading-7 text-ink-muted">
            {check.name ? `${check.name}, ` : ""}
            {check.pages} page{check.pages === 1 ? "" : "s"}, set in{" "}
            {check.fonts.slice(0, 2).join(" and ") || "its own font"}. Two things worth knowing
            before we start.
          </p>

          <ul className="mt-8 list-none border-t border-line p-0">
            {check.warnings.map((w) => (
              <li
                key={w}
                className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 border-b border-line py-4"
              >
                <span aria-hidden className="font-mark text-[13px] leading-6 text-gap">
                  !
                </span>
                <span className="text-[15px] leading-6">{w}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-[58ch] text-sm leading-[22px] text-ink-muted">
            None of this stops us. We keep your layout either way — it just means some parts of
            your file are harder for an employer’s system to read, whoever wrote it.
          </p>

          <div className="mt-8 flex items-center gap-4 max-[680px]:flex-col max-[680px]:items-stretch">
            <Button size="lg" onClick={() => router.push("/job")}>
              Continue with {filename}
            </Button>
            <Button variant="secondary" onClick={() => inputRef.current?.click()}>
              Use a different file
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(e) => void accept(e.target.files?.[0])}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <FlowHeader step="Step 1 of 2" />
      <main className="mx-auto max-w-[720px] px-16 pt-16 max-[1100px]:px-8 max-[680px]:px-4">
        <h1 className="m-0 text-[clamp(28px,3vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em]">
          Upload your resume.
        </h1>
        <p className="mt-4 max-w-[54ch] text-[17px] leading-7 text-ink-muted">
          We read your facts and keep your layout exactly as it is. You only do this once —
          after that, every job takes one step.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void accept(e.dataTransfer.files[0]);
          }}
          className={`mt-10 rounded-lg border border-dashed bg-paper-raised p-12 text-center
                      transition-colors duration-150 ${dragging ? "border-ink" : "border-line-strong"}`}
        >
          <p className="m-0 text-[17px] leading-7">
            {busy ? "Reading your resume…" : "Drop your resume here"}
          </p>
          <p className="m-0 mt-1 text-sm leading-[21px] text-ink-muted">Word (.docx), up to 10 MB</p>
          <div className="mt-6 flex justify-center">
            <Button onClick={() => inputRef.current?.click()} disabled={busy}>
              Choose a file
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(e) => void accept(e.target.files?.[0])}
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 max-w-[58ch] text-[15px] leading-6 text-gap">
            {error}
          </p>
        )}

        <p className="mt-8 text-sm leading-[22px] text-ink-muted">
          Your file stays in this browser until there is tailoring to do. No sign-up to try.
        </p>
      </main>
    </>
  );
}
