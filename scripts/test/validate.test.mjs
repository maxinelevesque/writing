// Tests for scripts/validate: figures, the files a piece may hold, exported
// drafts, and the SOURCE rule. Each test builds a scratch git repository with
// a copy of the scripts and runs the validator there.
//   npm test   (node --test 'scripts/test/*.test.mjs')
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT_A = 'a'.repeat(40);
const COMMIT_B = 'b'.repeat(40);

const report = ({ date = 'date: 2026-11-20\n', extra = '', body } = {}) => `---
title: "A report"
${date}kind: report
coauthor: "Claude"
canonical: https://maxine.science/research/r
readAloud: read-aloud.txt
${extra}---

> **Abstract.** What the report shows.

Text.[^n]

<!-- figure #fig-bar component="bar" calc="tree" -->

![Four of twelve cells are filled.](assets/bar.svg)

**Figure 1. A bar (tree calculus).** Caption.

[^n]: A note.
${body ?? ''}`;

function repo(t) {
  const root = mkdtempSync(join(tmpdir(), 'validate-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(SCRIPTS, join(root, 'scripts'), { recursive: true, filter: (p) => !p.includes(`${join('scripts', 'test')}`) });
  writeFileSync(join(root, 'personas.json'), JSON.stringify({ claude: { did: 'did:web:example' } }));
  mkdirSync(join(root, 'pieces'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  const write = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  const piece = (dir, { index = report(), source = `formal-computation ${COMMIT_A}\n` } = {}) => {
    write(`${dir}/index.md`, index);
    write(`${dir}/assets/bar.svg`, '<svg xmlns="http://www.w3.org/2000/svg"/>');
    write(`${dir}/figures/bar.js`, 'export function mount() {}');
    write(`${dir}/read-aloud.txt`, 'Read aloud.');
    if (source !== null) write(`${dir}/SOURCE`, source);
  };
  const commit = () => { git('add', '-A'); git('commit', '-q', '-m', 'x'); };
  const run = (...args) => {
    const r = spawnSync('node', [join(root, 'scripts', 'validate'), ...args], { encoding: 'utf8' });
    return { ok: r.status === 0, out: r.stdout + r.stderr };
  };
  return { root, write, piece, commit, run, git };
}

const fails = (r, pattern) => { assert.equal(r.ok, false, r.out); assert.match(r.out, pattern); };
const passes = (r) => assert.equal(r.ok, true, r.out);

test('a complete report with a figure passes', (t) => {
  const r = repo(t);
  r.piece('pieces/r');
  passes(r.run());
});

test('alt text may contain escaped brackets', (t) => {
  const r = repo(t);
  r.piece('pieces/r', { index: report().replace('![Four of twelve cells are filled.]',
    String.raw`![Cells \[1, 4\] are filled, and \] is a bracket.]`) });
  passes(r.run());
});

test('an exported draft is validated, without a date; a free-form draft is not', (t) => {
  const r = repo(t);
  r.piece('pieces/r');
  r.piece('drafts/d', { index: report({ date: '' }).replace('/research/r', '/research/d') });
  r.write('drafts/notes/index.md', 'just notes, no frontmatter');
  const ok = r.run();
  passes(ok);
  assert.match(ok.out, /1 exported draft/);
  r.write('drafts/d/index.md', report({ date: '' }).replace('/research/r', '/research/d').replace('component="bar"', 'component="missing"'));
  fails(r.run(), /drafts\/d: figure #fig-bar: no figures\/missing\.js/);
});

test('incomplete figures fail', (t) => {
  for (const [change, pattern] of [
    [(s) => s.replace('![Four of twelve cells are filled.]', '![]'), /needs alt text/],
    [(s) => s.replace('**Figure 1. A bar (tree calculus).** Caption.', ''), /followed by a caption/],
    [(s) => s.replace(/!\[Four[^\n]*\n/, 'Not an image.\n'), /followed by a still image/],
    [(s) => s.replace('component="bar"', 'component="bar" layout="full"'), /layout is set by the site/],
    [(s) => s.replace('calc="tree"', 'calc=tree'), /unreadable figure marker/],
    [(s) => s.replace('#fig-bar ', ''), /needs an id/],
    [(s) => s + '\n<!-- figure #fig-bar component="bar" -->\n\n![Alt.](assets/bar.svg)\n\nCaption.\n', /#fig-bar is used twice/],
    [(s) => s.replace('kind: report', 'kind: essay').replace('coauthor: "Claude"\n', '').replace('/research/', '/writing/'), /only rendered for kind: report/],
  ]) {
    const r = repo(t);
    r.piece('pieces/r', { index: change(report()) });
    const out = r.run();
    assert.equal(out.ok, false, `expected ${pattern} but it passed`);
    assert.match(out.out, pattern);
  }
});

test('a figure marker inside fenced code is an example, not a figure', (t) => {
  const r = repo(t);
  r.piece('pieces/r', { index: report({ body: '\n```md\n<!-- figure #x component="nope" -->\n```\n' }) });
  passes(r.run());
});

test('links and images stay inside the piece and point at what it serves', (t) => {
  for (const [body, pattern] of [
    ['\n![Alt.](../other/x.svg)\n', /must stay inside/],
    ['\n![Alt.](assets/missing.svg)\n', /no such file/],
    ['\n![Alt.](figures/bar.js)\n', /images must be in assets/],
    ['\nSee [the code](figures/bar.js).\n', /links may point into assets\/ or at the readAloud/],
  ]) {
    const r = repo(t);
    r.piece('pieces/r', { index: report({ body }) });
    fails(r.run(), pattern);
  }
  const r = repo(t);
  r.piece('pieces/r', { index: report({ body: '\n[Read aloud](read-aloud.txt), [still](./assets/bar.svg), [site](/writing/x), [web](https://example.com/a.b).\n' }) });
  passes(r.run());
});

test('a piece holds only index.md, SOURCE, assets/, figures/ and its readAloud file', (t) => {
  for (const [setup, pattern] of [
    [(r) => r.write('pieces/r/notes.md', 'x'), /unexpected file notes\.md/],
    [(r) => r.write('pieces/r/assets/data.csv', 'x'), /assets\/ holds images/],
    [(r) => r.write('pieces/r/figures/run.sh', 'x'), /figures\/ holds code/],
    [(r) => symlinkSync('/etc/hosts', join(r.root, 'pieces/r/assets/link.svg')), /symbolic link/],
    [(r) => r.write('pieces/r/SOURCE', 'formal-computation abc\n'), /SOURCE must be one line/],
  ]) {
    const r = repo(t);
    r.piece('pieces/r');
    setup(r);
    fails(r.run(), pattern);
  }
});

test('a piece over 5 MB warns but passes', (t) => {
  const r = repo(t);
  r.piece('pieces/r');
  r.write('pieces/r/assets/big.png', Buffer.alloc(6 * 1024 * 1024));
  const out = r.run();
  passes(out);
  assert.match(out.out, /6\.0 MB in total/);
});

test('SOURCE: an exported piece changes only by re-export', (t) => {
  const r = repo(t);
  r.piece('drafts/r', { index: report({ date: '' }) });
  r.write('pieces/hand/index.md', '---\ntitle: "Hand"\ndate: 2026-01-01\nkind: essay\ncanonical: https://maxine.science/writing/hand\n---\n\nText.\n');
  r.commit();

  // Pieces without SOURCE are edited freely.
  appendFileSync(join(r.root, 'pieces/hand/index.md'), 'More.\n');
  passes(r.run('--against', 'HEAD'));

  // Editing an exported piece without re-exporting fails…
  appendFileSync(join(r.root, 'drafts/r/index.md'), 'A typo fix.\n');
  fails(r.run('--against', 'HEAD'), /drafts\/r: changed \(index\.md\) without updating SOURCE\. This piece is exported from formal-computation/);
  r.write('drafts/r/assets/bar.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
  fails(r.run('--against', 'HEAD'), /changed \(.*assets\/bar\.svg.*\)/);

  // …and passes when SOURCE moves with it.
  r.write('drafts/r/SOURCE', `formal-computation ${COMMIT_B}\n`);
  passes(r.run('--against', 'HEAD'));
  r.commit();

  // Publishing: move drafts/ → pieces/ and set the date, with no other change.
  renameSync(join(r.root, 'drafts/r'), join(r.root, 'pieces/r'));
  r.write('pieces/r/index.md', report().replace('Text.[^n]', 'Text.[^n]') + 'A typo fix.\n');
  passes(r.run('--against', 'HEAD'));
  r.write('pieces/r/index.md', report() + 'A typo fix, then another.\n');
  fails(r.run("--against", "HEAD"), /✗ r: changed \(index\.md\)/);
  r.write('pieces/r/index.md', report() + 'A typo fix.\n');
  r.commit();

  // Removing SOURCE is not a way around it.
  rmSync(join(r.root, 'pieces/r/SOURCE'));
  fails(r.run('--against', 'HEAD'), /SOURCE was removed/);
});

test('report conventions: abstract, one page switch, citations and proof links', (t) => {
  const run = (index) => { const r = repo(t); r.piece('pieces/r', { index }); return r.run(); };
  fails(run(report().replace('> **Abstract.** What the report shows.\n', '')), /needs an abstract/);
  passes(run(report({ body: '\nIntroducing the switch.\n\n<!-- page-switch -->\n' })));
  fails(run(report({ body: '\n<!-- page-switch -->\n\nText.\n\n<!-- page-switch -->\n' })), /appears 2 times/);

  const warned = run(report({ body: '\nSee https://doi.org/10.1000/xyz and <https://example.org/a>.[^c] Proved [lean](https://example.org/A.lean#L3).\n\n[^c]: Author, [*Title*](https://doi.org/10.1000/abc).\n' }));
  passes(warned);
  assert.match(warned.out, /bare link or DOI "https:\/\/doi\.org\/10\.1000\/xyz/);
  assert.match(warned.out, /bare link or DOI "https:\/\/example\.org\/a/);
  assert.doesNotMatch(warned.out, /abc/, 'a link on the title is the right form');
  assert.match(warned.out, /proof link labelled "lean"/);

  const r = repo(t);
  r.write('pieces/e/index.md', '---\ntitle: "E"\ndate: 2026-01-01\nkind: essay\ncanonical: https://maxine.science/writing/e\n---\n\n<!-- page-switch -->\n\nText.\n');
  fails(r.run(), /only rendered for kind: report/);
});

test('cards: a marked list of pictures with bold headings, only in reports', (t) => {
  const run = (body) => { const r = repo(t); r.piece('pieces/r', { index: report({ body }) }); return r.run(); };
  const card = (alt, heading = '**Heading.** Text.') => `- ![${alt}](assets/bar.svg) ${heading}`;
  passes(run(`\n<!-- cards -->\n\n${card('One.')}\n${card('Two.')}\n`));
  passes(run(`\n<!-- cards -->\n\n${card('One.')}\n\n${card('Two.')}\n\n  A second paragraph.\n\n${card('Three.')}\n`));
  fails(run('\n<!-- cards -->\n\nNo list.\n'), /must be followed by a bulleted list/);
  fails(run(`\n<!-- cards -->\n\n${card('One.')}\n- **No picture.** Text.\n`), /starts with its picture/);
  fails(run(`\n<!-- cards -->\n\n${card('One.', 'No heading.')}\n`), /starts with its picture/);
  fails(run(`\n<!-- cards -->\n\n${card('')}\n`), /needs alt text/);
  fails(run(`\n<!-- cards -->\n\n- ![A.](assets/missing.svg) **H.** T.\n`), /missing\.svg/);
  assert.doesNotMatch(run(`\n<!-- cards -->\n\n${card('One.')}\n`).out, /unknown marker/);

  const r = repo(t);
  r.write('pieces/e/index.md', '---\ntitle: "E"\ndate: 2026-01-01\nkind: essay\ncanonical: https://maxine.science/writing/e\n---\n\n<!-- cards -->\n\n- ![A.](a.svg) **H.** T.\n');
  fails(r.run(), /cards --> is only rendered for kind: report/);
});
