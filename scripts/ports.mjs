/**
 * The two ports Rezz runs on.
 *
 * `FRONTEND_PORT` (the Next.js app) and `BACKEND_PORT` (docsvc) live in `.env`.
 * The defaults below are those same numbers, so nothing moves when `.env` is
 * absent — the file only has to exist to point them somewhere else.
 *
 * This module exists because neither launcher picks the values up on its own:
 * the Next.js CLI resolves `--port` from the environment before it loads
 * `.env`, and uvicorn never reads `.env` at all. Code running *inside* Next.js
 * does not need this — Next loads `.env` itself, so `process.env.BACKEND_PORT`
 * is already set there.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_FRONTEND_PORT = 3001;
export const DEFAULT_BACKEND_PORT = 8001;

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Next.js' own precedence, kept deliberately: `.env.local` beats `.env`, and a
// real environment variable beats both. `loadEnvFile` never overwrites a name
// already in `process.env`, so loading the higher-priority file first is what
// gives it priority.
for (const file of [".env.local", ".env"]) {
  const full = path.join(repoRoot, file);
  if (existsSync(full)) process.loadEnvFile(full);
}

function read(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const port = Number(raw.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a port between 1 and 65535, not ${JSON.stringify(raw)}`);
  }
  return port;
}

export const frontendPort = read("FRONTEND_PORT", DEFAULT_FRONTEND_PORT);
export const backendPort = read("BACKEND_PORT", DEFAULT_BACKEND_PORT);

// `node scripts/ports.mjs` prints what the launchers will use, which is the
// quickest way to tell whether a `.env` edit actually landed.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`FRONTEND_PORT=${frontendPort}`);
  console.log(`BACKEND_PORT=${backendPort}`);
}
