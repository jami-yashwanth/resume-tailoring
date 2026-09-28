"use client";

import { useState } from "react";
import { Field } from "@/components/Field";
import { Results } from "@/components/Results";
import type { TailorResult } from "@/lib/prompt";

export default function Home() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<TailorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ready = resume.trim().length > 50 && jobDescription.trim().length > 50;

  async function tailor() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobDescription }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResult(data as TailorResult);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Resume tailoring
        </h1>
        <p className="mt-1 text-sm text-muted">
          Reorders and re-words what you already have. Anything the job asks for
          that your resume does not evidence shows up under Gaps, not invented
          into the text.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-5">
          <Field
            label="Your resume"
            hint="Plain text or Markdown."
            value={resume}
            onChange={setResume}
            placeholder={"Jane Doe\nSenior Backend Engineer\n\n## Experience\n..."}
          />
          <Field
            label="Job description"
            hint="Paste the whole posting, requirements included."
            value={jobDescription}
            onChange={setJobDescription}
            rows={12}
            placeholder="We're looking for a backend engineer to..."
          />

          <div className="flex items-center gap-3">
            <button
              onClick={tailor}
              disabled={!ready || loading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Tailoring..." : "Tailor resume"}
            </button>
            {!ready ? (
              <span className="text-xs text-muted">
                Paste both fields to continue.
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </section>

        <section className="min-h-0 rounded-xl border border-line bg-white/50 p-4">
          {result ? (
            <Results result={result} />
          ) : (
            <div className="flex h-full min-h-64 items-center justify-center text-center text-sm text-muted">
              {loading
                ? "Reading the posting against your resume..."
                : "Results will appear here."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
