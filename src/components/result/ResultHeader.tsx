"use client";

import Link from "next/link";
import { Button } from "@/components/rezz/Button";
import { Wordmark } from "@/components/rezz/Wordmark";
import { box, offset } from "@/components/rezz/skin";

/**
 * The one bar of chrome, and the only place on this screen the drawn-ink skin
 * sits on something you do not press. One Download: secondary while anything is
 * undecided, primary once nothing is.
 */
export function ResultHeader({
  role,
  company,
  status,
  compare,
  onToggleCompare,
  ready,
  onDownload,
  canDownload,
  checking,
  downloading,
}: {
  role: string;
  company: string;
  status: string;
  compare: boolean;
  onToggleCompare: () => void;
  ready: boolean;
  onDownload: () => void;
  canDownload: boolean;
  /** The printer is counting the document on screen; Download waits for it. */
  checking: boolean;
  downloading: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-edge bg-paper-raised dark:bg-paper px-8 py-3 max-[900px]:px-4">
      <Link
        href="/"
        aria-label="Rezz home"
        className={`inline-flex flex-none items-center ${box} rounded-md bg-sheet px-3 py-1.5 no-underline ${offset}`}
      >
        <Wordmark />
      </Link>
      <h1 className="m-0 min-w-0 truncate text-[15px] font-semibold leading-[21px]">
        {role} · {company}
      </h1>
      {/* Not a live region: the screen's sr-only region announces decisions. */}
      <p className="m-0 text-sm leading-5 text-ink-muted">
        {compare ? "Showing your original wording" : status}
      </p>

      <div className="ml-auto flex items-center gap-4">
        <Switch on={compare} onToggle={onToggleCompare} label="Compare with original" />
        <Button variant={ready ? "primary" : "secondary"} onClick={onDownload} disabled={!canDownload || downloading}>
          {downloading ? "Writing your file…" : checking ? "Checking pages…" : "Download resume"}
        </Button>
      </div>
    </header>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sheet border-0 bg-transparent px-2
                 font-ui text-sm font-medium leading-5 text-ink transition-colors duration-150 hover:bg-paper-sunken"
    >
      <span
        aria-hidden
        className={`relative h-4 w-7 flex-none rounded-full transition-colors duration-150 ${on ? "bg-ink" : "bg-line-strong"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-paper-raised transition-all duration-150 ${on ? "left-[14px]" : "left-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}
