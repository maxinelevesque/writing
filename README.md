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

## Add a piece, end to end

```sh
mkdir -p pieces/my-slug && $EDITOR pieces/my-slug/index.md   # write it (frontmatter per SCHEMA.md)
./scripts/validate                                           # must pass — the publish gate
git add pieces/my-slug && git commit -m "Publish: my-slug"
git push                                                     # → CI: validate → atproto → site rebuild
# canonical is https://maxine.science/writing/my-slug (or /dialogues/my-slug for kind: dialogue)
```

## Downstream pipeline

On push to `main` touching `pieces/**`, `.github/workflows/publish.yml`:

1. **validate** — `scripts/validate` against the schema (also runs standalone on PRs via `validate.yml`).
2. **atproto** — `scripts/publish-atproto` upserts one `site.standard.publication`
   (from [`publication.json`](publication.json)) and one `site.standard.document`
   per piece (title, path, dates, description, `tags`, `contributors`, and the
   site's OG image as `coverImage`); pieces that left `pieces/` are deleted. The
   lexicon uses TID record keys (assigned by the PDS on first write), so the
   slug → at-uri/cid map is committed back to [`records.json`](records.json),
   which is what keeps publishing idempotent and the mapping inspectable.
   Publication metadata lives in `publication.json`; AI-persona contributors (with
   their DIDs) live in `personas.json`. See [`SCHEMA.md`](SCHEMA.md).
3. **site rebuild** — a `repository_dispatch` (`content-updated`) to
   `maxinelevesque/maxinelevesque.github.io`, which clones this repo, generates its
   `src/content/**` from `pieces/**` (merging a local `presentation.json` for
   `system`/`readTime`/register), and deploys.

Run the atproto step locally without credentials: `node scripts/publish-atproto --dry-run`.

## Secrets (set on this repo)

| Secret | Used by | Purpose |
|---|---|---|
| `ATP_IDENTIFIER` | publish-atproto | atproto handle/DID that owns the records (a maxine.science identity) |
| `ATP_APP_PASSWORD` | publish-atproto | app password for that identity |
| `ATP_PDS_URL` | publish-atproto | PDS base URL (defaults to `https://bsky.social` if unset) |
| `SITE_DISPATCH_TOKEN` | publish.yml | fine-grained PAT with `contents:write` on the site repo, to fire the rebuild dispatch |

See `PROMPT.md` for the setup/migration brief.
