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
kind:         essay | fiction | note | dialogue   # required
coauthor:     string?                      # dialogues only ("Claude"); the cool-register signal
formerName:   string?                      # deadname / pen-name byline attribution on a piece
summary:      string?                      # one paragraph; feeds atproto record + OG description
canonical:    https://maxine.science/<seg>/<slug>   # required
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
- **coauthor** — set to `"Claude"` on dialogues. Required iff `kind: dialogue`; forbidden
  otherwise. This is what the site reads as the "cool register" signal.
- **formerName** — an intentional, kept byline field: deadname attribution on older pieces
  (`Max Collard` / `Maxine Collard`) and pen names on fiction (`Emma Fontaine`). It is
  never scrubbed and never rewritten out of history. See the ground rules in `PROMPT.md`.
- **summary** — optional one-paragraph description used as the atproto document
  `description` and the OG description. When absent, consumers fall back to `subtitle`.
  Left unset at migration time (authorial text; not fabricated) — add per piece when wanted.
- **canonical** — the piece's public URL, derived deterministically from `kind` + slug.
  The validator requires it to equal `https://maxine.science/<writing|dialogues>/<slug>`
  where `<slug>` is the directory name. It exists so the semantic source, not the
  renderer, owns each piece's canonical identity.

## Enforced rules (`scripts/validate`)

1. Required fields present and non-empty: `title`, `date`, `kind`, `canonical`.
2. No fields outside the allow-list above (unknown keys fail).
3. `date` / `updated` are real `YYYY-MM-DD` dates.
4. `kind` is one of the four enum values.
5. `canonical` matches the URL implied by `kind` and equals the directory slug.
6. `kind: dialogue` ⇔ `coauthor` is present.

## Dropped fields

The seed carried two presentation-only fields that do **not** belong in this repo
(ground rule: "if a field only matters to how the site renders, it does not belong here"):

- **`system`** — index (0–12) into the site's dynamical-systems background library.
- **`readTime`** — display string like `"8 min"`.

Both were extracted into a slug-keyed sidecar handed to the site
(`presentation.json` there), alongside each piece's `register`/`collection`. The
seed's `category` field was converted to `kind` (`article → essay`, `fiction → fiction`,
and the un-categorised co-authored pieces → `dialogue`) and then dropped.
