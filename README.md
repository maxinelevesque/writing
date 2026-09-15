# writing

Authoritative source for Maxine Levesque's public-facing written work. Everything
downstream — [maxine.science](https://maxine.science), atproto records — is derived
from this repo, never edited in place there.

- `pieces/<slug>/index.md` — **published.** The canonical text. A change here goes live.
- `drafts/` — **staged.** Free-form working copies. Nothing here is consumed or published.
  Promotion to `pieces/` is the act of publishing.

Content is plain Markdown with minimal *semantic* frontmatter. Presentation choices
(theme, background system, read time) live downstream in the site, keyed by slug.
The frontmatter schema is documented in [`SCHEMA.md`](SCHEMA.md) and enforced by
`scripts/validate` — the only gate on publishing.

## Draft/publish separation

The directory split *is* the separation — there is no draft flag and no branch
protection to remember.

- Anything in `drafts/` is invisible to every consumer. Edit freely there.
- **Promotion is the act of publishing.** Move the file into a `pieces/<slug>/` dir:

  ```sh
  mkdir -p pieces/<slug> && git mv drafts/<slug>.md pieces/<slug>/index.md
  # give it valid frontmatter (see SCHEMA.md), then:
  ./scripts/validate && git commit -am "Publish: <slug>"
  ```

  On push to `main`, CI validates, publishes the atproto record, and rebuilds the site.

Removing a piece is the reverse: `git mv pieces/<slug>/index.md drafts/<slug>.md`
(or delete it). Its atproto record is deleted on the next publish.

See `PROMPT.md` for the setup/migration brief.
