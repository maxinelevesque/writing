# Writing a research report

House style for `kind: report` pieces, alongside [`SCHEMA.md`](SCHEMA.md), which covers
what the validator enforces. Most of this comes from Maxine's review of the first preview
of *Localization Semantics I* (2026-11-23). maxine.science renders these conventions as
described in its `SPEC.md` ("Interactive essay format").

`scripts/validate` enforces the items marked **(enforced)** and warns on the ones marked
**(warned)**.

## Shape

- **An abstract (enforced).** Open with a blockquote beginning `> **Abstract.**`. One
  paragraph, sometimes two. It is distinct from the `summary` field, which is the one-paragraph
  description used on atproto and in link cards.
- **Introduce interactions before relying on them.** If the report has a page switch, such as
  the calculus, the text first introduces what it switches between, then explains the control.
  Place `<!-- page-switch -->` on its own line right after that paragraph. The control appears
  there, in the text, and sticks to the top of the window once the reader scrolls past. Use
  the marker once **(enforced)**. Figures before it show the default.

## Citations

- **In the text, name the author; keep the reference in a note.** Write "as Barendregt shows,[^b]"
  rather than putting the full citation in the sentence. Keep to one citation per note where you
  can.
- **Put the link on the title, and don't print a bare DOI or URL (warned).**

  ```md
  [^b]: H. P. Barendregt, [*The Lambda Calculus: Its Syntax and Semantics*](https://doi.org/10.1016/C2009-0-03984-6), North-Holland, 1984.
  ```

  Link a DOI through `https://doi.org/…`.

## Mathematics and code

- **TeX is only for mathematics.** Combinator terms, programs and identifiers are code spans:
  `` `S K K x` ``.
- **Display long expressions rather than setting them inline.** An expression that would take
  more than about half a line, or a chain of steps, goes on its own:
  - mathematics in `$$ … $$`, with `\begin{aligned} … \end{aligned}` for several aligned lines;
  - a long term or reduction in a fenced code block (`` ```text ``), which the site sets as a
    display.
- **A sentence can run on after a display.** If the paragraph continues after a display, start the
  next line directly below the closing `$$` or fence, with no blank line. It is then not indented,
  as in LaTeX. A blank line after the display starts a new paragraph.

  ```md
  Four twelfths reduce by their common factor,

  $$
  \frac{4}{12} = \frac{1}{3},
  $$
  and the sentence continues here.
  ```

- Keep inline TeX short. Tall inline math (fractions, sums with limits) pushes lines apart; display
  it instead.

## Proofs

- **Link the proved statement itself** to its Lean source at a pinned commit:
  `[every term has a normal form](https://github.com/…/blob/<commit>/File.lean#L120)`. The site
  sets such links with a faint dotted underline ending in ⊢, and tells screen readers they lead
  to a proof. Don't add a separate "lean" or "proof" link **(warned)**.
- **Link a name to its definition** the same way, with a title that begins `Definition:`:
  `[the eager table](https://github.com/…/IxTree.lean#L128 "Definition: Ix.TC.eagerTable")`. The
  site ends it in `:=`, as Lean writes a definition, instead of ⊢. Only proved statements and
  definitions get Lean links; link anything else in Lean (a file of checks, a folder) by its
  folder, not a `.lean` file.
- **Explain the conventions once**, in a note at the first proof link: "A statement with a faint
  dotted underline, ending in ⊢, links to its machine-checked proof in Lean. A name ending in :=
  links to its definition in Lean."

## Figures

See [`SCHEMA.md`](SCHEMA.md#figures) for the three blocks: marker, still and caption. Alt text and
captions carry the figure's actual content, because text-only readers and the read-aloud
companion depend on them. Each caption names the calculus its still shows.

## Cards

For a set of related ideas, each with a small picture, use cards
([`SCHEMA.md`](SCHEMA.md#cards)) rather than a figure followed by paragraphs. The bold heading is
the card's title, so the picture needs none. Say what the pictures' marks mean in the sentence
that introduces the cards.

## Tables

Plain Markdown tables. Leave widths to the site: a table wider than the text column takes room
from the margins on wide screens and scrolls on narrow ones. Headers are left-aligned unless the
table sets an alignment.
