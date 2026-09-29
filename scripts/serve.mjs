/**
 * Start one half of Rezz on the port `.env` asks for.
 *
 *   node scripts/serve.mjs dev      # Next.js with hot reload  (FRONTEND_PORT)
 *   node scripts/serve.mjs start    # Next.js, production build (FRONTEND_PORT)
 *   node scripts/serve.mjs docsvc   # the file service          (BACKEND_PORT)
 *
 * Anything after the target is handed to the underlying command, so
 * `npm run docsvc -- --reload` still works.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { backendPort, frontendPort, repoRoot } from "./ports.mjs";

const [target, ...extra] = process.argv.slice(2);

const docsvcDir = path.join(repoRoot, "services", "docsvc");
const venvUvicorn = path.join(docsvcDir, ".venv", "bin", "uvicorn");
const nextBin = path.join(repoRoot, "node_modules", ".bin", "next");

const next = (mode) => ({
  command: nextBin,
  args: [mode, "-p", String(frontendPort), ...extra],
  cwd: repoRoot,
});

const targets = {
  dev: () => next("dev"),
  start: () => next("start"),
  docsvc: () => ({
    command: existsSync(venvUvicorn) ? venvUvicorn : "uvicorn",
    args: ["app.main:app", "--port", String(backendPort), ...extra],
    cwd: docsvcDir,
    // docsvc is documented as never holding a Claude key. Reading `.env` here
    // would quietly hand it one by inheritance, so take it back out. Its own
    // DOCSVC_TOKEN / DOCSVC_ALLOW_INSECURE still pass through untouched — this
    // never decides authentication for it.
    env: (() => {
      const env = { ...process.env };
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;
      return env;
    })(),
  }),
};

if (!Object.hasOwn(targets, target ?? "")) {
  console.error(`usage: node scripts/serve.mjs <${Object.keys(targets).join("|")}> [args...]`);
  process.exit(2);
}

const { command, args, cwd, env = process.env } = targets[target]();

const child = spawn(command, args, { cwd, env, stdio: "inherit" });

child.on("error", (error) => {
  const hint =
    target === "docsvc" && !existsSync(venvUvicorn)
      ? "\nNo services/docsvc/.venv — see services/docsvc/README.md for the setup."
      : "";
  console.error(`Could not start ${command}: ${error.message}${hint}`);
  process.exit(1);
});

// Ctrl-C reaches the child through the terminal already; forwarding these keeps
// `npm run dev` killable by a supervisor too.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
