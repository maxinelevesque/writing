// Every component mounted in a stub DOM, as the page would mount them: each draws inside its host
// only, with ids under the figure's id, and survives its controls, the calculus switch and resizing.
// Run with: node --test post/localization-semantics-1/figures/
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createEnv } from './lib/stubdom.mjs';

// components import their CSS, which the bundler handles; here a .css import is an empty module
register('data:text/javascript,' + encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); }"));

const FIGURES = [
  ['fig-probes', 'probe-grid'], ['fig-runs', 'runs'], ['fig-equalities', 'equalities'], ['fig-predicates', 'predicates'],
  ['fig-lemma', 'lemma'], ['fig-pentagon', 'pentagon'], ['fig-code', 'code-probes'], ['fig-notions', 'notions'],
  ['fig-outside', 'outside'], ['fig-processes', 'processes'], ['fig-exchange', 'exchange'], ['fig-fibres', 'fibres'], ['fig-loop', 'loop']
];

const env = createEnv({ textLength: (s) => [...s].reduce((w, c) => w + (c === '△' ? 13 : 7.5), 0) });
const restore = env.install();
const doc = env.document;
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a); };
// the page outside the hosts is out of bounds
const body = doc.body;
for (const k of ['getElementById', 'querySelector', 'querySelectorAll']) doc[k] = () => { throw new Error('a figure looked up the document: ' + k); };
const hosts = [];
const subs = [];
const ctxFor = (id, calc) => ({
  id, attrs: {}, params: { calc },
  on: (name, fn) => { assert.equal(name, 'calc'); subs.push(fn); return () => {}; },
  reducedMotion: { matches: false, addEventListener() {} }
});
function switchCalc(c) { subs.forEach((f) => f(c)); }
function drawn(host) {
  return [...host.querySelectorAll('svg')].filter((s) => !s.classList.contains('lsfig-ruler'))
    .every((s) => s.querySelectorAll('*').length > 0);
}
function idsScoped(host, id) {
  const bad = [];
  for (const el of host.querySelectorAll('*')) {
    const v = el.getAttribute('id');
    if (v && !v.startsWith(id + '-')) bad.push(v);
    for (const a of el.attributes) {
      for (const m of a.value.matchAll(/url\(#([^)]+)\)/g)) if (!m[1].startsWith(id + '-')) bad.push(a.name + ':' + m[1]);
      if (a.name === 'for' && !a.value.startsWith(id + '-')) bad.push('for:' + a.value);
    }
    // every url(#…) points at an element of this host
    for (const a of el.attributes) for (const m of a.value.matchAll(/url\(#([^)]+)\)/g)) {
      if (![...host.querySelectorAll('[id]')].some((t) => t.getAttribute('id') === m[1])) bad.push('dangling ' + m[1]);
    }
  }
  return bad;
}

test('every component mounts, draws, and keeps to its host', async () => {
  for (const [id, comp] of FIGURES) {
    const mod = await import(`./${comp}.js`);
    const host = doc.createElement('div');
    host.setAttribute('class', 'figure-live');
    host._width = 808;
    body.appendChild(host);
    hosts.push([id, comp, host]);
    mod.mount(host, ctxFor(id, 'ski'));
    assert.ok(host.classList.contains('lsfig') && host.classList.contains('lsfig-' + comp), comp + ': classes');
    assert.equal(host.dataset.calc, 'ski');
    assert.ok(host.querySelectorAll('svg').length > 0 && drawn(host), comp + ': draws');
    assert.deepEqual(idsScoped(host, id), [], comp + ': ids under ' + id);
    for (const svg of host.querySelectorAll('svg[viewBox]')) {
      const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      assert.equal(Number(svg.getAttribute('width')), Math.round(vb[2] * 10) / 10, comp + ': drawn at 1:1');
    }
  }
  assert.equal(body.childNodes.length, FIGURES.length, 'nothing but the hosts in the body');
  assert.deepEqual(errors, []);
});

test('the notions figure has eight drawings, each with its label', () => {
  const host = hosts.find((h) => h[1] === 'notions')[2];
  assert.equal(host.querySelectorAll('.card svg').length, 8);
  assert.equal(host.querySelectorAll('.card .zlabel').length, 8);
  assert.ok(host.querySelectorAll('.zlabel').every((p) => p.textContent.length > 10));
});

test('controls, time, the calculus and the width', () => {
  env.showAll();
  env.advance(3000);
  for (const calc of ['tree', 'net', 'ski', 'net', 'tree']) {
    switchCalc(calc);
    for (const [id, comp, host] of hosts) {
      assert.equal(host.dataset.calc, calc);
      assert.ok(drawn(host), comp + ' draws in ' + calc);
      assert.deepEqual(idsScoped(host, id), [], comp + ': ids in ' + calc);
      for (const b of host.querySelectorAll('button')) { env.click(b); env.advance(400); }
      for (const c of host.querySelectorAll('input[type="checkbox"]')) { env.click(c); env.advance(300); env.click(c); }
      for (const s of host.querySelectorAll('select')) {
        const opts = s.querySelectorAll('option');
        if (opts.length > 1) { env.change(s, opts[opts.length - 1].value); env.advance(300); env.change(s, opts[0].value); }
      }
      for (const g of host.querySelectorAll('[role="button"]').slice(0, 3)) { env.click(g); env.advance(200); }
    }
    env.advance(6000);
    for (const w of [400, 600, 1200, 808]) {
      for (const [, comp, host] of hosts) { env.resize(host, w); assert.ok(drawn(host), comp + ' at ' + w); }
      env.advance(1000);
    }
  }
  assert.deepEqual(errors, []);
});

test('the layout follows the host: tall below the wide layout\'s width', () => {
  switchCalc('ski');
  const host = hosts.find((h) => h[1] === 'runs')[2];
  const svg = host.querySelector('svg');
  env.resize(host, 808);
  assert.equal(svg.getAttribute('data-lay'), 'wide');
  assert.equal(svg.getAttribute('width'), '720');
  env.resize(host, 552);
  assert.equal(svg.getAttribute('data-lay'), 'tall');
  env.resize(host, 808);
  switchCalc('tree');
  assert.equal(svg.getAttribute('data-lay'), 'tall', 'the tree bundle is wider than 808');
  env.resize(host, 1100);
  assert.equal(svg.getAttribute('data-lay'), 'wide');
  env.resize(host, 808);
  switchCalc('ski');
});

test('mount throws when something essential is missing, and leaves the host empty', async () => {
  const { mountFigure } = await import('./lib/essay.js');
  const host = doc.createElement('div');
  const RO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = undefined;
  try {
    assert.throws(() => mountFigure('lemma', host, ctxFor('fig-x', 'ski')), /ResizeObserver/);
  } finally { globalThis.ResizeObserver = RO; }
  assert.equal(host.childNodes.length, 0);
  assert.throws(() => mountFigure('no-such-figure', host, ctxFor('fig-y', 'ski')), /no figure/);
});

test.after(() => { console.error = origError; restore(); });
