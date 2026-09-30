# Schema extraction: the resume as entries, read-only

**Decided 30 Sep 2026 (owner).** The LLM may *structure and categorise* the parsed
resume; it may never change the uploaded content. Rewording stays in the separate
tailoring pass, with undo.

## Why

The template only receives a flat list of labelled lines (name/contact/heading/
role/bullet/paragraph). `view.ts` guesses which role line is the employer and
which the title by position, and `latex_render._split_role` splits on a tab.
`\resumeSubheading` takes four fields — company, dates, title, location — and
today three of them are guesses. A good template needs the fields.

## What the model does

Given every parser block (id, text, style, parser kind, parser section), it
returns an **Outline**: the name block, the contact blocks, and sections in
document order. Each section has a kind (summary, experience, education,
projects, skills, certifications, achievements, other), an optional heading
block, entries, skill rows, and loose lines.

An **entry** has four header fields — `org` (employer / school / project name),
`title` (job title / degree / stack), `dates`, `place` (location) — each a
`Ref = { block, text }` or null, plus `bullets` (block ids) and `lines`
(block ids: grade, coursework, a detail line). A **skill row** is
`{ block, label | null, items }`.

The model returns ids for whole lines and `Ref.text` only where one parser line
holds two fields ("Google ⇥ Jun 2022 – Present").

## What the code enforces (reject the whole answer otherwise)

1. Every block id exists, and every block appears exactly once — whole in one
   slot, or split across the Ref/skill fields of one entry or row.
2. Every `Ref.text` / skill `label` / `items` is a verbatim substring of its
   block's text (whitespace collapsed), and the parts of a split block cover it
   exactly: after dropping separators, nothing is missing and nothing is added.
3. A block the parser saw a bullet marker on may only sit in `bullets` or
   `lines`.
4. A heading is at most 60 characters.
5. Nothing is normalised: dates, titles, grades, phone numbers keep the user's
   spelling and punctuation.
6. Section, entry, bullet, line and contact order follows the parser's block
   order. The code sorts; it does not ask the model to.

A rejected answer is retried once with the missing / offending ids named. A
second failure keeps the parser's labels and the line renderer: today's path,
never a blank result.

## What consumes it

- The rest of the pipeline (planner, coverage, review list) keeps working on
  block kinds and sections: the outline is turned into labels
  (`name`/`contact`/`heading`/`role`/`bullet`/`paragraph`) and applied with the
  existing `applyStructure`.
- Download and exact preview send a **TemplateDocument** — the outline with
  every slot resolved to the user's decided text (rewordings, approved inserts,
  removals, heading renames) — and docsvc sets it straight onto the template's
  macros. A stored result without an outline (older session, sample fixture)
  still sends flat blocks.
- The drawn fallback renderer and the CSS working sheet keep consuming flat
  blocks; a document is flattened for them.

## Out of scope here

Positions (x/y/page) in the prompt for two-column resumes; extraction at upload
with an outline the user can correct; hyperlinks; the fixture corpus beyond a
check script. Each is its own plan.
