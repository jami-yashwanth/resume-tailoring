"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FlowHeader } from "@/components/flow/FlowHeader";
import { Button } from "@/components/rezz/Button";
import { box, lead, offsetGap, offsetPage, title } from "@/components/rezz/skin";
import { track } from "@/lib/analytics";
import { session } from "@/lib/session";

/**
 * Upload your resume. Step one, and only the first time.
 *
 * One drop zone, no account, nothing to configure. The file is read in the
 * browser and sent to be parsed — which is also the honest check's first job.
 * A file we cannot read is named here, not fifteen seconds into a tailoring.
 *
 * Word or PDF. v1 renders every result into the one default Rezz template
 * (see CLAUDE.md's dated override) rather than editing the file in place, so
 * only the file's *content* matters here, not its original formatting —
 * which is what makes accepting PDF safe without the subset-font problems
 * `docs/05-architecture.md` describes for in-place PDF editing.
 */

const ACCEPTED = ".docx,.pdf";
/* 4 MB, not 10: the file crosses to /job and /result through sessionStorage as
   base64 (×1.33), and common browser quotas sit near 5 MB — a bigger file
   survives the upload and then silently fails to persist. Real resumes are
   well under 1 MB; 4 MB already means embedded photos. */
const MAX_BYTES = 4 * 1024 * 1024;

/* The app screens sit on the same flat white the landing page does. The grey
   ground exists to sink the resume canvas on the Result screen; there is no
   resume here, so there is nothing to sink. */
const page = "min-h-screen bg-paper-raised";
const column = "mx-auto max-w-[720px] px-16 pb-24 pt-16 max-[1100px]:px-8 max-[680px]:px-4";

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

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
      setError(
        `Rezz reads Word or PDF resumes today, so it needs a .docx or .pdf. “${file.name}” isn’t one. Export a .pdf or .docx and try again.`,
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 4 MB.`);
      return;
    }

    setError(null);
    setBusy(true);
    track("upload_started");
    try {
      const buffer = await file.arrayBuffer();
      // Magic bytes, not just the name: PDF opens "%PDF", DOCX is a ZIP
      // ("PK\x03\x04"). A renamed file fails here, before any upload.
      const head = new Uint8Array(buffer.slice(0, 4));
      const isPdf = lower.endsWith(".pdf");
      const expected = isPdf ? [0x25, 0x50, 0x44, 0x46] : [0x50, 0x4b, 0x03, 0x04];
      if (!expected.every((byte, i) => head[i] === byte)) {
        setError(
          isPdf
            ? `“${file.name}” has a .pdf name but isn't a PDF inside. Export a fresh copy and try again.`
            : `“${file.name}” has a .docx name but isn't a Word file inside. Save it again from Word as .docx.`,
        );
        setBusy(false);
        return;
      }
      const base64 = toBase64(buffer);
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64, filename: file.name }),
      });
      const body = await response.json();

      if (!response.ok) {
        track("parse_failed");
        setError(body.error ?? "We couldn't read that file.");
        setBusy(false);
        return;
      }

      track("parse_ok", { pages: body.pages ?? 0 });
      if (!session.setResume(base64, file.name)) {
        setError(
          "Your browser couldn't hold this file for the next step — it may be too large, or " +
            "storage is blocked in this window. Try a copy under 4 MB, or a regular window.",
        );
        setBusy(false);
        return;
      }
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
      <div className={page}>
        <FlowHeader step="Step 1 of 2" />
        <main className={column}>
          <h1 className={title}>We read your resume.</h1>
          <p className={`mt-6 max-w-[54ch] ${lead}`}>
            {check.name ? `${check.name}, ` : ""}
            {check.pages} page{check.pages === 1 ? "" : "s"}, set in{" "}
            {check.fonts.slice(0, 2).join(" and ") || "its own font"}. Two things worth knowing
            before we start.
          </p>

          {/* Hairlines, not drawn boxes: this is a list you read, not a set of
              things you act on. The skin stops at the container. */}
          <div className={`mt-10 ${box} ${offsetPage} rounded-md bg-paper-raised p-8 max-[680px]:p-6`}>
            <ul className="m-0 list-none p-0">
              {check.warnings.map((w) => (
                <li
                  key={w}
                  className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 border-b border-line py-4 last:border-b-0"
                >
                  <span aria-hidden className="font-mark text-[13px] leading-6 text-gap">
                    !
                  </span>
                  <span className="text-[15px] leading-6">{w}</span>
                </li>
              ))}
            </ul>
            <p className="m-0 mt-5 max-w-[58ch] text-sm leading-[22px] text-ink-muted">
              None of this stops us — we read your facts either way and set them in our own
              resume layout.
            </p>
          </div>

          <div className="mt-10 flex items-center gap-5 max-[680px]:flex-col max-[680px]:items-stretch">
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
      </div>
    );
  }

  return (
    <div className={page}>
      <FlowHeader step="Step 1 of 2" />
      <main className={column}>
        <h1 className={title}>Upload your resume.</h1>
        <p className={`mt-6 max-w-[54ch] ${lead}`}>
          We read your facts and reword them for the job — nothing invented. You only do this
          once — after that, every job takes one step.
        </p>

        {/* A page-scale drawn object, so 8px. Dragging presses it into its own
            offset and fills it with the sunken well — the same idiom the
            buttons use for "active", rather than a new colour invented for
            hover. The highlighter is not available for this: it means changed
            text and nothing else. */}
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
          className={`mt-10 rounded-md ${box} p-12 text-center transition-[background-color,box-shadow,transform] duration-150
                      max-[680px]:p-8
                      ${
                        dragging
                          ? "translate-x-[8px] translate-y-[8px] bg-paper-sunken shadow-none"
                          : `bg-paper-raised ${offsetPage}`
                      }`}
        >
          <p className="m-0 text-lg font-semibold leading-[29px]">
            {busy ? "Reading your resume…" : "Drop your resume here"}
          </p>
          <p className="m-0 mt-1 text-sm leading-[21px] text-ink-muted">
            Word (.docx) or PDF, up to 4 MB
          </p>
          <div className="mt-7 flex justify-center">
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

        {/* Drawn in the corrector's red, the same treatment the landing page
            gives the one thing that needs the user. It is the only box on this
            screen carrying a colour other than ink. */}
        {error && (
          <div
            role="alert"
            className={`mt-8 rounded-md border-2 border-gap bg-paper-raised p-6 ${offsetGap}`}
          >
            <p className="m-0 text-lg font-semibold leading-[29px]">We can&rsquo;t read that file.</p>
            <p className="m-0 mt-1 max-w-[58ch] text-[15px] leading-6 text-ink-muted">{error}</p>
            <p className="mt-3 flex items-center gap-2 font-mark text-xs leading-4 text-gap before:h-[2px] before:w-[18px] before:bg-gap before:content-['']">
              nothing was uploaded — try another file
            </p>
          </div>
        )}

        <p className="mt-8 text-sm leading-[22px] text-ink-muted">
          Your file stays in this browser until there is tailoring to do. No sign-up to try.
        </p>
      </main>
    </div>
  );
}
