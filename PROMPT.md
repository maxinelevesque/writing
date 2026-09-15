# PROMPT — set up `writing` as the canonical content source (2026-09-15)

You are working in `~/code/maxinelevesque/writing`, a fresh **public** repo that is the
single authoritative source for Maxine's public-facing essays. Two consumers derive from
it: the Astro site at `~/code/maxinelevesque/maxine.science` (repo
`maxinelevesque/maxinelevesque.github.io`, deploys via GitHub Pages workflow) and
atproto `site.standard.*` records. Work top to bottom. Commit forward in small commits.
Ask Maxine only where marked **ASK**.

## 0. Ground rules
- This repo is public. Nothing goes in it that isn't meant to be public. `formerName` is an
  intentional byline field (deadname attribution on old pieces) — keep it.
- Never rewrite history here or in the site repo. Forward commits only.
- Content is semantic; presentation is downstream. If a field only matters to how the site
  renders (`system`, `readTime`), it does not belong in this repo.
- `drafts/` is invisible to every consumer. Promotion = `git mv drafts/x.md pieces/x/index.md`.

## 1. Normalize the seeded content
`pieces/` was seeded verbatim from the site's `src/content/{writing,dialogues}`; `drafts/`
holds three unpublished essays (the-incompressible = v5, with a v3 fallback for any passage
the v5 reconstruction mangled; the-no-thing-in-the-cradle; straw-holes = placeholder, body
TBD). Define one frontmatter schema and apply it to every file in `pieces/`:

```yaml
title:        string
subtitle:     string?
date:         YYYY-MM-DD              # first publication
updated:      YYYY-MM-DD?
kind:         essay | fiction | note | dialogue
coauthor:     string?                 # "Claude" on dialogues; the site's cool-register signal
formerName:   string?
summary:      string?                 # one paragraph, used for atproto + OG
canonical:    https://maxine.science/<path>
```
Convert existing `category` → `kind`, drop `system` and `readTime` (record the slug→system
mapping in a sidecar you hand to the site, step 4). Write `SCHEMA.md` documenting it.
Add a tiny `scripts/validate` (node or python, no deps beyond what's here) that fails CI on
schema violations. That's the only gate on publishing.

## 2. Draft/publish separation
Already structural (`drafts/` vs `pieces/`). Add:
- `.github/workflows/validate.yml` — on every PR/push: run `scripts/validate` on `pieces/**`.
- Branch protection is NOT required; the directory split is the separation. Document the
  promotion ritual in README (edit in `drafts/`, move to `pieces/` when live).

## 3. atproto publication (records live *here*, not in the site)
decant (`~/code/maxinelevesque/decant`, v0.3) already emits `site.standard.publication` +
`site.standard.document` records — read its `packages/` for the shape and reuse, don't
reinvent. Build `scripts/publish-atproto`:
- One `site.standard.publication` record for maxine.science (idempotent, keyed rkey).
- One `site.standard.document` per `pieces/<slug>`, rkey = slug, upserted on change,
  deleted if a piece leaves `pieces/`. Keep a `records.json` ledger (slug → at-uri, cid)
  committed to the repo so the mapping is inspectable.
- Credentials via env: `ATP_IDENTIFIER`, `ATP_APP_PASSWORD`, `ATP_PDS_URL`. **ASK** Maxine
  which identity publishes (the kan.cat handle / did:plc, or a maxine.science handle) and
  to create the app password + repo secrets. Do not guess.
- `.github/workflows/publish.yml` — on push to `main` touching `pieces/**`: validate, then
  publish-atproto, then step 4's dispatch.

## 4. Site rebuild automation
- In this repo's `publish.yml`, after atproto: `repository_dispatch` (event
  `content-updated`) to `maxinelevesque/maxinelevesque.github.io`. Needs a fine-grained PAT
  with `contents:write` on the site repo as secret `SITE_DISPATCH_TOKEN` — **ASK** Maxine
  to mint it.
- In the **site** repo: change `.github/workflows/deploy.yml` to also trigger on
  `repository_dispatch: [content-updated]`; add a build step that fetches this repo
  (`git clone --depth 1` of `writing` into a build dir) and generates `src/content/` from
  `pieces/**` using a `presentation.json` sidecar (slug → system, register) that lives in
  the site. Delete the hand-maintained `src/content/{writing,dialogues}/*.md` once the
  generated output matches. Astro's content config must accept the step-1 schema
  (map `kind: dialogue` → the dialogues collection). Coordinate with the maxine.science RC
  session (its HANDOFF.md step 2 is this spec; you are its answer).

## 5. Finish
- README: promotion ritual, secrets list, how to add a piece end-to-end in 5 lines.
- Verify: change a `summary` in one piece → push → atproto record updates → site rebuilds.
- Report back: what's live, what's ASK-blocked, exact secrets still missing.
