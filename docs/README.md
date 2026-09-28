# Rezz: project docs

Everything decided and researched so far (25–28 Sep 2026), so building can pick up from here.

| File | What's in it |
| --- | --- |
| [01-product.md](01-product.md) | What Rezz is, who it's for, the promise, pricing, the decision log |
| [02-research.md](02-research.md) | Market, competitor and user research, with sources |
| [03-ux-result-screen.md](03-ux-result-screen.md) | UX spec for the core Result screen, with the evidence behind each choice |
| [04-web-flow.md](04-web-flow.md) | Every web screen in the flow and what it does |
| [05-architecture.md](05-architecture.md) | Tailoring pipeline, claim levels, page fitting, in-place file editing, Chrome extension, AI costs |
| [06-links.md](06-links.md) | Links to the design system, design canvas and blueprint artifacts |
| [07-open-items.md](07-open-items.md) | What's still undecided or unverified |

Other folders:

- [`../design/`](../design/) — local copies of the design system (tokens, components, brand book) and the web screens from the Claude Design canvas.
- [`../prototypes/in-place-editing/`](../prototypes/in-place-editing/) — the working proof of concept that edits a user's own DOCX and PDF.

**Scope right now: web app only.** Mobile is deliberately out of scope until decided otherwise.

**Note on the existing code in `src/`:** it's an early starter (paste resume + JD, get Markdown back). It predates most decisions here: it outputs Markdown instead of editing the user's own file, lists gaps instead of drafting Add it / Skip lines, and defaults to an old model ID. Treat it as scaffolding, not as the spec.
