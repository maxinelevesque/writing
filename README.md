# writing

Authoritative source for Maxine Levesque's public-facing written work. Everything
downstream — [maxine.science](https://maxine.science), atproto records — is derived
from this repo, never edited in place there.

- `pieces/<slug>/index.md` — **published.** The canonical text. A change here goes live.
- `drafts/` — **staged.** Free-form working copies. Nothing here is consumed or published.
  Promotion to `pieces/` is the act of publishing.

Content is plain Markdown with minimal *semantic* frontmatter. Presentation choices
(theme, background system, read time) live downstream in the site, keyed by slug.

See `PROMPT.md` for the setup/migration brief.
