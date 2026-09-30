import type { TemplateDocument } from "@/lib/tailor/document";

export const FALLBACK_NOTE = "Saved with the fallback layout; it may differ slightly from the preview.";

/** Nothing from a job posting goes into a filename unfiltered. */
export function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim() || "resume";
}

export function downloadName(filename: string | null, company: string): string {
  return `${safeName(filename ?? "resume").replace(/\.(docx|pdf)$/i, "")} — ${safeName(company)}.pdf`;
}

/** Render the resume, save it, and say what was saved. Throws a message a person can read. */
export async function downloadResume(
  resume: TemplateDocument,
  filename: string | null,
  company: string,
): Promise<{ name: string; pages: number | null; note: string | null }> {
  const response = await fetch("/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document: resume }),
  });

  // Read the status before the body: a gateway's HTML 502 used to surface to
  // the user as "Unexpected token '<'".
  if (!response.ok) {
    let message = "Could not write your file.";
    try {
      message = (await response.json()).error ?? message;
    } catch {
      /* Not JSON. The status is all we know, and the default says it. */
    }
    throw new Error(message);
  }

  const body = await response.json();
  if (typeof body.file !== "string") throw new Error("Could not write your file.");

  const bytes = Uint8Array.from(atob(body.file), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const name = downloadName(filename, company);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  // In the document and revoked a tick later: a detached anchor and an
  // immediate revoke is a known way to lose the file in some browsers.
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    name,
    pages: typeof body.pages === "number" ? body.pages : null,
    note: body.renderer === "fallback" ? FALLBACK_NOTE : null,
  };
}
