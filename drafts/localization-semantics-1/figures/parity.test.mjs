// The components draw what the essay drew: post/atoms-and-probes.html under post/lab's stub DOM, against
// the components under figures/lib/stubdom.mjs, compared element by element (svgs and readouts) once the
// figure's id is taken out of the ids and the 1:1 width and height of each svg are dropped.
// Skipped where the essay is not at hand (outside the formal-computation repository).
// Run with: node --test post/localization-semantics-1/figures/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { register } from 'node:module';
import { createEnv } from './lib/stubdom.mjs';

register('data:text/javascript,' + encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); }"));

const ESSAY = new URL('../../atoms-and-probes.html', import.meta.url);
const STUB = new URL('../../lab/stubdom.js', import.meta.url);
const here = fs.existsSync(ESSAY) && fs.existsSync(STUB);

// component, figure id, and the original ids compared (drawings and the texts the script writes)
const FIGURES = [
  ['probe-grid', 'fig-probes', ['svg-tree', 'grid', 'benchsay', 'benchrun', 'benchverdict', 'benchread']],
  ['runs', 'fig-runs', ['svg-hero', 'now', 'stepinfo', 'heroread', 'focus', 'order']],
  ['equalities', 'fig-equalities', ['svg-base', 'baseread', 'basecap']],
  ['predicates', 'fig-predicates', ['svg-paint', 'verdict', 'paintread', 'pred']],
  ['lemma', 'fig-lemma', ['svg-lemma', 'lemmaread']],
  ['pentagon', 'fig-pentagon', ['svg-pent', 'svg-exit', 'pentread']],
  ['code-probes', 'fig-code', ['svg-code', 'coderead', 'readcode']],
  ['notions', 'fig-notions', ['z0', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7']],
  ['outside', 'fig-outside', ['svg-outside']],
  ['processes', 'fig-processes', ['svg-proc']],
  ['exchange', 'fig-exchange', ['svg-grid', 'gridread']],
  ['fibres', 'fig-fibres', ['fib-a', 'fib-w', 'fread']],
  ['loop', 'fig-loop', ['svg-loop', 'svg-kloop', 'loopread', 'kloopread']]
];
// what a reader can do that needs no animation loop to be running (the pentagon and the fibres run one
// from the start in the essay, and only once seen in the component, so their clicks are left out)
const ACTIONS = {
  'probe-grid': ['[data-r="0"][data-c="2"]', '.tab[data-r="text"]', '#benchcode', '.tab[data-r="probe"]'],
  runs: ['[data-l="1"]', '[data-l="2"]', '#play', '[data-l="4"]', '[data-l="3"]'],
  equalities: ['[data-m="syntax"]', '[data-m="test"]', '#addrule', '[data-m="run"]'],
  predicates: ['#closeit'],
  lemma: ['[data-k="2"]', '#lemmaplay'],
  'code-probes': ['#readcode'],
  exchange: ['#gridab', '#gridab', '#gridba', '#gridreset', '#gridab'],
  loop: ['#lapfwd', '#ksend']
};

const MOVED = ['basecap', 'pentread'];

function norm(html, prefix) {
  return html.split(prefix).join('')
    .replace(/^(<svg[^>]*?) width="[^"]*" height="[^"]*"/, '$1')
    .replace(/ data-stub-[a-z]+="[^"]*"/g, '')
    .replace(/var\(--ls-/g, 'var(--');      // the essay's colour properties carry a prefix here
}

function original(width) {
  const require = createRequire(import.meta.url);
  const { load } = require(STUB.pathname);
  return load(fs.readFileSync(ESSAY, 'utf8'), { width });
}

async function components(width) {
  const env = createEnv();
  const restore = env.install();
  const subs = [];
  const hosts = {};
  for (const [comp, id] of FIGURES) {
    const mod = await import(`./${comp}.js`);
    const host = env.document.createElement('div');
    host._width = width;
    env.document.body.appendChild(host);
    mod.mount(host, { id, attrs: {}, params: { calc: 'ski' }, on: (n, f) => { subs.push(f); return () => {}; }, reducedMotion: { matches: false } });
    hosts[comp] = host;
  }
  return { env, restore, hosts, setCalc: (c) => subs.forEach((f) => f(c)) };
}

// the figures whose markers run on a clock of their own, from the start in the essay and once seen here
const LOOPING = ['pentagon', 'fibres'];

function compare(orig, mine, label, timed) {
  const diffs = [];
  for (const [comp, id, ids] of FIGURES) {
    if (timed && LOOPING.includes(comp)) continue;
    for (const k of ids) {
      const a = orig.$(k), b = mine.hosts[comp].querySelector('#' + id + '-' + k);
      assert.ok(a, `essay has #${k}`);
      assert.ok(b, `${comp} has #${id}-${k}`);
      // a live text that the essay kept in its caption is a readout of its own here: compare the text
      const moved = MOVED.includes(k);
      const x = moved ? a.textContent : norm(a.outerHTML, '\u0000'), y = moved ? b.textContent : norm(b.outerHTML, id + '-');
      if (x !== y) {
        let i = 0;
        while (i < x.length && x[i] === y[i]) i++;
        diffs.push(`${label} ${comp} #${k} at ${i}:\n  essay:     …${x.slice(Math.max(0, i - 80), i + 120)}\n  component: …${y.slice(Math.max(0, i - 80), i + 120)}`);
      }
    }
  }
  assert.deepEqual(diffs, []);
}

for (const [width, hostWidth] of [[1200, 1200], [400, 352]]) {
  test(`the components draw what the essay drew (window ${width}, host ${hostWidth})`, { skip: !here && 'post/atoms-and-probes.html not found' }, async () => {
    const orig = original(width);
    const mine = await components(hostWidth);
    try {
      compare(orig, mine, 'ski');
      for (const c of ['tree', 'net', 'ski']) {
        orig.setHash(c === 'ski' ? '' : '#calc=' + c);
        mine.setCalc(c);
        compare(orig, mine, c, c !== 'tree');
        for (const [comp, sels] of Object.entries(ACTIONS)) {
          const [, id] = FIGURES.find((f) => f[0] === comp);
          for (const sel of sels) {
            const a = sel.startsWith('#') ? orig.$(sel.slice(1)) : orig.document.querySelector(FIGURE_SCOPE[comp] + ' ' + sel);
            const b = mine.hosts[comp].querySelector(sel.startsWith('#') ? '#' + id + '-' + sel.slice(1) : sel);
            assert.ok(a && b, `${comp}: ${sel}`);
            orig.click(a); mine.env.click(b);
            orig.advance(4000); mine.env.advance(4000);
          }
        }
        compare(orig, mine, c + ' after the controls', true);
      }
    } finally { mine.restore(); }
  });
}

// in the essay a selector for a control is scoped by an svg of its figure
const FIGURE_SCOPE = {
  'probe-grid': 'figure', runs: 'figure', equalities: 'figure', predicates: 'figure', lemma: 'figure',
  'code-probes': 'figure', exchange: 'figure', loop: 'figure'
};
