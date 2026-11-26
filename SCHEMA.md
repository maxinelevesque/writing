# Frontmatter schema

Every `pieces/<slug>/index.md` carries a small block of **semantic** frontmatter —
facts about the piece, never about how a site renders it. Presentation choices
(background system, read time, register styling) live downstream in the consumer,
keyed by slug (see [Dropped fields](#dropped-fields)).

`scripts/validate` enforces this schema and is the only gate on publishing
(`.github/workflows/validate.yml` runs it on every push/PR touching `pieces/**`,
`drafts/**` or `scripts/**`). Files under `drafts/` are free-form and are **not**
validated or consumed, with one exception: an **exported draft**, a
`drafts/<slug>/` directory holding a `SOURCE` file, is validated like a piece
(except that its `date` may wait until publication). See [SOURCE](#source).

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

## Files in a piece

A piece is a directory. Besides `index.md` it may hold only:

```
pieces/<slug>/
  index.md        frontmatter + prose
  SOURCE          exported pieces only (see below)
  read-aloud.txt  the readAloud companion, wherever the field points
  assets/         images: .svg .png .jpg .jpeg .webp .gif
  figures/        figure code for the site: .js .mjs .css .json .md (tests: *.test.mjs)
```

No symbolic links. Relative links and images in the body must stay inside the
directory and name a file that exists; images must be in `assets/`, and other
relative links may point only into `assets/` or at the `readAloud` file. The
consumers rewrite these paths (the site serves them from
`https://maxine.science/files/<slug>/…`). The validator warns when a piece's files
add up to more than 5 MB.

## Figures

Research reports (`kind: report`) may carry interactive figures, written as three
blocks:

```md
<!-- figure #fig-reduction component="reduction" calc="tree" -->

![Alt text that carries the figure's content, not just its name.](assets/fig-reduction.svg)

**Figure 3. Reduction (tree calculus).** Caption …
```

- The **marker** is an HTML comment, so GitHub and other Markdown renderers hide it.
  It needs an `#id` (lowercase letters, digits and hyphens, unique in the piece) and
  a `component`; any other `key="value"` attributes are passed to the component.
  `layout` is not allowed: how wide a figure is drawn is the site's choice.
- The **still** is an image in `assets/` with alt text. It is what every reader
  without the live figure sees: GitHub, atproto readers, and the site without
  JavaScript.
- The **caption** is the paragraph after the image.
- **`figures/<component>.js`** (or `.mjs`) must exist. maxine.science runs figure
  code only from a `writing` commit pinned in its own repo, so merging here never
  changes the code readers run. The component contract is in maxine.science's
  `SPEC.md` ("Figure components").

A marker inside fenced code is an example, not a figure.

The only other marker is `<!-- page-switch -->`, at most once in a report, where the text
introduces the page switch. A report also needs an abstract. Both are described in
[`STYLE.md`](STYLE.md), with the house style for citations, displays and proof links.

## Boxes

Two kinds of quotation in a report are boxes on the site:

```md
> [!THEOREM] The gap
>
> The statement.

> [!DETAILS] By level of support
>
> Anything: paragraphs, lists, a table.
```

- `[!THEOREM] Lead` is a theorem box: shown as "Theorem. Lead", with a rule on its left.
- `[!DETAILS] Label` is a collapsible box, closed until the reader opens it, under whatever label
  suits its use. `[!ESTABLISHED]` is its older name and still works.

GitHub shows both as ordinary quotations, and the atproto copy opens them (below).

## SOURCE

A piece written in another repository and exported here carries a `SOURCE` file:
one line, `<repository> <40-character commit>`, e.g.
`formal-computation 0123456789abcdef0123456789abcdef01234567`.

Exported pieces change upstream. The export script writes the piece into a branch
here (`drafts/<slug>/` before publication, `pieces/<slug>/` after) with an updated
`SOURCE`, and opens a PR. An edit made directly here would be lost at the next
export, so `scripts/validate --against <ref>` fails when an exported piece differs
from `<ref>` but its `SOURCE` doesn't. CI runs it against a PR's base branch, or
against the previous commit on a push. Two changes are allowed without a new
`SOURCE`:

- **publishing:** moving `drafts/<slug>/` to `pieces/<slug>/`;
- **dates:** setting `date` or `updated` in the frontmatter.

Removing `SOURCE` from a piece that had one fails too. Fix typos upstream.

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
10. The piece's directory holds only the files listed in [Files in a piece](#files-in-a-piece),
    of the listed types, with no symbolic links; relative links and images resolve inside it.
    More than 5 MB in total is a warning.
11. Figures are complete: a readable marker with a unique id, a still image in `assets/` with
    alt text, a caption, and the component's file in `figures/`. Only `kind: report` has them.
12. `SOURCE`, if present, is one line: `<repository> <40-character commit>`.
13. With `--against <ref>`: an exported piece that changed since `<ref>` has a new `SOURCE`
    (see [SOURCE](#source)).
14. An exported draft's slug is not also in `pieces/`.
15. A report has an abstract (`> **Abstract.** …`) and at most one `<!-- page-switch -->`;
    other kinds have no page switch. Bare URLs or DOIs in a report's text, and proof links
    labelled "lean", are warnings (see `STYLE.md`).

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

### The atproto copy of a report

A report's figures run only on the site, and some readers (Standard Reader, docs.surf,
pub-search) see only the record. So for `kind: report` the record's `content` and `textContent`
are a projection of the body (`scripts/lib/atproto-report.mjs`):

- **Figures:**
  - the figure comment is removed;
  - the still becomes its PNG at an absolute site URL (`https://maxine.science/files/<slug>/assets/fig-x.png`),
    or the SVG if there's no PNG beside it, with a warning;
  - the caption ends with `[Interactive version →](<canonical>?calc=<calc>#<id>)`, a link to the
    live figure in the calculus its still shows.
- **Boxes** stay quotations, opened, with their lead in bold: `> **Theorem. The gap**`,
  `> **By level of support**`.
- **In `textContent`**, each figure reads `[Figure 2 (interaction nets): title. Caption. Alt text.]`.
- **Links:** other relative links and images (`assets/`, the read-aloud file) become absolute site
  URLs, and `<!-- page-switch -->` goes.
- **Math** becomes text, inline and on its own line. Code is left alone.
  - Symbols, Greek, `\mathrm{}`, `\mathbb{}`, function names (`\log`, `\max`) and accents on
    one letter (`\bar\kappa`) become Unicode, and so do numeric fractions (`\tfrac78` → ⅞).
  - Sub- and superscripts become Unicode when every one in the formula has a form (`Q_a` → Qₐ,
    `H^1` → H¹). Unicode has no subscript b, q or ℓ. So otherwise the whole formula keeps them in
    linear notation, consistently: `t_p : Q_a → Q_b`, `π_b^(−1) ∘ π_a`.
  - A formula with real structure (`\frac{1}{n}`, roots, matrices) stays as TeX and is reported
    as a warning for the author.

Other kinds are unchanged. `node scripts/publish-atproto --show <slug>` prints what a piece's
record would hold, without publishing anything.

## Dropped fields

The seed carried two presentation-only fields that do **not** belong in this repo
(ground rule: "if a field only matters to how the site renders, it does not belong here"):

- **`system`** — index (0–12) into the site's dynamical-systems background library.
- **`readTime`** — display string like `"8 min"`.

Both were extracted into a slug-keyed sidecar handed to the site
(`presentation.json` there), alongside each piece's `register`/`collection`. The
seed's `category` field was converted to `kind` (`article → essay`, `fiction → fiction`,
and the un-categorised co-authored pieces → `dialogue`) and then dropped.
