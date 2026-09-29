# resume-tailoring (Rezz)

India-first AI resume tailor. Upload a Word or PDF resume once, paste any job
(or its link), and about fifteen seconds later get your own facts back,
reworded for that job in one clean template, with every change marked. Nothing
is added behind your back: a line with a skill that isn't in the resume waits
for an explicit **Add it**.

The decisions in `docs/README.md` are the spec; `CLAUDE.md` carries the
product rules. Start there before changing behaviour.

## Setup

```bash
npm install
cp .env.example .env        # then add your ANTHROPIC_API_KEY and DOCSVC_TOKEN

# the file service (parse + render), a Python FastAPI app
cd services/docsvc && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ../..

npm run docsvc              # terminal 1 — file service
npm run dev                 # terminal 2 — web app
```

`node scripts/ports.mjs` prints the ports both launchers will use
(`FRONTEND_PORT` / `BACKEND_PORT`).

## The flow

`/` → `/upload` → `/job` → `/tailoring` → `/result` → `/done`

- **`/upload`** reads the file in the browser, parses it via docsvc `/parse`
  (`src/app/api/parse/route.ts`), and keeps it in `sessionStorage` — nothing
  is stored server-side.
- **`/tailoring`** streams staged progress over SSE from
  `src/app/api/tailor/stream/route.ts`, which runs the pipeline in
  `src/lib/tailor/pipeline.ts`: parse → requirements (Claude, verifier model)
  → edit-op planner (Claude, planner model) → pure-code guardrails
  (`src/lib/tailor/rules.ts`) → heading renames.
- **`/result`** renders a live-measured A4 preview (`DefaultTemplateSheet`,
  numbers from `shared/template.json`, same file the PDF renderer reads) with
  the review list; Add it / Skip decisions are a pure reducer
  (`src/lib/tailor/review.ts`) persisted per session. `/result?demo` shows a
  saved sample tailoring.
- **Download** posts approved lines only (`src/lib/tailor/download.ts`) to
  `/api/download`, which renders the PDF via docsvc `/render-template`.

`src/lib/tailor/planner.ts` holds the planner prompt and hard rules — the file
to edit for different tailoring behaviour. The rules are deliberately
conservative: reword and reorder what is already there, never invent numbers,
never fake knockouts. If you loosen that, you are building a tool that lies on
the user's behalf.

## Scripts

| command | does |
| --- | --- |
| `npm run dev` | web app (Next.js) |
| `npm run docsvc` | file service (FastAPI) |
| `npm run build` | production build |
| `npm test` | vitest (frontend + pipeline logic) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `services/docsvc/.venv/bin/pytest services/docsvc/tests` | file-service tests |
| `npx tsx scripts/tailor-sample.mts` | run the whole pipeline once against the sample resume + JD |
