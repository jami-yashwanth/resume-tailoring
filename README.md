# resume-tailoring

Paste a resume and a job description; get back a tailored resume, a keyword gap
report, and a plain-English list of what changed and why.

## Setup

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3001.

## How it works

- `src/app/page.tsx` - two-pane UI: inputs on the left, results on the right.
- `src/app/api/tailor/route.ts` - server route. Never exposes the API key to the
  browser. Calls Claude with a tool schema so the response comes back as
  validated JSON rather than free text.
- `src/lib/prompt.ts` - the system prompt and the output schema. This is the
  file to edit when you want different tailoring behaviour.

## Design notes

The prompt is deliberately conservative: it is told to reorder, re-word, and
re-emphasise what is already in the resume, and to surface missing
qualifications in `gaps` rather than inventing them. If you loosen that, you are
building a tool that lies on your behalf.

## Scripts

| command | does |
| --- | --- |
| `npm run dev` | dev server, on `FRONTEND_PORT` (3001) |
| `npm run docsvc` | the file service, on `BACKEND_PORT` (8001) |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `node scripts/ports.mjs` | print the ports the launchers will use |
