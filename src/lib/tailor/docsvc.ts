import type { DocsvcOp, Layout } from "./types";

/**
 * Client for the file service (services/docsvc).
 *
 * Everything that touches the user's actual document goes through here. The
 * web app never opens a DOCX itself.
 */

export type AppliedOp = {
  block: string;
  op: string;
  status: "applied" | "shortened" | "dropped" | "not_found" | "held";
  text: string | null;
  detail: string | null;
};

export type ApplyResult = {
  file: string;
  pages: number;
  pages_before: number;
  applied: AppliedOp[];
  rounds: number;
  warnings: string[];
};

export class DocsvcError extends Error {}

// DOCSVC_URL wins when set — that is how the deployed service is reached.
// Otherwise the port comes from BACKEND_PORT, defaulting to the same 8001 that
// scripts/ports.mjs starts docsvc on. Next.js loads `.env` itself, so both are
// already in `process.env` here.
const baseUrl = () =>
  process.env.DOCSVC_URL ?? `http://localhost:${process.env.BACKEND_PORT?.trim() || 8001}`;

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = process.env.DOCSVC_TOKEN;
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new DocsvcError(
      `Could not reach the file service at ${baseUrl()}. Is it running? ` +
        "(npm run docsvc)",
      { cause },
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new DocsvcError(`${path} failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export async function health(): Promise<{ ok: boolean; renderer: string | null; page_counts: string }> {
  const response = await fetch(`${baseUrl()}/health`).catch((cause) => {
    throw new DocsvcError(`file service unreachable at ${baseUrl()}`, { cause });
  });
  return response.json();
}

export const parseResume = (file: string, filename?: string) =>
  post<Layout>("/parse", { file, filename });

export const applyOps = (file: string, ops: DocsvcOp[], maxPages: number | null) =>
  post<ApplyResult>("/apply", { file, ops, max_pages: maxPages });

export const exportResume = (file: string, format: "docx" | "pdf") =>
  post<{ file: string; format: string }>("/export", { file, format });

export type TemplateBlock = { kind: Layout["blocks"][number]["kind"]; text: string };

/**
 * Render the tailored content into the one default Rezz template.
 *
 * v1 override (28 Sep 2026, see CLAUDE.md): every download goes through this
 * instead of `applyOps` + `exportResume`, which edit the user's own file.
 */
export const renderTemplate = (blocks: TemplateBlock[]) =>
  post<{ file: string; pages: number; format: string }>("/render-template", { blocks });
