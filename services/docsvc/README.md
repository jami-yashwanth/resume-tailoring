# docsvc

The only service that touches the user's own file. Everything that parses,
edits, measures or exports a resume happens here; nothing else does.

It is deliberately dumb: stateless, no database, no Claude key, no session. It
takes a document and a plan, and gives back a document. The web app owns all the
judgment — which requirement a line answers, what a change is worth — and docsvc
owns the mechanics and the renderer.

## Why it is a separate service, in Python

`prototypes/in-place-editing/` proved that a run-by-run DOCX rewrite keeps the
user's styles, bullet numbering, tab stops and bold spans, and found the thing
that makes PDFs hard: real exported PDFs embed subset fonts with no Unicode map,
so the file's own font cannot be reused for new text. That code is Python.

LibreOffice and Chromium are binaries that cannot run in a serverless function,
so a container exists regardless of language. Given that, it runs the code that
already works.

## Running it

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Then, from the repo root, so it lands on `BACKEND_PORT` (8001 unless `.env` says
otherwise):

```bash
DOCSVC_ALLOW_INSECURE=true npm run docsvc -- --reload
```

`GET /health` reports whether a renderer was found. Without LibreOffice the
service still runs, but page counts fall back to estimates and say so in
`warnings` — never trust a fit decision made in that mode.

```bash
.venv/bin/pytest          # 49 tests; the renderer ones skip if LibreOffice is absent
```

## Endpoints

| Route | Does |
| --- | --- |
| `GET /health` | Whether the renderer is present and page counts are real |
| `POST /parse` | DOCX in, addressable blocks + fonts + page count + warnings out |
| `POST /apply` | Document + plan in, edited document out, inside the page budget |
| `POST /export` | Final file as DOCX (as-is) or PDF (via the renderer) |

Files cross the wire base64-encoded, capped at 15 MB. Every route but `/health`
requires `Authorization: Bearer $DOCSVC_TOKEN`.

**With no token set the service refuses to serve at all** (503), rather than
running open. A forgotten environment variable must not be the difference
between locked and wide open. To run without authentication locally, say so
explicitly:

```bash
DOCSVC_ALLOW_INSECURE=true npm run docsvc -- --reload
```

A real `DOCSVC_TOKEN` always wins; the escape hatch cannot weaken a configured
token.

## Addressing lines

`/parse` returns blocks with ids like `b7`, which is the paragraph's index. Ids
stay valid for one parse → plan → apply cycle because `/apply` always starts from
the pristine original.

Two things this gets right that the prototype did not:

- **Ids, not text matching.** The prototype found paragraphs with
  `text.startswith(...)`, which lands on the wrong bullet whenever two of them
  open the same way.
- **Resolve before mutating.** Every target is resolved to its element *before*
  any edit runs, because the first insertion renumbers every paragraph after it.

## The page budget

`/apply` runs the whole loop from `docs/05-architecture.md` — apply, render,
measure, pay for space, render again, at most three rounds — because this is the
side that owns the renderer. Paying for space goes cheapest first: shorten a
rewrite before dropping it, drop the least valuable change before anything else.

- Operations carry a `value` (assigned by the web app's matcher) and a
  `droppable` flag. A line the user tapped **Add it** on is pinned and is never
  sacrificed to fit.
- Fonts are never shrunk.
- If three rounds is not enough, it stops, returns what it has, and says so in
  `warnings`. Growing the page is the user's call, not the fitter's.

LibreOffice and Word lay out slightly differently, so treat the count as accurate
within a margin rather than exact.

## Deploying

Built for Fly.io in `bom` (Mumbai) — the only managed container host with an
India region, which is what keeps the data-residency answer simple.

Three operational notes. The image is large (LibreOffice ~700 MB), so give the
machine at least 1 GB of RAM. `bom` is a high-demand region on Fly: pin
`min_machines_running = 1` so it cannot scale to zero and fail to come back.
And set `DOCSVC_TOKEN` — without it the service returns 503 to everything,
which is deliberate.
