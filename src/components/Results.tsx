"use client";

import { useState } from "react";
import type { TailorResult } from "@/lib/prompt";

const severityStyle: Record<string, string> = {
  blocking: "bg-red-50 text-red-700 ring-red-200",
  notable: "bg-amber-50 text-amber-800 ring-amber-200",
  minor: "bg-slate-50 text-slate-600 ring-slate-200",
};

const TABS = ["Resume", "Changes", "Gaps"] as const;
type Tab = (typeof TABS)[number];

export function Results({ result }: { result: TailorResult }) {
  const [tab, setTab] = useState<Tab>("Resume");
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(result.tailoredResume);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <p className="rounded-lg border border-line bg-white p-3 text-sm leading-relaxed text-muted">
        {result.summary}
      </p>

      <div className="flex items-center justify-between border-b border-line">
        <div className="flex gap-1">
          {TABS.map((name) => (
            <button
              key={name}
              onClick={() => setTab(name)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === name
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {name}
              {name === "Changes" ? ` (${result.changes.length})` : null}
              {name === "Gaps" ? ` (${result.gaps.length})` : null}
            </button>
          ))}
        </div>
        {tab === "Resume" ? (
          <button
            onClick={copy}
            className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "Resume" ? (
          <pre className="whitespace-pre-wrap rounded-lg border border-line bg-white p-4 font-mono text-[13px] leading-relaxed">
            {result.tailoredResume}
          </pre>
        ) : null}

        {tab === "Changes" ? (
          <ul className="flex flex-col gap-3">
            {result.changes.map((change, index) => (
              <li
                key={index}
                className="rounded-lg border border-line bg-white p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {change.section}
                </p>
                <p className="mt-2 text-sm text-muted line-through decoration-red-300">
                  {change.before}
                </p>
                <p className="mt-1 text-sm text-ink">{change.after}</p>
                <p className="mt-2 text-xs text-muted">{change.why}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === "Gaps" ? (
          <ul className="flex flex-col gap-3">
            {result.gaps.map((gap, index) => (
              <li
                key={index}
                className="rounded-lg border border-line bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-ink">
                    {gap.requirement}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                      severityStyle[gap.severity] ?? severityStyle.minor
                    }`}
                  >
                    {gap.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{gap.suggestion}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {result.matchedKeywords.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
          {result.matchedKeywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
