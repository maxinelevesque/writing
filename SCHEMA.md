# Frontmatter schema

Every `pieces/<slug>/index.md` carries a small block of **semantic** frontmatter —
facts about the piece, never about how a site renders it. Presentation choices
(background system, read time, register styling) live downstream in the consumer,
keyed by slug (see [Dropped fields](#dropped-fields)).

`scripts/validate` enforces this schema and is the only gate on publishing
(`.github/workflows/validate.yml` runs it on every push/PR touching `pieces/**`).
Files under `drafts/` are free-form and are **not** validated or consumed.

## Fields

```yaml
title:        string                      # required
subtitle:     string?                     # optional
date:         YYYY-MM-DD                   # required — first publication
updated:      YYYY-MM-DD?                  # optional — last substantive revision
kind:         essay | fiction | note | dialogue | report   # required
coauthor:     string?                      # dialogues (required) and reports (optional); "Claude"
coauthorNote: string?                      # with a coauthor; one sentence rendered as a footnote on the coauthor byline
formerName:   string?                      # deadname / pen-name byline attribution on a piece
summary:      string?                      # one paragraph; feeds atproto record + OG description
canonical:    https://maxine.science/<seg>/<slug>   # required
tags:         [string]?                     # topic tags; flow-sequence, e.g. [klein, psychoanalysis]
contributors: [string]?                     # persona keys from personas.json, each optionally "key: role"
readAloud:    path?                         # authored plain-text companion inside the piece's directory, e.g. read-aloud.txt
```

Field order in files follows the block above. Values are double-quoted when they
contain punctuation; `date`, `updated`, `kind`, and `canonical` are written bare.

### Notes per field

- **title / subtitle** — verbatim as they should appear. Preserved exactly from the seed.
- **date** — ISO `YYYY-MM-DD`, the date of first publication. The validator rejects
  impossible dates (e.g. `2022-13-40`).
- **updated** — present only when a piece has been meaningfully revised after publication.
- **kind** — the semantic category, and the only routing signal a consumer needs:
  - `essay`, `fiction`, `note` → the site's **writing** collection → `/writing/<slug>`
  - `dialogue` → the site's **dialogues** collection → `/dialogues/<slug>`
  - `report` → the site's **research** collection → `/research/<slug>`. A research report:
    a long-form technical piece, possibly with interactive figures, shown in its own
    register.
- **coauthor** — set to `"Claude"`. Required on `kind: dialogue` (the "cool register"
  signal); optional on `kind: report`; forbidden on every other kind.
- **coauthorNote** — optional, and only alongside `coauthor`. One or two sentences shown as a footnote
  hanging off the coauthor name in the byline and printed at the foot of the page: the
  division of labour, and, where a session chose a name for itself, that name. The
  byline itself always says `Claude`.
- **formerName** — an intentional, kept byline field: deadname attribution on older pieces
  (`Max Collard` / `Maxine Collard`) and pen names on fiction (`Emma Fontaine`). It is
  never scrubbed and never rewritten out of history. See the ground rules in `PROMPT.md`.
- **summary** — optional one-paragraph description used as the atproto document
  `description` and the OG description. When absent, consumers fall back to `subtitle`.
  Left unset at migration time (authorial text; not fabricated) — add per piece when wanted.
- **contributors** — persona keys from `personas.json`, credited in the atproto record
  with each persona's DID. An entry may name this piece's role for that persona, which
  overrides the persona's default role: `contributors: ["claude: Lean formalization", seam]`.
  Quote an entry that has a role. Roles are at most 100 characters (the lexicon's bound).
- **readAloud** — an authored plain-text companion for reading aloud: written text, not an
  automatically stripped transcript, with figures described in words. A relative `.txt`
  path inside the piece's directory. The site links it; it is not sent to atproto (the
  document lexicon has no field for it).
- **canonical** — the piece's public URL, derived deterministically from `kind` + slug.
  The validator requires it to equal `https://maxine.science/<writing|dialogues|research>/<slug>`
  where `<slug>` is the directory name. It exists so the semantic source, not the
  renderer, owns each piece's canonical identity.

## Enforced rules (`scripts/validate`)

1. Required fields present and non-empty: `title`, `date`, `kind`, `canonical`.
2. No fields outside the allow-list above (unknown keys fail).
3. `date` / `updated` are real `YYYY-MM-DD` dates.
4. `kind` is one of the five enum values.
5. `canonical` matches the URL implied by `kind` and equals the directory slug.
6. `kind: dialogue` requires `coauthor`; `coauthor` is allowed only on `dialogue` and
   `report`; `coauthorNote` requires `coauthor`.
7. `tags`, if present, is a list of non-empty strings (≤128 chars each).
8. `contributors`, if present, are persona keys that exist in `personas.json` and have a
   `did`, each listed once; a role, if given, is non-empty and ≤100 characters.
9. `readAloud`, if present, is a relative `.txt` path inside the piece's directory, and
   the file exists.

## Repo-level metadata (not per-piece)

Two files at the repo root carry metadata the publish workflow uses, kept out of
per-piece frontmatter:

- **`publication.json`** — the `site.standard.publication` record's fields:
  `name`, `url`, `description`, `showInDiscover`. Edit here to change the
  publication's atproto metadata; the next publish upserts it.
- **`personas.json`** — a registry of AI-authored personas: `key → { did, role?,
  displayName? }`. A piece's `contributors: [key]` resolves through this into the
  document record's `contributors` (each needs a real DID, e.g. a `did:web`).

## How metadata maps to atproto records

`scripts/publish-atproto` builds one `site.standard.document` per piece:
`title`, `site`, `path` (from `canonical`), `publishedAt` (`date`), `updatedAt`
(`updated`), `description` (`summary` ‖ `subtitle`), `tags`, `contributors`, and
`coverImage` (the site's generated OG image, fetched and uploaded as a blob when
available — a new piece's OG only exists after the site rebuilds, so it backfills
on a later run). It also emits `canonicalUrl` (= the piece's `canonical`): the URL
is derivable from `site` + `path`, but standard.site readers and Bluesky match a
posted URL against `canonicalUrl`, and working publishers include it.

## Dropped fields

The seed carried two presentation-only fields that do **not** belong in this repo
(ground rule: "if a field only matters to how the site renders, it does not belong here"):

- **`system`** — index (0–12) into the site's dynamical-systems background library.
- **`readTime`** — display string like `"8 min"`.

Both were extracted into a slug-keyed sidecar handed to the site
(`presentation.json` there), alongside each piece's `register`/`collection`. The
seed's `category` field was converted to `kind` (`article → essay`, `fiction → fiction`,
and the un-categorised co-authored pieces → `dialogue`) and then dropped.
