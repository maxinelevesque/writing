// attrs.still === '1' (used only by the still generator): each component draws its default state at once,
// with nothing left running (no timers, no frames) and no observers needed.
// Run with: node --test post/localization-semantics-1/figures/
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createEnv } from './lib/stubdom.mjs';

register('data:text/javascript,' + encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); }"));

// the calculus each still shows (post/CONVERSION.md, "Figures")
const STILLS = [
  ['fig-probes', 'probe-grid', 'ski'], ['fig-runs', 'runs', 'tree'], ['fig-equalities', 'equalities', 'ski'],
  ['fig-predicates', 'predicates', 'net'], ['fig-lemma', 'lemma', 'ski'], ['fig-pentagon', 'pentagon', 'net'],
  ['fig-code', 'code-probes', 'tree'], ['fig-notions', 'notions', null], ['fig-outside', 'outside', null],
  ['fig-processes', 'processes', null], ['fig-exchange', 'exchange', null], ['fig-fibres', 'fibres', 'tree'], ['fig-loop', 'loop', 'net']
];

test('a still is drawn at once and leaves nothing running', async () => {
  const env = createEnv({ noResizeObserver: true, noIntersectionObserver: true });
  const restore = env.install();
  try {
    for (const [id, comp, calc] of STILLS) {
      const { mount } = await import(`./${comp}.js`);
      const host = env.document.createElement('div');
      host._width = 808;
      env.document.body.appendChild(host);
      const r = mount(host, { id, attrs: { still: '1' }, params: calc ? { calc } : {}, on: () => () => {}, reducedMotion: { matches: false } });
      await r;
      if (calc) assert.equal(host.dataset.calc, calc, comp);
      const svgs = host.querySelectorAll('svg');
      assert.ok(svgs.length && svgs.every((s) => s.querySelectorAll('*').length > 0), comp + ' draws');
      assert.equal(env.timers.length, 0, comp + ': no timers left');
      assert.equal(env.frames.length, 0, comp + ': no frames left');
    }
  } finally { restore(); }
});
