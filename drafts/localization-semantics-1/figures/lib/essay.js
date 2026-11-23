/* The figures of "Localization Semantics I", as components of the site's interactive essay format
   (SPEC.md, "Figure components"). Ported from the figure script of post/atoms-and-probes.html with as
   little change of meaning as could be managed:
   - each figure's former IIFE is FIGS[component](root, F), run by mountFigure(component, host, ctx);
   - ids live under the figure's id: F.$('grid') is the element whose id is `${ctx.id}-grid`;
   - the calculus comes from ctx.params.calc and ctx.on('calc'); one state for the page, as before;
   - widths come from the host (a ResizeObserver), never from the window; drawings are at 1:1, and a
     figure switches to its tall layout when its host is narrower than its wide one;
   - reduced motion comes from ctx.reducedMotion;
   - ctx.attrs.still === '1' (used only by the still generator) draws the default state once, with no
     autoplay and no animation.
   Nothing here touches the DOM when the module is imported. */
import { CALC as CALC_ALL } from './calc.js';
import { TEMPLATES } from './templates.js';

var RM = false;
var NS = 'http://www.w3.org/2000/svg';
function S(tag, attrs, parent) {
  var e = document.createElementNS(NS, tag);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
function op(el, o) { el.style.opacity = o; }
function ease(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
// a drawing at 1:1: its width and height are those of its view box, and CSS lets it shrink to the host
function setVB(svg, vb) {
  svg.setAttribute('viewBox', vb);
  var q = String(vb).split(/[\s,]+/).map(Number);
  if (q.length === 4 && q[2] > 0 && q[3] > 0) { svg.setAttribute('width', r1(q[2])); svg.setAttribute('height', r1(q[3])); }
}
var WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
function word(n) { return WORDS[n] || String(n); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function steps(n) { return word(n) + (n === 1 ? ' step' : ' steps'); }
// restart a one-shot CSS cue on an element
function kick(el, cls) { el.classList.remove(cls); el.getBoundingClientRect(); el.classList.add(cls); }
// run frame(u) for u from 0 to 1: smoothly, or in a few plain jumps when the reader has asked for reduced motion
function animate(ms, frame, done, jumps) {
  var h = { live: true, stop: function () { h.live = false; } };
  if (RM) {
    var n = jumps || 5, k = 0;
    // the first jump waits a moment, so that the caller holds the handle before anything can finish
    setTimeout(function hop() {
      if (!h.live) return;
      k++; frame(k / n);
      if (k < n) setTimeout(hop, Math.max(420, ms / n)); else { h.live = false; if (done) done(); }
    }, 0);
  } else {
    var t0 = null;
    requestAnimationFrame(function tick(ts) {
      if (!h.live) return;
      if (t0 === null) t0 = ts;
      var u = Math.min(1, (ts - t0) / ms);
      frame(u);
      if (u < 1) requestAnimationFrame(tick); else { h.live = false; if (done) done(); }
    });
  }
  return h;
}
function hasIO() { return typeof IntersectionObserver === 'function'; }
// call fn the first time el is half on screen
function onFirstView(el, fn) {
  if (!hasIO()) return;
  var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.5 });
  io.observe(el);
}

/* ---------- reducer ----------
   The calculi are the modules of post/lab, in ./calc.js (scripts/convert/build-calc.py):
   combinatory logic is CALC.ski, tree calculus CALC.tree, interaction nets CALC.net, and CALC.graph
   builds reduction graphs and lays out bundles. The short names below are those the figures used. */
var CALC = CALC_ALL, SKI = CALC.ski, TREE = CALC.tree, NET = CALC.net, GRAPH = CALC.graph;
var A = SKI.atom, App = SKI.app;
var parse = SKI.parse, plain = SKI.plain, spine = SKI.spine, redexes = SKI.redexes, redexInner = SKI.redexInner;
// printed form with ω for S I I; marks the redex r when given
function pretty(t, r, html) { return SKI.print(t, { html: !!html, mark: r || undefined }); }
function redexOuter(t) { return redexes(t)[0] || null; }
function contractAt(t, r) { return SKI.contract(t, r); }
function ruleOf(r) { return r.rule; }
function runOuter(t) { return SKI.run(t, 'outer', 40); }
function nfOuter(t) { var seq = runOuter(t), last = seq[seq.length - 1]; return redexOuter(last) ? null : plain(last); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function r1(x) { return Math.round(x * 10) / 10; }
/* The width of a term's box: 7.6 a character of the mono font, and 14 of padding. A label with △ is
   measured in the browser (the glyph may come from a wider fallback font); where nothing can be
   measured (under the test's stub DOM) a △ counts 1.15 em. Labels without △ keep the plain estimate. */
var WIDTHS = {}, ruler = null, measured = false, RULER_HOST = null;
// The ruler is a hidden svg inside a mounted host, so that it has the figures' CSS (and never touches
// the page outside the hosts). Without a connected host, or without getComputedTextLength, the plain
// estimate stands.
function boxW(s) {
  s = String(s);
  if (s.indexOf('△') < 0) return s.length * 7.6 + 14;
  if (WIDTHS[s] !== undefined) return WIDTHS[s];
  var d = s.split('△').length - 1, w = r1((s.length - d) * 7.6 + d * 14.4 + 14);
  if (ruler && !ruler.isConnected) ruler = null;
  if (ruler === null && RULER_HOST && RULER_HOST.isConnected) {
    var probe = document.createElementNS(NS, 'text');
    if (typeof probe.getComputedTextLength === 'function') {
      var box = S('svg', { width: 0, height: 0, 'aria-hidden': 'true', 'class': 'lsfig-ruler' });
      box.style.position = 'absolute'; box.style.visibility = 'hidden'; box.style.pointerEvents = 'none';
      probe.setAttribute('class', 't-atom'); box.appendChild(probe); RULER_HOST.appendChild(box);
      ruler = probe;
    }
  }
  if (ruler) {
    ruler.textContent = s;
    var m = ruler.getComputedTextLength();
    if (m > 0) { w = r1(m + 14); measured = true; } else { WIDTHS[s] = undefined; return w; }    // not laid out yet: ask again later
  }
  WIDTHS[s] = w;
  return w;
}

/* ---------- the calculus ----------
   One state for the page, combinatory logic by default. The page's switch sets it, through ctx.params.calc
   on mount and ctx.on('calc') after. A figure that depends on it registers a redraw with onCalc; text that
   holds in some calculi only (data-only) is shown by the stylesheet from the host's data-calc. */
var CALC_NAME = { ski: 'Combinatory logic', tree: 'Tree calculus', net: 'Interaction nets' };
var calc = null, CALC_HOOKS = [], HOSTS = [];
function onCalc(f) { CALC_HOOKS.push(f); }
function runHooks(c) {
  CALC_HOOKS.forEach(function (f) {
    try { f(c); } catch (e) { if (typeof console !== 'undefined') console.error(e); }      // one figure's failure leaves the others drawn
  });
}
function setCalc(c) {
  if (!CALC_NAME[c]) c = 'ski';
  if (c === calc) return;
  calc = c;
  HOSTS.forEach(function (h) { h.dataset.calc = c; });
  runHooks(c);
}

/* The accessible description of each large figure, for tree calculus and for nets. Combinatory logic keeps the
   one written in the template. Keyed by the svg's id as written in the template. */
var ARIA = {
  'svg-hero': {
    tree: 'Nineteen tree terms drawn beside the values they run to. Each arrow is one step. Terms joined by steps are grouped over one point on a line.',
    net: 'The nets that the chosen term can reach, drawn as dots placed by the number of interactions done, from left to right, or from top to bottom on a narrow screen. The green path is the run in the chosen order. Under One step the net itself is drawn.' },
  'svg-base': { tree: 'The same nineteen tree terms. A dotted line joins each one to a point on the line. Changing the equality slides the points together or apart.' },
  'svg-paint': { tree: 'The same nineteen tree terms, shaded where the chosen predicate holds. A red arrow marks a step with one shaded end and one unshaded end.' },
  'svg-code': { tree: 'The same nineteen tree terms, with the points placed by sameness under probes. The probes of tree calculus read code, so I, S K K and S K (△K) stand on three points.' },
  'svg-lemma': { tree: 'Three terms in a row: △△, then △△ u v, then u. A dashed arrow labelled as a probe joins the first to the second. A solid arrow labelled as the K-rule joins the second to the third. A dot that marks membership in a type moves from the third term back to the first.' },
  'svg-exit': {
    tree: 'Five terms in a cycle, the loop of K a (ω ω) in trees. An arrow leaves each of them for the normal form a, which stands over one point. One marker goes round the cycle and another takes the first exit.',
    net: 'The eager net of K a (ω ω). Its result port reads a after three interactions, while a count of the interactions of the whole net rises to the cap of 400 in the run shown.' },
  'fib-a': {
    tree: 'The fibre of K a (I b) in trees: four terms, with three routes to the normal form a, over a point marked a. The views show it as one point, as a filled shape in which a round trip shrinks to nothing, with arrows that end at a, and with the lengths of the routes.',
    net: 'Every net that K a (I b) can reach, drawn as dots placed by the number of interactions done, over a point marked a. Where two interactions can both fire, the two orders close a square.' },
  'fib-w': {
    tree: 'The loop omega omega in trees: five terms in a cycle, over a hollow point marked no value reached in the terms drawn. The views show it as one hollow point, as a ring that nothing fills in the graph drawn, with a marker going round the cycle, and with a count of steps that rises with each lap.',
    net: 'The first five layers of the nets that omega omega can reach, drawn as dots, over a hollow point marked no value reached. They contain squares, each a round trip that swapping two interactions fills.' },
  'svg-loop': { tree: 'The five tree terms of the loop omega omega, joined in a cycle by five steps, over a hollow point marked no value reached in the terms drawn. A marker travels round the cycle, and the evidence it carries is shown in the middle.' },
  'svg-kloop': { tree: 'Five terms in a cycle, each with an arrow out to the normal form a, which stands over one point. One marker goes straight to a and another goes once round the cycle first. The evidence each arrives with is shown beside a.' }
};
// the svgs of one host that have a description per calculus: keep the template's, and follow the calculus
function bindAria(F) {
  var els = Object.keys(ARIA).map(function (id) { var el = F.$(id); return el ? { el: el, m: ARIA[id], ski: el.getAttribute('aria-label') } : null; }).filter(Boolean);
  if (!els.length) return;
  function sync() { els.forEach(function (a) { a.el.setAttribute('aria-label', calc === 'ski' ? a.ski : a.m[calc] || a.m.tree); }); }
  sync();
  onCalc(sync);
}

/* ---------- the bundle: positions are laid out by hand, arrows are computed ----------
   In combinatory logic the fourteen terms are laid out by hand. In tree calculus (and for nets, whose
   read-backs are tree terms) the bundle holds the same situations in trees, closed under one-step
   reducts, with the loop of ω ω as in the Lean proof (Tree.omega_cycle); CALC.graph.layoutBundle lays it out. */
var BUNDLE = {};
BUNDLE.ski = {
  id: 'ski', C: SKI,
  NODES: [
    { s: 'S K K a', f: 'a' },
    { s: 'K a (I b)', f: 'a' },
    { s: 'K a (K a)', f: 'a' },
    { s: 'I a', f: 'a' },
    { s: 'K a b', f: 'a' },
    { s: 'a', f: 'a', nf: true },
    { s: 'I I', f: 'I' },
    { s: 'K I a', f: 'I' },
    { s: 'I', f: 'I', nf: true },
    { s: 'S K K', f: 'SKK', nf: true },
    { s: 'S K S', f: 'SKS', nf: true },
    { s: 'S I I (S I I)', f: 'loop', inner: true },
    { s: 'I (S I I) (I (S I I))', f: 'loop', inner: true },
    { s: 'I (S I I) (S I I)', f: 'loop', inner: true }
  ],
  FIBS: { a: 'a', I: 'I', SKK: 'S K K', SKS: 'S K S', loop: 'no value' },
  // two hand layouts: the line along the bottom on a wide screen, down the right side on a narrow one
  LAY: {
    wide: {
      vb: '0 20 720 264', line: [20, 250, 700, 250],
      pos: [[52, 50], [176, 50], [52, 120], [116, 120], [206, 120], [128, 190], [268, 120], [332, 120], [298, 190], [416, 190], [496, 190], [612, 56], [664, 150], [566, 150]],
      pj: [0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1],
      fib: { a: [128, 250], I: [298, 250], SKK: [416, 250], SKS: [496, 250], loop: [612, 250] },
      merged: [404, 250],
      syn: function (r, n) { return [40 + r * 640 / (n - 1), 250]; },
      synlab: [360, 272, 0],
      lab: function (p) { return { x: p[0], y: p[1] + 22, anchor: 'middle' }; },
      from: function (n) { return [n.x, n.y + 11]; },
      rank: function (p, q) { return p.x - q.x || p.y - q.y; },
      arcs: ['M 387 190 L 313 190', 'M 486 177 Q 392 126 305 177']
    },
    tall: {
      vb: '0 0 380 424', line: [300, 16, 300, 412],
      pos: [[38, 34], [47, 84], [136, 34], [196, 128], [120, 128], [240, 76], [60, 178], [60, 214], [240, 196], [240, 252], [240, 292], [50, 336], [150, 366], [50, 396]],
      pj: [0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0],
      fib: { a: [300, 76], I: [300, 196], SKK: [300, 252], SKS: [300, 292], loop: [300, 366] },
      merged: [300, 252],
      syn: function (r, n) { return [300, 28 + r * 372 / (n - 1)]; },
      synlab: [326, 214, 90],
      lab: function (p) { return { x: p[0] + 10, y: p[1] + 4, anchor: 'start' }; },
      from: function (n) { return [n.x + n.w / 2, n.y]; },
      rank: function (p, q) { return p.y - q.y || p.x - q.x; },
      arcs: ['M 240 238 L 240 211', 'M 212 292 Q 172 244 226 205']
    }
  }
};
// The first eleven are the situations of the hand-laid bundle, in its order, so that a term chosen in
// one calculus stays chosen in the other; then the intermediate terms; then the loop, in the order of its run.
BUNDLE.tree = {
  id: 'tree', C: TREE, auto: true,
  NODES: [
    { s: 'S K K a', f: 'a' },
    { s: 'K a (I b)', f: 'a' },
    { s: 'K a (K a)', f: 'a' },
    { s: 'I a', f: 'a' },
    { s: 'K a b', f: 'a' },
    { s: 'a', f: 'a', nf: true },
    { s: 'I I', f: 'I' },
    { s: 'K I a', f: 'I' },
    { s: 'I', f: 'I', nf: true },
    { s: 'S K K', f: 'SKK', nf: true },
    { s: 'S K (△K)', f: 'SKS', nf: true },
    { s: 'K a (△a)', f: 'a' },
    { s: 'K a (K b (△b))', f: 'a' },
    { s: 'K I (△I)', f: 'I' },
    { s: 'ω ω', f: 'loop', cyc: true },
    { s: 'I ω (I ω)', f: 'loop', cyc: true },
    { s: 'K ω (△ω) (I ω)', f: 'loop', cyc: true },
    { s: 'ω (I ω)', f: 'loop', cyc: true },
    { s: 'ω (K ω (△ω))', f: 'loop', cyc: true }
  ],
  FIBS: { a: 'a', I: 'I', SKK: 'S K K', SKS: 'S K (△K)', loop: 'no value' }
};
function initBundle(B) {
  var C = B.C, cycle = [];
  B.index = {};
  B.NODES.forEach(function (n, i) {
    n.t = C.parse(n.s); n.key = C.key(n.t); n.label = C.print(n.t); n.w = boxW(n.label); B.index[n.key] = i;
    if (n.cyc) cycle.push(i);
  });
  // every step from one of the terms to another
  B.EDGES = []; B.EIDX = {};
  B.NODES.forEach(function (n, i) {
    C.redexes(n.t).forEach(function (r) {
      var j = B.index[C.key(C.contract(n.t, r))];
      if (j === undefined || B.EIDX[i + '>' + j] !== undefined) return;
      B.EIDX[i + '>' + j] = B.EDGES.length; B.EDGES.push([i, j]);
    });
  });
  // the loop is run in the order of its cycle, whatever the order chosen
  cycle.forEach(function (i, k) {
    var n = B.NODES[i], to = B.NODES[cycle[(k + 1) % cycle.length]].key;
    n.cycR = C.redexes(n.t).filter(function (r) { return C.key(C.contract(n.t, r)) === to; })[0];
  });
  if (B.auto) B.LAY = { wide: autoLay(B, false), tall: autoLay(B, true) };
  B.ready = true;
}
// a layout in the form of the hand ones, from CALC.graph.layoutBundle
function autoLay(B, tall) {
  var g = GRAPH.reductionGraph(B.C, B.NODES.map(function (n) { return n.t; }), { closed: true });
  var Lb = GRAPH.layoutBundle(g, { orientation: tall ? 'tall' : 'wide', layering: tall ? 'nearest' : 'longest', rings: true, slots: true, curves: true, measure: boxW });
  var via = {}, curve = {};
  Lb.edges.forEach(function (e) {
    if (e.via) via[e.from + '>' + e.to] = e.via.map(function (p) { return [r1(p[0]), r1(p[1])]; });
    if (e.curve) curve[e.from + '>' + e.to] = e.curve;
  });
  var name = {};
  Object.keys(B.FIBS).forEach(function (k) { name[B.FIBS[k]] = k; });
  var fib = {};
  g.fibres.forEach(function (f) { var p = Lb.fibres[f.id]; fib[name[f.label]] = [r1(p.x), r1(p.y)]; });
  var vb = Lb.vb.split(' ').map(function (x) { return Math.round(Number(x)); }), x0 = vb[0], y0 = vb[1], W = vb[2] + 1, H = vb[3] + 1;
  var pos = Lb.nodes.map(function (n) { return [r1(n.x), r1(n.y)]; });
  // the points under the normal forms, and under the two terms of the loop nearest the line, are joined to the line
  var ring = B.NODES.map(function (n, i) { return i; }).filter(function (i) { return B.NODES[i].cyc; });
  ring.sort(function (p, q) { return tall ? pos[q][0] - pos[p][0] : pos[q][1] - pos[p][1]; });
  var pj = B.NODES.map(function (n, i) { return n.nf || ring.indexOf(i) === 0 || ring.indexOf(i) === 1 ? 1 : 0; });
  var fs = B.NODES.map(function (n) { return n.f; }), iI = B.index[TREE.key(TREE.I)], iK = fs.indexOf('SKK'), iS = fs.indexOf('SKS');
  var nI = pos[iI], nK = pos[iK], nS = pos[iS], wI = B.NODES[iI].w, wK = B.NODES[iK].w, wS = B.NODES[iS].w;
  var L0;
  if (!tall) {
    var lineY = Lb.line[1];
    H = Math.max(H, lineY + 36 - y0);
    L0 = {
      vb: x0 + ' ' + y0 + ' ' + W + ' ' + H, line: [x0 + 20, lineY, x0 + W - 20, lineY],
      syn: function (r, n) { return [x0 + 40 + r * (W - 80) / (n - 1), lineY]; },
      synlab: [x0 + W / 2, lineY + 22, 0],
      lab: function (p) { return { x: p[0], y: p[1] + 22, anchor: 'middle' }; },
      from: function (n) { return [n.x, n.y + 11]; },
      rank: function (p, q) { return p.x - q.x || p.y - q.y; },
      // the rule S K y → I: from S K K to I, and from S K (△K) over S K K to I
      arcs: ['M ' + r1(nK[0] - wK / 2 - 2) + ' ' + nK[1] + ' L ' + r1(nI[0] + wI / 2 + 2) + ' ' + nI[1],
        'M ' + nS[0] + ' ' + (nS[1] - 13) + ' Q ' + r1((nS[0] + nI[0]) / 2) + ' ' + (nI[1] - 64) + ' ' + r1(nI[0] + 7) + ' ' + (nI[1] - 13)]
    };
  } else {
    // on the right of the line, room for the longest label of a point (labels start 10 to its right)
    var lineX = Lb.line[0], labW = Math.max.apply(null, Object.keys(B.FIBS).map(function (k) { return k === 'loop' ? B.FIBS[k].length * 6.4 : boxW(B.FIBS[k]) - 14; }));
    W = Math.ceil(lineX + 10 + labW + 8 - x0);
    L0 = {
      vb: x0 + ' ' + y0 + ' ' + W + ' ' + H, line: [lineX, y0 + 16, lineX, y0 + H - 12],
      syn: function (r, n) { return [lineX, y0 + 28 + r * (H - 52) / (n - 1)]; },
      synlab: [lineX + 26, y0 + H / 2, 90],
      lab: function (p) { return { x: p[0] + 10, y: p[1] + 4, anchor: 'start' }; },
      from: function (n) { return [n.x + n.w / 2, n.y]; },
      rank: function (p, q) { return p.y - q.y || p.x - q.x; },
      arcs: ['M ' + nK[0] + ' ' + (nK[1] - 13) + ' L ' + nI[0] + ' ' + (nI[1] + 13),
        'M ' + r1(nS[0] - wS / 2 - 2) + ' ' + nS[1] + ' Q ' + r1(nS[0] - wS / 2 - 44) + ' ' + r1((nS[1] + nI[1]) / 2) + ' ' + r1(nI[0] - wI / 2 - 2) + ' ' + (nI[1] + 6)]
    };
  }
  L0.pos = pos; L0.pj = pj; L0.fib = fib; L0.merged = fib.I; L0.via = via; L0.curve = curve;
  return L0;
}
var BN, NODES, FIBS, LAY, EDGES, EIDX, index, BENDS = {};
var L = null, SYN = [];
function useBundle(id) {
  BN = BUNDLE[id];
  if (!BN.ready) initBundle(BN);
  NODES = BN.NODES; FIBS = BN.FIBS; LAY = BN.LAY; EDGES = BN.EDGES; EIDX = BN.EIDX; index = BN.index;
  L = null;
  useLay(false);
}
/* The layout follows each figure's host, not the window: a figure draws the wide layout when its host is at
   least as wide as that layout's view box (so it is drawn at 1:1), and the tall one otherwise. The figures
   share the bundle's nodes, so each figure calls useLay with its own choice before it draws or moves anything. */
function wideWidth() { return Number(LAY.wide.vb.split(' ')[2]); }
function tallFor(width) { return width < wideWidth(); }
function redexFor(i, order) {
  var n = NODES[i];
  if (n.cycR) return n.cycR;
  return (n.inner || order === 'inner') ? BN.C.redexInner(n.t) : BN.C.redexes(n.t)[0] || null;
}
function nextOf(i, order) {
  var r = redexFor(i, order);
  if (!r) return -1;
  var j = index[BN.C.key(BN.C.contract(NODES[i].t, r))];
  return j === undefined ? -1 : j;
}
function pathOf(start, order) {
  var path = [], i = start, seen = {};
  while (i !== -1 && !seen[i]) { seen[i] = true; path.push(i); i = nextOf(i, order); }
  return { path: path, cyc: i !== -1 };
}
function useLay(tall) {
  var next = LAY[tall ? 'tall' : 'wide'];
  if (next === L) return;
  L = next;
  NODES.forEach(function (n, i) { n.x = L.pos[i][0]; n.y = L.pos[i][1]; n.pj = !!L.pj[i]; });
  if (L.cache) { SYN = L.cache.syn; BENDS = L.cache.bends; return; }
  var order = NODES.map(function (n, i) { return i; }).sort(function (p, q) { return L.rank(NODES[p], NODES[q]); });
  SYN = [];
  order.forEach(function (i, rank) { SYN[i] = L.syn(rank, NODES.length); });
  routeEdges();
  L.cache = { syn: SYN, bends: BENDS };
}
// In an automatic layout a step over several layers is one smooth cubic curve that clears every box (from
// layoutBundle; through the slots left for it if there is none), and an arrow that would still cross a box
// is bent, as little as will clear every box.
function crosses(a, b, c) {
  for (var k = 0; k < NODES.length; k++) {
    var n = NODES[k];
    if (n === a || n === b) continue;
    for (var s = 1; s < 48; s++) {
      var u = s / 48, x, y;
      if (c) { x = (1 - u) * (1 - u) * a.x + 2 * u * (1 - u) * c[0] + u * u * b.x; y = (1 - u) * (1 - u) * a.y + 2 * u * (1 - u) * c[1] + u * u * b.y; }
      else { x = a.x + (b.x - a.x) * u; y = a.y + (b.y - a.y) * u; }
      if (Math.abs(x - n.x) < n.w / 2 + 5 && Math.abs(y - n.y) < 16) return true;
    }
  }
  return false;
}
function routeEdges() {
  BENDS = {};
  if (!BN.auto) return;
  EDGES.forEach(function (e) {
    var a = NODES[e[0]], b = NODES[e[1]];
    if (L.curve && L.curve[e[0] + '>' + e[1]]) { BENDS[e[0] + '>' + e[1]] = { cubic: L.curve[e[0] + '>' + e[1]] }; return; }
    if (L.via && L.via[e[0] + '>' + e[1]]) { BENDS[e[0] + '>' + e[1]] = { via: L.via[e[0] + '>' + e[1]] }; return; }
    if (!crosses(a, b, null)) return;
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len;
    var offs = [24, -24, 40, -40, 56, -56, 76, -76, 100, -100, 130, -130];
    for (var k = 0; k < offs.length; k++) {
      var c = [r1((a.x + b.x) / 2 + nx * offs[k] * 2), r1((a.y + b.y) / 2 + ny * offs[k] * 2)];
      if (!crosses(a, b, c)) { BENDS[e[0] + '>' + e[1]] = { c: c }; return; }
    }
  });
}
// a point at fraction u along the step from i to j, raised by dy (the hero's marker rides above the boxes)
function stepPoint(i, j, u, dy) {
  var a = NODES[i], b = NODES[j], bend = BENDS[i + '>' + j], c = bend && bend.c;
  if (bend && bend.cubic) {
    var c1 = bend.cubic[0], c2 = bend.cubic[1], v = 1 - u, k0 = v * v * v, k1 = 3 * u * v * v, k2 = 3 * u * u * v, k3 = u * u * u;
    return [k0 * a.x + k1 * c1[0] + k2 * c2[0] + k3 * b.x, k0 * a.y + k1 * c1[1] + k2 * c2[1] + k3 * b.y - dy];
  }
  if (bend && bend.via) {
    var pts = [[a.x, a.y]].concat(bend.via, [[b.x, b.y]]), len = [0];
    for (var k = 1; k < pts.length; k++) len[k] = len[k - 1] + Math.sqrt(Math.pow(pts[k][0] - pts[k - 1][0], 2) + Math.pow(pts[k][1] - pts[k - 1][1], 2));
    var dd = u * len[len.length - 1];
    for (k = 1; k < pts.length; k++) if (dd <= len[k] || k === pts.length - 1) {
      var f = len[k] === len[k - 1] ? 0 : (dd - len[k - 1]) / (len[k] - len[k - 1]);
      return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] - dy + (pts[k][1] - pts[k - 1][1]) * f];
    }
  }
  if (!c) return [a.x + (b.x - a.x) * u, a.y - dy + (b.y - a.y) * u];
  var w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u;
  return [w0 * a.x + w1 * c[0] + w2 * b.x, w0 * (a.y - dy) + w1 * (c[1] - dy) + w2 * (b.y - dy)];
}
onCalc(function (c) { useBundle(c === 'ski' ? 'ski' : 'tree'); });

function clip(a, b) {
  var dx = b.x - a.x, dy = b.y - a.y;
  var sx = dx === 0 ? Infinity : (a.w / 2 + 3) / Math.abs(dx);
  var sy = dy === 0 ? Infinity : 14 / Math.abs(dy);
  var s = Math.min(sx, sy);
  return [a.x + dx * s, a.y + dy * s];
}
function marker(defs, id, cls, size) {
  var m = S('marker', { id: id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: size, markerHeight: size, orient: 'auto' }, defs);
  S('path', { d: 'M0 0 L10 5 L0 10 z', 'class': cls }, m);
}
function drawBundle(svg, pid) {
  clear(svg);
  setVB(svg, L.vb);
  svg.setAttribute('data-lay', L === LAY.tall ? 'tall' : 'wide');
  var defs = S('defs', {}, svg);
  marker(defs, pid + 'ah', 'ah', 7);
  marker(defs, pid + 'ahr', 'ah-alarm', 5);
  marker(defs, pid + 'ahg', 'ah-run', 5);
  var gProj = S('g', {}, svg), gEdge = S('g', {}, svg), gNode = S('g', {}, svg), gBase = S('g', {}, svg), gTop = S('g', {}, svg);
  S('line', { x1: L.line[0], y1: L.line[1], x2: L.line[2], y2: L.line[3], 'class': 'baseline' }, gBase);
  var v = { svg: svg, pid: pid, nodes: [], edges: [], proj: [], pts: [], top: gTop, base: gBase, edgeLayer: gEdge };
  NODES.forEach(function (n) {
    var g = S('g', { 'class': 'fade' }, gNode);
    S('rect', { x: n.x - n.w / 2 - 6, y: n.y - 18, width: n.w + 12, height: 36, 'class': 'hit' }, g);     // a larger target for a finger
    var r = S('rect', { x: n.x - n.w / 2, y: n.y - 11, width: n.w, height: 22, rx: 3, 'class': 'n-rect' + (n.nf ? ' nf' : '') }, g);
    S('text', { x: n.x, y: n.y + 4.5, 'text-anchor': 'middle', 'class': 't-atom' }, g).textContent = n.label;
    v.nodes.push({ g: g, r: r });
    var b = L.fib[n.f], p = L.from(n);
    var pr = S('line', { x1: p[0], y1: p[1], x2: b[0], y2: b[1], 'class': 'proj fade' }, gProj);
    if (!n.pj) op(pr, 0);
    v.proj.push(pr);
    v.pts.push(S('circle', { cx: b[0], cy: b[1], r: 4.5, 'class': 'basept fade' + (n.f === 'loop' ? ' hollow' : '') }, gBase));
  });
  EDGES.forEach(function (e) {
    var bend = BENDS[e[0] + '>' + e[1]];
    if (bend && bend.cubic) {
      var k1 = bend.cubic[0], k2 = bend.cubic[1], s0 = clip(NODES[e[0]], { x: k1[0], y: k1[1] }), s1 = clip(NODES[e[1]], { x: k2[0], y: k2[1] });
      v.edges.push(S('path', { d: 'M ' + r1(s0[0]) + ' ' + r1(s0[1]) + ' C ' + k1[0] + ' ' + k1[1] + ' ' + k2[0] + ' ' + k2[1] + ' ' + r1(s1[0]) + ' ' + r1(s1[1]), 'class': 'edge fade', 'marker-end': 'url(#' + pid + 'ah)' }, gEdge));
      return;
    }
    if (bend && bend.via) {
      var vs = bend.via, v0 = clip(NODES[e[0]], { x: vs[0][0], y: vs[0][1] }), v1 = clip(NODES[e[1]], { x: vs[vs.length - 1][0], y: vs[vs.length - 1][1] });
      v.edges.push(S('path', { d: 'M ' + r1(v0[0]) + ' ' + r1(v0[1]) + vs.map(function (q) { return ' L ' + q[0] + ' ' + q[1]; }).join('') + ' L ' + r1(v1[0]) + ' ' + r1(v1[1]), 'class': 'edge fade', 'marker-end': 'url(#' + pid + 'ah)' }, gEdge));
      return;
    }
    var c = bend && bend.c;
    if (c) {
      var cp = { x: c[0], y: c[1] }, p0 = clip(NODES[e[0]], cp), q0 = clip(NODES[e[1]], cp);
      v.edges.push(S('path', { d: 'M ' + r1(p0[0]) + ' ' + r1(p0[1]) + ' Q ' + c[0] + ' ' + c[1] + ' ' + r1(q0[0]) + ' ' + r1(q0[1]), 'class': 'edge fade', 'marker-end': 'url(#' + pid + 'ah)' }, gEdge));
      return;
    }
    var p = clip(NODES[e[0]], NODES[e[1]]), q = clip(NODES[e[1]], NODES[e[0]]);
    v.edges.push(S('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], 'class': 'edge fade', 'marker-end': 'url(#' + pid + 'ah)' }, gEdge));
  });
  return v;
}
// the label of a fibre's point; in trees and nets no value is reached in the terms drawn, which is all that is claimed
function fibName(k) { return k === 'loop' && BN.id !== 'ski' ? 'no value reached' : FIBS[k]; }
function baseLabel(parent, pos, text, cls) {
  var a = L.lab(pos);
  var t = S('text', { x: a.x, y: a.y, 'text-anchor': a.anchor, 'class': 'fade ' + (cls || '') }, parent);
  // beside a vertical line there is room for one short line only: the tree label goes on two
  if (a.anchor === 'start' && text === 'no value reached') {
    S('tspan', { x: a.x }, t).textContent = 'no value';
    S('tspan', { x: a.x, dy: 13 }, t).textContent = 'reached';
  } else t.textContent = text;
  return t;
}
function fibreLabels(v) {
  var out = {};
  Object.keys(FIBS).forEach(function (k) { out[k] = baseLabel(v.base, L.fib[k], fibName(k), k === 'loop' ? 'lab' : ''); });
  return out;
}
// a net drawn as in post/lab/demo.html: Lafont triangles, wires, free ports; `next` is the pair about to interact
function drawNet(parent, lay, next) {
  var gw = S('g', {}, parent), ga = S('g', {}, parent);
  lay.wires.forEach(function (w) {
    var hot = next && w.active && ((w.from === next.a + '.0' && w.to === next.b + '.0') || (w.from === next.b + '.0' && w.to === next.a + '.0'));
    S('path', { d: w.d, 'class': 'wire' + (hot ? ' next' : w.active ? ' active' : '') }, gw);
  });
  lay.agents.forEach(function (a) {
    var g = S('g', {}, ga);
    S('polygon', { points: a.triangle.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' '),
      'class': 'agent ' + (a.producer ? 'producer' : 'consumer') + (a.main ? '' : ' detached') }, g);
    S('text', { x: a.x, y: a.y + (a.dir === 'up' ? 5 : 1), 'class': 'kind' }, g).textContent = a.kind;
  });
  lay.free.forEach(function (f) {
    S('text', { x: f.x, y: f.y + (f.port === '@' ? -4 : 12), 'text-anchor': 'middle', 'class': f.port === '@' ? 'lab' : 'freep' }, parent).textContent = f.port === '@' ? 'result' : f.name;
  });
}
// every net a term can reach, placed by the number of interactions done (the same along every path)
var LATTICES = {};
function lattice(t, maxDepth) {
  var k = TREE.key(t) + '|' + (maxDepth || '');
  if (LATTICES[k]) return LATTICES[k];
  var g = GRAPH.reductionGraph(NET, NET.compile(t), { max: 400, maxDepth: maxDepth, simple: true, label: function (n) { return NET.print(n); } });
  var layers = [];
  g.states.forEach(function (s, i) { (layers[s.depth] = layers[s.depth] || []).push(i); });
  // within a layer, in the order of the mean place of the nets they come from
  var place = {};
  layers.forEach(function (row, d) {
    if (d > 0) row.forEach(function (i) {
      var from = g.states[i].in.map(function (e) { return place[g.edges[e].from]; }).filter(function (x) { return x !== undefined; });
      g.states[i].bary = from.length ? from.reduce(function (a, x) { return a + x; }, 0) / from.length : 0;
    });
    if (d > 0) row.sort(function (p, q) { return g.states[p].bary - g.states[q].bary || p - q; });
    row.forEach(function (i, j) { place[i] = j - (row.length - 1) / 2; });
  });
  var widest = Math.max.apply(null, layers.map(function (r) { return r.length; }));
  LATTICES[k] = { g: g, layers: layers, place: place, depth: layers.length - 1, widest: widest };
  return LATTICES[k];
}

/* ---------- the figures ----------
   FIGS[component](root, F) draws one figure into root, its host. F.$(k) is the element of the host whose id
   was k in the template; F.each(sel, f) runs over the host; F.P is the prefix of every id made in code;
   F.width() is the host's width (Infinity until it is known) and F.onWidth(f) is called when it changes;
   F.still is the still mode. Each was an IIFE of the essay's script; only these lookups have changed. */
var FIGS = {};

/* ---------- atoms and probes: the bench ----------
   In tree calculus and in nets: the tree terms, and a fourth probe, the triage probe triP of
   FormalComputation/Tree/Essay.lean: readShape (extract [ ]), where extract takes the right branch of a fork
   (a leaf or a stem goes to △△△) and readShape reads a leaf as x, a stem of a leaf as y, a stem of a stem as z. */
FIGS['probe-grid'] = function (root, F) {
  var $ = F.$, each = F.each;
  var SKI_TERMS = ['I', 'S K K', 'S K S', 'K I', 'K (S K K)', 'K'];
  var TREE_TERMS = ['I', 'S K K', 'S K (△K)', 'K I', 'K (S K K)', 'K'];
  var TRIAGE = 'triage(x, triage(y, K z, △), △) (triage(K △, K (K △), K I) [ ])';
  var TERMS, PROBES, mode;
  var svg = $('svg-tree'), grid = $('grid'), code = $('benchcode');
  var sel = { r: 1, c: 1 }, reading = 'probe';
  function setup() {
    mode = calc;
    TERMS = mode === 'ski' ? SKI_TERMS : TREE_TERMS;
    PROBES = mode === 'ski' ? [[], ['x'], ['x', 'y']] : [[], ['x'], ['x', 'y'], TRIAGE];
    if (sel.c >= PROBES.length) sel.c = PROBES.length - 1;
  }
  function ctx(c) { return typeof PROBES[c] === 'string' ? PROBES[c] : '[ ]' + PROBES[c].map(function (a) { return ' ' + a; }).join(''); }
  var MEMO = {};
  function experiment(r, c) {
    if (mode === 'ski') {
      var tt = parse(TERMS[r]), e = tt;
      PROBES[c].forEach(function (a) { e = App(e, A(a)); });
      var seq = runOuter(e), last = seq[seq.length - 1];
      return { term: tt, expr: e, seq: seq, out: pretty(last), own: !/[SKI]/.test(plain(last)) };
    }
    var k = mode + r + ',' + c;
    if (MEMO[k]) return MEMO[k];
    var t2 = TREE.parse(TERMS[r]), e2 = TREE.plug(PROBES[c], t2), seq2 = TREE.run(e2, 'outer', 80), last2 = seq2[seq2.length - 1];
    var ex = { term: t2, expr: e2, seq: seq2, out: TREE.print(last2), own: TREE.isOutcome(last2) };
    if (mode === 'net') {
      // the same experiment as a net: its interactions, and the read-back of the result port after each
      var nets = NET.run(NET.plug(PROBES[c], t2), 'outer', 2000), fin = nets[nets.length - 1];
      ex.nets = nets; ex.count = nets.length - 1;
      ex.reads = nets.map(function (n) { return NET.print(n, { html: true }); });
      ex.out = NET.print(fin); ex.own = NET.isOutcome(fin);
    }
    MEMO[k] = ex;
    return ex;
  }
  function buildGrid() {
    var h = '<thead><tr><th scope="col">Term</th>';
    PROBES.forEach(function (p, c) {
      h += typeof p === 'string'
        ? '<th scope="col" class="h-probe" title="The triage probe: ' + p + '">triage</th>'
        : '<th scope="col" class="h-probe"><code>' + ctx(c) + '</code></th>';
    });
    h += '<th scope="col">Point</th></tr></thead><tbody>';
    TERMS.forEach(function (t, r) {
      h += '<tr id="' + F.P + 'row' + r + '"><th scope="row"><code>' + t + '</code></th>';
      PROBES.forEach(function (p, c) { h += '<td><button type="button" class="cell" data-r="' + r + '" data-c="' + c + '"></button></td>'; });
      h += '<td class="pt" id="' + F.P + 'pt' + r + '"></td></tr>';
    });
    grid.innerHTML = h + '</tbody>';
  }
  setup();
  buildGrid();

  // In tree calculus the abbreviations K, I, ω and S x y are drawn as the symbols they are written with.
  function shown(ex) {
    if (mode === 'ski') return { expr: ex.expr, term: ex.term };
    var term = null;
    function go(u) {
      var d, ab = TREE.abbrev(u);
      if (ab) d = A(ab);
      else if (u.k === 'a') d = A(u.n);
      else if (u.f.k === 'p' && TREE.isLeaf(u.f.f) && u.f.x.k === 'p' && TREE.isLeaf(u.f.x.f) && !TREE.isLeaf(u.f.x.x)) d = App(App(A('S'), go(u.f.x.x)), go(u.x));
      else d = App(go(u.f), go(u.x));
      if (u === ex.term) term = d;
      return d;
    }
    var expr = go(ex.expr);
    return { expr: expr, term: term };
  }
  function drawTree(ex) {
    clear(svg);
    var sh = shown(ex);
    var leaves = [], apps = 0, W = 340, H = 176, gap = 40, drop = 25;
    var root = (function walk(u, inT) {
      inT = inT || u === sh.term;
      var n = { inT: inT };
      if (u.k === 'a') { n.s = u.n; n.i = leaves.length; leaves.push(n); }
      else { apps++; n.l = walk(u.f, inT); n.r = walk(u.x, inT); }
      return n;
    })(sh.expr, false);
    if (mode !== 'ski') {
      // a larger term is drawn in a larger box, which the page scales to the same width
      var depth = (function d(n) { return n.l ? 1 + Math.max(d(n.l), d(n.r)) : 0; })(root);
      gap = leaves.length > 9 ? 26 : 40;
      W = Math.max(340, (leaves.length + 1) * gap);
      H = Math.max(176, depth * drop + 64);
      setVB(svg, '0 0 ' + W + ' ' + H);
    } else if (svg.getAttribute('viewBox') !== '0 0 340 176') setVB(svg, '0 0 340 176');
    var x0 = (W - (leaves.length - 1) * gap) / 2, box = null;
    (function place(n) {
      if (n.l) { place(n.l); place(n.r); n.x = (n.l.x + n.r.x) / 2; n.y = Math.min(n.l.y, n.r.y) - drop; }
      else { n.x = x0 + n.i * gap; n.y = H - 24; }
      if (n.inT) box = box ? [Math.min(box[0], n.x), Math.min(box[1], n.y), Math.max(box[2], n.x)] : [n.x, n.y, n.x];
    })(root);
    var asText = reading === 'text';
    if (!asText && box) S('rect', { x: box[0] - 17, y: box[1] - 15, width: box[2] - box[0] + 34, height: H - 24 - box[1] + 30, rx: 5, 'class': 'holebox' }, svg);
    var gl = S('g', {}, svg), gn = S('g', {}, svg);
    (function draw(n) {
      var c = (asText || n.inT) ? 'a' : 'p';
      if (n.l) {
        [n.l, n.r].forEach(function (k) {
          var kc = (asText || k.inT) ? 'a' : 'p';
          S('line', { x1: n.x, y1: n.y, x2: k.x, y2: k.l ? k.y : k.y - 13, 'class': 'tl ' + (c === 'a' ? kc : 'p') }, gl);
          draw(k);
        });
        S('circle', { cx: n.x, cy: n.y, r: 3.4, 'class': 'tn ' + c }, gn);
      } else {
        S('text', { x: n.x, y: n.y + 4.5, 'text-anchor': 'middle', 'class': c === 'a' ? 't-atom' : 't-probe' }, gn).textContent = n.s;
      }
    })(root);
    if (mode === 'ski') return { leaves: leaves.length, apps: apps };
    // counted written out in △, as the calculus has it
    var lv = 0, ap = 0;
    (function count(u) { if (u.k === 'a') lv++; else { ap++; count(u.f); count(u.x); } })(ex.expr);
    return { leaves: lv, apps: ap };
  }
  var timers = [], touched = false, prev = {};
  function cellAt(r, c) { return grid.querySelector('[data-r="' + r + '"][data-c="' + c + '"]'); }
  // the run as far as term number upto; the redex of the last term shown is marked while the run is still going
  function runHtml(ex, upto) {
    if (mode === 'net') {
      // the read-back at the result port, each time it changes, with the number of interactions done
      var parts = [], last = null;
      for (var k = 0; k <= upto; k++) if (ex.reads[k] !== last) { parts.push(ex.reads[k] + (k ? ' <span class="after">(' + k + ')</span>' : '')); last = ex.reads[k]; }
      return parts.join('<span class="run"> → </span>') + (ex.count === 0 ? ' (no interaction applies)' : upto === ex.count ? ' <span class="after">' + ex.count + (ex.count === 1 ? ' interaction' : ' interactions') + ' in all</span>' : '');
    }
    if (mode === 'tree') {
      return ex.seq.slice(0, upto + 1).map(function (u, k) {
        return TREE.print(u, { html: true, mark: (k === upto && upto < ex.seq.length - 1) ? TREE.redexes(u)[0] : undefined });
      }).join('<span class="run"> → </span>') + (ex.seq.length === 1 ? ' (no rule applies)' : '');
    }
    return ex.seq.slice(0, upto + 1).map(function (u, k) {
      return pretty(u, (k === upto && upto < ex.seq.length - 1) ? redexOuter(u) : null, true);
    }).join('<span class="run"> → </span>') + (ex.seq.length === 1 ? ' (no rule applies)' : '');
  }
  function cellHtml(ex, txt) { return esc(txt) + (mode === 'net' ? '<span class="ncount">' + ex.count + '</span>' : ''); }
  function render(play, flashChanged) {
    timers.forEach(clearTimeout); timers = [];
    var allow = code.checked, keys = [], changed = [];
    TERMS.forEach(function (t, r) {
      var key = [];
      PROBES.forEach(function (p, c) {
        var ex = experiment(r, c), b = cellAt(r, c);
        var read = ex.own || allow, on = sel.r === r && sel.c === c, txt = read ? ex.out : 'not read';
        if (prev[r + ',' + c] !== undefined && prev[r + ',' + c] !== txt) changed.push(b);
        prev[r + ',' + c] = txt;
        if (mode === 'ski') b.textContent = txt; else b.innerHTML = cellHtml(ex, txt);
        b.className = 'cell ' + (ex.own ? 'own' : read ? 'text' : 'sealed');
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', (typeof p === 'string' ? 'The triage probe' : 'The probe ' + ctx(c)) + ' on ' + t + ': ' + (read ? 'reads ' + ex.out : 'not read') +
          (mode === 'net' ? ', run data: ' + ex.count + (ex.count === 1 ? ' interaction' : ' interactions') : ''));
        key.push(read ? ex.out : '');
      });
      keys.push(key.join('|'));
    });
    var seen = {}, count = 0, last = null;
    keys.forEach(function (k, r) {
      if (!seen[k]) seen[k] = ++count;
      $('pt' + r).textContent = seen[k];
      $('row' + r).className = (last !== null && last !== seen[k]) ? 'gstart' : '';
      last = seen[k];
    });
    var ex = experiment(sel.r, sel.c), size = drawTree(ex), t = TERMS[sel.r], full = mode === 'ski' ? plain(ex.expr) : TREE.print(ex.expr);
    var tri = typeof PROBES[sel.c] === 'string';
    $('benchsay').innerHTML = reading === 'text'
      ? (size.apps === 0
          ? 'Read as text, <code class="atom">' + full + '</code> is a single atom.'
          : 'Read as text, <code class="atom">' + full + '</code> is a tree of ' + word(size.leaves + size.apps) + ' atoms' + (mode === 'ski' ? '' : ' when it is written out in △') + ': ' + word(size.leaves) + ' symbols and ' + word(size.apps) + (size.apps === 1 ? ' application' : ' applications') + '. Nothing in the tree marks one part as the thing under test.')
      : (PROBES[sel.c].length
          ? 'Read as an experiment, the expression is the term <code class="atom">' + t + '</code> placed in the hole of the ' + (tri ? 'triage probe' : 'probe') + ' <code class="probe">' + ctx(sel.c) + '</code>.' +
            (tri ? ' The inner triage takes the right branch of the term’s top fork; the outer one reads its shape.' : '')
          : 'The probe <code class="probe">[ ]</code> supplies nothing. It asks only to see the term <code class="atom">' + t + '</code> once it has run.');
    var cellBtn = cellAt(sel.r, sel.c), n = mode === 'net' ? ex.count : ex.seq.length - 1;
    function verdict() {
      $('benchverdict').innerHTML = ex.own
        ? 'Read: <code class="probe">' + ex.out + '</code>. The outcome is written in the probe’s own variables.'
        : allow
          ? 'Read as text: <code class="atom">' + ex.out + '</code>. The probe has looked at the atoms of the term.'
          : 'Not read. The outcome still contains symbols of the term, and the probe may not look at them.';
    }
    if (play) {
      // play the run a step at a time; the reading lands in the cell when the run ends
      var final = mode === 'ski' ? cellBtn.textContent : cellBtn.innerHTML, dt = mode === 'net' ? 140 : 750;
      cellBtn.textContent = '…';
      $('benchrun').innerHTML = runHtml(ex, 0);
      $('benchverdict').innerHTML = '<span class="run">Running' + (n > 0 ? ', ' + (mode === 'net' ? word(n) + (n === 1 ? ' interaction' : ' interactions') : steps(n)) : '') + '.</span>';
      for (var k = 1; k <= n; k++) (function (k) { timers.push(setTimeout(function () { $('benchrun').innerHTML = runHtml(ex, k); }, dt * k)); })(k);
      timers.push(setTimeout(function () { if (mode === 'ski') cellBtn.textContent = final; else cellBtn.innerHTML = final; verdict(); kick(cellBtn, 'land'); }, dt * n + 450));
    } else {
      $('benchrun').innerHTML = runHtml(ex, n);
      verdict();
    }
    if (flashChanged) changed.forEach(function (b) { kick(b, 'land'); });
    $('benchread').textContent = cap(word(TERMS.length)) + ' terms, ' + word(count) + ' points. ' + (allow
      ? 'The probe [ ] now reads each term as text, and no two rows agree.'
      : mode === 'ski'
        ? 'Rows with the same readings in every column cannot be told apart by these probes, nor by any other probe that reads only what it supplied.'
        : 'The triage probe reads code, and it separates the three identities. Rows with the same readings in every column cannot be told apart by these four probes.' +
          (mode === 'net' ? ' The small numbers are run data, the interactions each run took in the browser’s reducer, in one order. They are not part of the reading, and the points ignore them. For the well-formed nets of tree-semantics a run that finishes takes the same number in every order; these open nets are the browser’s, and that is not proved for them.' : ''));
    each('[data-r]', function (b) { if (b.classList.contains('tab')) b.setAttribute('aria-pressed', String(b.getAttribute('data-r') === reading)); });
  }
  grid.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('.cell') : null;
    if (!b) return;
    touched = true;
    sel = { r: Number(b.getAttribute('data-r')), c: Number(b.getAttribute('data-c')) };
    render(true);
  });
  each('.tab[data-r]', function (b) { b.addEventListener('click', function () { touched = true; reading = b.getAttribute('data-r'); render(false); }); });
  code.addEventListener('change', function () { touched = true; render(false, true); });
  onCalc(function () { setup(); buildGrid(); prev = {}; render(false); });
  render(false);
  if (!RM && !F.still) onFirstView(grid, function () { if (!touched) render(true); });
};

/* ---------- running: four views ----------
   For nets the figure shows one term at a time: its states are the nets it can reach, a lattice by the
   number of interactions done; a single step draws the net itself. */
FIGS['runs'] = function (root, F) {
  var $ = F.$, each = F.each;
  var svg = $('svg-hero'), v, labs, token, drawn = null;
  // the layout this figure's width asks for: the bundle's tall one below its wide width, the net view's below 720
  function lay() { return isNet() ? (F.width() < 720 ? 'tall' : 'wide') : tallFor(F.width()) ? 'tall' : 'wide'; }
  var level = 3, start = 0, order = 'outer', path = [], cyc = false, t = 0, playing = null, timer = null, shown = null, touched = false;
  var time = $('time'), playBtn = $('play'), focus = $('focus'), ord = $('order');
  var ORDER_SKI = ord.innerHTML, tab3 = root.querySelector('[data-l="3"]'), TAB3 = tab3.textContent;
  var NV = null, seed = 1;
  function isNet() { return calc === 'net'; }
  function fillFocus() {
    clear(focus);
    NODES.forEach(function (n, i) {
      if (isNet() && n.f === 'loop') return;
      var o = document.createElement('option'); o.value = i; o.textContent = n.label; focus.appendChild(o);
    });
  }
  fillFocus();

  // a term of the loop is always run round the cycle drawn, so for it Order gives way to a label that says so
  var ordLab = ord.parentNode, cycLab = $('ordercyc');
  function syncOrder() { var loop = !isNet() && NODES[start].f === 'loop'; ordLab.hidden = loop; cycLab.hidden = !loop; }
  function buildPath() {
    syncOrder();
    if (isNet()) { netPath(); return; }
    var p = pathOf(start, order);
    path = p.path; cyc = p.cyc;
    time.max = cyc ? path.length * 2 : Math.max(path.length - 1, 0);
  }
  function at(k) { return path[cyc ? k % path.length : Math.min(k, path.length - 1)]; }
  function render() {
    if (isNet()) { netRender(); return; }
    useLay(drawn === 'tall');
    var k = Math.floor(t + 1e-6), u = t - k, i = at(k), j = at(k + 1);
    var a = NODES[i], b = NODES[j], here = u < 0.5 ? i : j;
    if (BENDS[i + '>' + j]) { var tp = stepPoint(i, j, u, 17); token.setAttribute('cx', tp[0]); token.setAttribute('cy', tp[1]); }
    else {
      token.setAttribute('cx', a.x + (b.x - a.x) * u);
      token.setAttribute('cy', a.y - 17 + (b.y - a.y) * u);
    }
    var inPath = {}, inEdge = {}, nxt = nextOf(i, order), nowEdge = EIDX[i + '>' + nxt];
    path.forEach(function (p) {
      inPath[p] = true;
      var e = EIDX[p + '>' + nextOf(p, order)];
      if (e !== undefined) inEdge[e] = true;
    });
    var fib = NODES[start].f;
    v.nodes.forEach(function (n, ni) {
      var o = level === 1 ? (ni === i ? 1 : ni === nxt ? 0.5 : 0) : level === 2 ? (inPath[ni] ? 1 : 0) : level === 3 ? 1 : 0.1;
      op(n.g, o);
      n.r.setAttribute('class', 'n-rect' + (NODES[ni].nf ? ' nf' : '') + (level !== 4 && ni === here ? ' cur' : ''));
      // a box that cannot be seen cannot be reached: not by the keyboard, the pointer or a screen reader
      var gone = o === 0;
      if (gone !== !!n.gone) {
        n.gone = gone;
        n.g.setAttribute('tabindex', gone ? '-1' : '0');
        if (gone) n.g.setAttribute('aria-hidden', 'true'); else n.g.removeAttribute('aria-hidden');
        n.g.style.pointerEvents = gone ? 'none' : '';
        if (gone && document.activeElement === n.g) focus.focus();     // keep the focus on a control that is still there
      }
    });
    v.edges.forEach(function (e, ei) {
      var hot = level === 1 ? ei === nowEdge : (level === 2 || level === 3) && inEdge[ei];
      op(e, level === 1 ? (ei === nowEdge ? 1 : 0) : level === 2 ? (inEdge[ei] ? 1 : 0) : level === 3 ? (inEdge[ei] ? 1 : 0.5) : 0.1);
      e.setAttribute('class', 'edge fade' + (hot ? ' focus' : ''));
      e.setAttribute('marker-end', 'url(#' + F.P + 'h' + (hot ? 'ahg' : 'ah') + ')');
    });
    NODES.forEach(function (n, ni) {
      var mine = n.f === fib;
      op(v.proj[ni], !n.pj ? 0 : level === 1 ? 0 : level === 2 ? (mine ? 1 : 0) : 1);
      op(v.pts[ni], level === 1 ? 0 : level === 2 ? (mine ? 1 : 0) : 1);
      v.pts[ni].setAttribute('class', 'basept fade' + (n.f === 'loop' ? ' hollow' : mine && level !== 4 ? ' k-run' : ''));
    });
    Object.keys(labs).forEach(function (f) { op(labs[f], level === 1 ? 0 : level === 2 ? (f === fib ? 1 : 0) : 1); });
    op(token, level === 4 ? 0 : 1);
    var cur = NODES[i], rx = redexFor(i, order), n = path.length - 1;
    var nowHtml = BN.C.print(cur.t, { html: true, mark: rx || undefined });
    if (nowHtml !== shown) { $('now').innerHTML = nowHtml; shown = nowHtml; }
    $('stepinfo').textContent = level === 4 ? ''
      : cyc ? 'Step ' + (k + 1) + ', by ' + ruleOf(rx) + '. This run does not end.'
      : n < 1 ? 'Already a normal form.'
      : !rx ? 'Finished in ' + steps(n) + '.'
      : 'Step ' + (k + 1) + ' of ' + n + ', by ' + ruleOf(rx) + '.';
    var other = '';
    if (!cyc && !NODES[start].inner && !NODES[start].cyc) {
      var alt = pathOf(start, order === 'outer' ? 'inner' : 'outer').path.length - 1;
      if (alt !== n) other = ' Under the other order the same term takes ' + steps(alt) + '.';
    }
    $('heroread').textContent =
      level === 1 ? (rx
          ? 'One step. The marked part of the term is a redex of ' + ruleOf(rx) + ', and the arrow points to the term that results.' + (/ω/.test(cur.label) ? ' Written out, ω is S I I' + (BN.id === 'ski' ? '' : ', that is △(△I)I') + '.' : '')
          : 'This term is a normal form. It has no redex.')
      : level === 2 ? (cyc
          ? (BN.id === 'ski' ? 'The whole run. It returns to the term it started from, so this run never ends. That the term has no value is argued in the text, and the hollow point marks it.' : 'The whole run, round the cycle shown. It returns to the term it started from, so this run never ends. The hollow point marks a fibre in which the figure reaches no value.')
          : n > 0
            ? 'The whole run, of ' + steps(n) + '. Its value is marked on the line.' + other
            : 'A run of no steps. The term is a normal form and is its own value.')
      : level === 3 ? cap(word(NODES.length)) + ' terms and every step between them. Terms joined by steps share a point on the line. The green arrows are the run of the chosen term.' + other
      : (BN.id === 'ski' ? 'Only the values are left. The picture is now a partial function from terms to values, and the hollow point stands for the terms that have none.' : 'Only the values are left. The hollow point stands for the terms drawn with no value reached; that the loop has none is argued in the text and not mechanized.');
    var idle = path.length < 2 || level === 4;
    time.disabled = idle; playBtn.disabled = idle;
    each('[data-l]', function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-l')) === level)); });
  }

  /* ---------- the net view ---------- */
  function netPath() {
    var d = NV, strat = order === 'random' ? 'random' : order;
    if (order === 'random') seed++;
    var rp = GRAPH.runPath(NET, d.g.states[0].t, strat, { max: 400, random: NET.rng(seed) });
    d.run = rp.states; d.rules = rp.rules;
    d.pairs = rp.ats.map(function (a) { var q = String(a).split('~'); return { a: Number(q[0]), b: Number(q[1]) }; });
    d.path = rp.keys.map(function (k) { return d.g.index[k]; });
    d.lens = {};
    ['outer', 'inner'].forEach(function (o) { d.lens[o] = GRAPH.runPath(NET, d.g.states[0].t, o, { max: 400 }).rules.length; });
    path = d.path; cyc = false;
    time.max = Math.max(path.length - 1, 0);
    // the nets of this run, drawn for the view of one step, in one frame wide enough for all of them
    d.lays = null;
  }
  function netLays() {
    var d = NV;
    if (d.lays) return d.lays;
    d.lays = d.run.map(function (n) { return NET.layoutNet(n); });
    d.fw = Math.max.apply(null, d.lays.map(function (l) { return l.width; }));
    d.fh = Math.max.apply(null, d.lays.map(function (l) { return l.height; }));
    return d.lays;
  }
  function netBuild() {
    clear(svg);
    drawn = lay();
    var tall = drawn === 'tall', lat = lattice(NODES[start].t), g = lat.g, D = Math.max(1, lat.depth);
    NV = { lat: lat, g: g, tall: tall };
    var W = tall ? 380 : 720, H = tall ? 460 : 262, pos = [];
    var lineY = H - 30;
    if (!tall) {
      var dx = Math.min(64, 600 / D), x0 = (W - dx * lat.depth) / 2, sp = Math.min(24, 170 / Math.max(1, lat.widest - 1));
      g.states.forEach(function (s, i) { pos[i] = [r1(x0 + s.depth * dx), r1(112 + lat.place[i] * sp)]; });
    } else {
      var dy = Math.min(40, (lineY - 80) / D), sx = Math.min(30, 300 / Math.max(1, lat.widest - 1));
      g.states.forEach(function (s, i) { pos[i] = [r1(190 + lat.place[i] * sx), r1(36 + s.depth * dy)]; });
    }
    NV.pos = pos; NV.W = W; NV.H = H;
    setVB(svg, '0 0 ' + W + ' ' + H);
    svg.setAttribute('data-lay', tall ? 'tall' : 'wide');
    var defs = S('defs', {}, svg);
    marker(defs, F.P + 'hnah', 'ah', 5); marker(defs, F.P + 'hnahg', 'ah-run', 5);
    var gLat = S('g', { 'class': 'fade' }, svg), gE = S('g', {}, gLat), gD = S('g', {}, gLat), gBase = S('g', { 'class': 'fade' }, svg);
    NV.gNet = S('g', { 'class': 'fade' }, svg); NV.gLat = gLat; NV.gBase = gBase;
    NV.edges = g.edges.map(function (e) {
      var a = pos[e.from], b = pos[e.to], dxe = b[0] - a[0], dye = b[1] - a[1], len = Math.sqrt(dxe * dxe + dye * dye) || 1, s = 6 / len;
      return S('line', { x1: r1(a[0] + dxe * s), y1: r1(a[1] + dye * s), x2: r1(b[0] - dxe * s), y2: r1(b[1] - dye * s), 'class': 'edge thin fade' }, gE);
    });
    NV.eidx = {};
    g.edges.forEach(function (e, k) { NV.eidx[e.from + '>' + e.to] = k; });
    NV.dots = g.states.map(function (s, i) { return S('circle', { cx: pos[i][0], cy: pos[i][1], r: 4.5, 'class': 'n-dot' + (s.normal ? ' nf' : '') }, gD); });
    // the line, and the value under the last net
    var last = g.states.map(function (s, i) { return i; }).filter(function (i) { return g.states[i].normal; })[0];
    S('line', { x1: 20, y1: lineY, x2: W - 20, y2: lineY, 'class': 'baseline' }, gBase);
    if (last !== undefined) {
      S('line', { x1: pos[last][0], y1: pos[last][1] + 6, x2: pos[last][0], y2: lineY, 'class': 'proj' }, gBase);
      NV.pt = S('circle', { cx: pos[last][0], cy: lineY, r: 4.5, 'class': 'basept k-run' }, gBase);
      S('text', { x: pos[last][0], y: lineY + 22, 'text-anchor': 'middle' }, gBase).textContent = NET.print(g.states[last].t);
    }
    token = S('circle', { r: 6, 'class': 'token fade' }, svg);
    netPath();
    shown = null; render();
  }
  function netRender() {
    var d = NV, n = d.path.length - 1, k = Math.floor(t + 1e-6), u = t - k;
    var i = d.path[Math.min(k, n)], j = d.path[Math.min(k + 1, n)], here = u < 0.5 ? Math.min(k, n) : Math.min(k + 1, n);
    var a = d.pos[i], b = d.pos[j];
    token.setAttribute('cx', r1(a[0] + (b[0] - a[0]) * u)); token.setAttribute('cy', r1(a[1] + (b[1] - a[1]) * u));
    var onPath = {}, onEdge = {};
    d.path.forEach(function (p, q) { onPath[p] = true; if (q < n) onEdge[d.eidx[p + '>' + d.path[q + 1]]] = true; });
    var cur = d.path[here];
    d.dots.forEach(function (c, ci) {
      op(c, level === 2 ? (onPath[ci] ? 1 : 0) : 1);
      c.setAttribute('class', 'n-dot' + (d.g.states[ci].normal ? ' nf' : '') + (level !== 4 && ci === cur ? ' cur' : onPath[ci] && level !== 4 ? ' on' : ''));
    });
    d.edges.forEach(function (e, ei) {
      var hot = onEdge[ei] && level !== 4;
      op(e, level === 2 ? (onEdge[ei] ? 1 : 0) : level === 4 ? 0.3 : hot ? 1 : 0.55);
      e.setAttribute('class', 'edge fade' + (hot ? ' focus' : ' thin'));
    });
    op(d.gLat, level === 1 ? 0 : level === 4 ? 0.15 : 1);
    op(d.gBase, level === 1 ? 0 : 1);
    op(token, level === 1 || level === 4 ? 0 : 1);
    // one step: the net itself, the pair about to interact drawn thick
    clear(d.gNet);
    var net = d.run[here], pair = here < n ? d.pairs[here] : null;
    if (level === 1) {
      var lays = netLays(), lay = lays[here], fw = Math.max(d.W, d.fw), fx = -(fw - lay.width) / 2;
      setVB(svg, r1(fx) + ' 0 ' + r1(fw) + ' ' + r1(Math.max(d.fh, 120)));
      drawNet(d.gNet, lay, pair);
      op(d.gNet, 1);
    } else {
      setVB(svg, '0 0 ' + d.W + ' ' + d.H);
      op(d.gNet, 0);
    }
    var nowHtml = NET.print(net, { html: true, mark: pair || undefined }) + ' <span class="after">· ' + NET.size(net) + (NET.size(net) === 1 ? ' agent' : ' agents') + '</span>';
    if (nowHtml !== shown) { $('now').innerHTML = nowHtml; shown = nowHtml; }
    var nInt = function (m) { return word(m) + (m === 1 ? ' interaction' : ' interactions'); };
    $('stepinfo').textContent = level === 4 ? ''
      : n < 1 ? 'Already a normal form: no interaction applies.'
      : !pair ? 'Finished in ' + nInt(n) + '.'
      : 'Interaction ' + (here + 1) + ' of ' + n + ': ' + d.rules[here] + '.' + (order === 'random' ? ' (A random order.)' : '');
    var same = 'Whichever order is chosen, outermost, innermost or random, the run to the irreducible net has the same length in the graph the browser computes: ' + nInt(n) + '.';
    $('heroread').textContent =
      level === 1 ? (pair
          ? 'One interaction, by the rule ‘' + d.rules[here] + '’. The thick green wire joins the two agents that interact. The other green wires join pairs that could interact instead.'
          : 'This net has no active pair, so no interaction applies. The term at its result port is its value.')
      : level === 2 ? (n > 0 ? 'The whole run, in the chosen order, through the nets the term can reach. ' + same : 'A run of no interactions. The net is already a value.')
      : level === 3 ? 'Every net that ' + NODES[start].label + ' can reach: ' + word(d.g.states.length) + (d.g.states.length === 1 ? ' net' : ' nets') + ', placed by the number of interactions done. The green path is the run in the chosen order. ' + (n > 0 ? same : '')
      : 'Only the value is left, the term read back from the last net. In the graph the browser computes, every order reaches it after the same number of interactions.';
    var idle = d.path.length < 2 || level === 4;
    time.disabled = idle; playBtn.disabled = idle;
    each('[data-l]', function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-l')) === level)); });
  }

  function stop() {
    if (playing !== null) { cancelAnimationFrame(playing); playing = null; }
    if (timer !== null) { clearTimeout(timer); timer = null; }
    playBtn.textContent = 'Play';
  }
  function finish() {
    stop();
    if (isNet()) { if (path.length > 1 && level !== 4 && NV.pt) kick(NV.pt, 'arrive'); }
    else if (!cyc && path.length > 1 && level !== 4) kick(v.pts[at(path.length - 1)], 'arrive');   // the value is reached
    playBtn.textContent = 'Play again';
  }
  function play() {
    var max = Number(time.max);
    if (max <= 0 || level === 4) return;
    if (t >= max - 1e-6) t = 0;
    playBtn.textContent = 'Pause';
    time.value = t; render();
    var per = isNet() ? 520 : 950;
    if (RM) {
      // reduced motion: one whole step at a time, with no sliding
      (function wait() {
        timer = setTimeout(function () {
          timer = null;
          t = Math.min(max, Math.floor(t + 1e-6) + 1); time.value = t; render();
          if (t < max) wait(); else finish();
        }, 800);
      })();
      return;
    }
    var last = null;
    function tick(ts) {
      if (last === null) last = ts;
      t = Math.min(max, t + (ts - last) / per); last = ts;
      time.value = t; render();
      if (t < max) playing = requestAnimationFrame(tick); else finish();
    }
    playing = requestAnimationFrame(tick);
  }
  function reset() { stop(); t = 0; if (isNet()) netBuild(); else buildPath(); time.value = 0; render(); }
  function choose(i) { touched = true; start = i; focus.value = i; if (level === 4) level = 3; reset(); play(); }
  playBtn.addEventListener('click', function () { touched = true; if (playing !== null || timer !== null) stop(); else play(); });
  time.addEventListener('input', function () { touched = true; stop(); t = Number(time.value); render(); });
  focus.addEventListener('change', function () { choose(Number(focus.value)); });
  ord.addEventListener('change', function () { touched = true; order = ord.value; reset(); play(); });
  each('[data-l]', function (b) {
    b.addEventListener('click', function () { touched = true; level = Number(b.getAttribute('data-l')); if (level === 4) stop(); render(); });
  });
  function build() {
    drawn = lay();
    if (isNet()) { netBuild(); return; }
    useLay(drawn === 'tall');
    v = drawBundle(svg, F.P + 'h'); labs = fibreLabels(v);
    token = S('circle', { r: 7, 'class': 'token fade' }, v.top);
    v.nodes.forEach(function (n, i) {
      n.g.setAttribute('class', 'fade pick'); n.g.setAttribute('role', 'button'); n.g.setAttribute('tabindex', '0');
      n.g.setAttribute('aria-label', 'Run ' + NODES[i].label);
      n.g.addEventListener('click', function () { choose(i); });
      n.g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(i); } });
    });
    shown = null; render();
  }
  // redrawn when the host crosses the width of the wide layout
  F.onWidth(function () { if (lay() !== drawn) build(); });
  // a new calculus: the same situation if it has one there, the orders it offers, and the figure redrawn
  onCalc(function (c) {
    stop(); t = 0; time.value = 0;
    if (start >= 11 || (c === 'net' && NODES[start].f === 'loop')) start = 0;
    if (c === 'net') {
      ord.innerHTML = '<option value="outer">outermost first</option><option value="inner">innermost first</option><option value="random">random</option>';
      tab3.textContent = 'All the states';
    } else {
      if (ord.innerHTML !== ORDER_SKI) ord.innerHTML = ORDER_SKI;
      if (order === 'random') order = 'outer';
      if (tab3.textContent !== TAB3) tab3.textContent = TAB3;
    }
    ord.value = order;
    fillFocus(); focus.value = start;
    if (c !== 'net') buildPath(); else syncOrder();
    build();
  });
  if (isNet()) { ord.innerHTML = '<option value="outer">outermost first</option><option value="inner">innermost first</option><option value="random">random</option>'; tab3.textContent = 'All the states'; }
  if (!isNet()) buildPath();
  build();
  if (!RM && !F.still) onFirstView(svg, function () { if (!touched) play(); });
};

/* ---------- equalities: one figure for the three, one for the effect of reading code ----------
   In tree calculus probes read code, so 'same under every probe' puts the points where running does
   ('testsep'), and the rule S K y → I joins fibres that probes keep apart: it is drawn in red. */
function eqFigure(F, svg, pid, st, describe) {
  var v, cur, anim = null, labs, arcs, hadRule = false, drawn = null;
  function eff() {
    if (BN.id !== 'ski' && st.mode === 'test') return 'testsep';
    return (st.mode === 'test' && st.code) ? 'run' : st.mode;
  }
  function merges(n) { return n.f === 'I' || n.f === 'SKK' || n.f === 'SKS'; }
  function target(m) {
    return NODES.map(function (n, i) {
      if (m === 'syntax') return SYN[i];
      if (m === 'test' && merges(n)) return L.merged;
      if (m === 'run' && st.rule && merges(n)) return L.fib.I;
      return L.fib[n.f];
    });
  }
  function place(ps) {
    ps.forEach(function (p, i) {
      v.proj[i].setAttribute('x2', p[0]); v.proj[i].setAttribute('y2', p[1]);
      v.pts[i].setAttribute('cx', p[0]); v.pts[i].setAttribute('cy', p[1]);
    });
    cur = ps;
  }
  function render(animate) {
    useLay(drawn);
    var m = eff(), to = target(m), from = cur || to;
    var show = m === 'run' && st.rule ? 'rule' : m === 'testsep' ? 'run' : m;
    Object.keys(labs).forEach(function (k) { op(labs[k], k === show ? 1 : 0); });
    arcs.forEach(function (a) {
      op(a, st.rule ? 1 : 0);
      if (st.rule && !hadRule && animate && !RM) {       // the new steps are drawn in
        var len = a.getTotalLength();
        a.style.transition = 'none'; a.style.strokeDasharray = len; a.style.strokeDashoffset = len;
        a.getBoundingClientRect();
        a.style.transition = 'stroke-dashoffset 0.8s ease'; a.style.strokeDashoffset = 0;
      }
    });
    hadRule = st.rule;
    // the points take the colour of what decides the equality
    var kc = st.mode === 'syntax' ? ' k-atom' : st.mode === 'test' ? ' k-probe' : ' k-run';
    NODES.forEach(function (n, i) { v.pts[i].setAttribute('class', 'basept fade' + ((m !== 'syntax' && n.f === 'loop') ? ' hollow' : kc)); });
    var joined = (m === 'test' || (m === 'run' && st.rule)) && animate;
    if (anim) cancelAnimationFrame(anim);
    if (!animate || RM) { place(to); if (joined) kick(v.pts[10], 'arrive'); }
    else {
      var t0 = null;
      var tick = function (ts) {
        if (t0 === null) t0 = ts;
        var u = Math.min(1, (ts - t0) / 750), e = ease(u);
        place(from.map(function (p, i) { return [p[0] + (to[i][0] - p[0]) * e, p[1] + (to[i][1] - p[1]) * e]; }));
        if (u < 1) anim = requestAnimationFrame(tick);
        else if (joined) kick(v.pts[10], 'arrive');      // the points that have come together
      };
      anim = requestAnimationFrame(tick);
    }
    var count = {};
    to.forEach(function (p) { count[Math.round(p[0]) + ',' + Math.round(p[1])] = true; });
    describe(m, Object.keys(count).length, NODES.length);
  }
  function build() {
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    drawn = tallFor(F.width()); useLay(drawn);
    v = drawBundle(svg, pid); cur = null;
    v.proj.forEach(function (p) { op(p, 0.6); });
    var g = {};
    ['syntax', 'run', 'rule', 'test'].forEach(function (k) { g[k] = S('g', { 'class': 'fade' }, v.base); });
    var sl = S('text', { x: L.synlab[0], y: L.synlab[1], 'text-anchor': 'middle', 'class': 'lab' }, g.syntax);
    if (L.synlab[2]) sl.setAttribute('transform', 'rotate(' + L.synlab[2] + ' ' + L.synlab[0] + ' ' + L.synlab[1] + ')');
    sl.textContent = 'one point for each description';
    Object.keys(FIBS).forEach(function (k) {
      baseLabel(g.run, L.fib[k], fibName(k), k === 'loop' ? 'lab' : '');
      if (k !== 'SKK' && k !== 'SKS') baseLabel(g.rule, L.fib[k], fibName(k), k === 'loop' ? 'lab' : '');
    });
    [[L.fib.a, 'a', ''], [L.merged, 'the identity', 'lab'], [L.fib.loop, BN.id === 'ski' ? 'no value' : 'no value reached', 'lab']].forEach(function (p) { baseLabel(g.test, p[0], p[1], p[2]); });
    labs = g;
    // the steps of the rule: green where it is sound, red where it joins what probes keep apart
    var bad = BN.id !== 'ski';
    arcs = L.arcs.map(function (d) { return S('path', { d: d, 'class': 'edge ' + (bad ? 'leak' : 'run') + ' fade', 'marker-end': 'url(#' + pid + (bad ? 'ahr' : 'ahg') + ')' }, v.edgeLayer); });
    hadRule = st.rule;
    render(false);
  }
  F.onWidth(function () { if (tallFor(F.width()) !== drawn) build(); });
  onCalc(build);
  build();
  return render;
}
FIGS['equalities'] = function (root, F) {
  var $ = F.$, each = F.each;
  var st = { mode: 'run', rule: false, code: false };
  var render = eqFigure(F, $('svg-base'), F.P + 'b', st, function (m, n, N) {
    var head = cap(word(N)) + ' descriptions, ' + word(n) + ' points. ', third = FIBS.SKS;
    $('baseread').textContent = head + (
      m === 'syntax' ? 'Two descriptions are equal only if they are the same tree.'
      : m === 'run' && st.rule ? 'With the rule S K y → I, the terms S K K and ' + third + ' step to I, and three fibres have become one.' +
        (BN.id === 'ski' ? '' : ' But the triage probe reads x, y and z from these three terms, so the rule joins terms that probes keep apart. Here it is unsound.')
      : m === 'run' ? 'Descriptions in one fibre share a point. I, S K K and ' + third + ' are normal forms, so no step joins them.'
      : m === 'testsep' ? 'The triage probe reads x from I, y from S K K and z from ' + third + ', so the three do not share a point. The other points are placed by fibre, as given to the figure.' +
        (st.rule ? ' The rule S K y → I would join them, so it is unsound here.' : '')
      : 'In the table of six terms and three probes, I, S K K and S K S had the same readings in every column, so they share a point.');
    // the caption's order of the three holds unless the added rule joins terms that probes keep apart
    $('basecap').textContent = BN.id !== 'ski' && st.rule
      ? 'The added rule merges three terms that probes still distinguish, so here sameness under probes is not coarser than sameness after running.'
      : 'Each equality is coarser than the one before it.';
    each('[data-m]', function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-m') === st.mode)); });
  });
  each('[data-m]', function (b) { b.addEventListener('click', function () { st.mode = b.getAttribute('data-m'); render(true); }); });
  $('addrule').addEventListener('change', function () { st.rule = this.checked; render(true); });
};
FIGS['code-probes'] = function (root, F) {
  var $ = F.$;
  var st = { mode: 'test', rule: false, code: false }, box = $('readcode'), mine = false;
  var render = eqFigure(F, $('svg-code'), F.P + 'c', st, function (m, n, N) {
    $('coderead').textContent = cap(word(N)) + ' descriptions, ' + word(n) + ' points. ' + (BN.id !== 'ski'
      ? 'In tree calculus a probe can triage, and it separates I, S K K and ' + FIBS.SKS + ' by their code' + (F.still ? '' : ', with no checkbox') + '. The other points are placed by fibre, as given to the figure.'
      : st.code
      ? 'A probe that can read a normal form, variables included, separates I, S K K and S K S. Sameness under such probes now agrees with sameness after running, for terms one of which has a value.'
      : 'A probe reads only what it supplied, and cannot separate I, S K K and S K S.');
  });
  box.addEventListener('change', function () { st.code = this.checked; mine = this.checked; render(true); });
  // in tree calculus the box is always ticked: the calculus's own triage does the reading
  function sync() {
    var tree = calc !== 'ski';
    box.checked = tree || mine; box.disabled = tree; st.code = box.checked;
    render(false);
  }
  onCalc(sync);
  if (calc !== 'ski') sync();
};

/* ---------- types: a predicate and its leaks ---------- */
FIGS['predicates'] = function (root, F) {
  var $ = F.$;
  var svg = $('svg-paint'), v, drawn = null;
  // the text of a term: as written in combinatory logic, as printed (with its abbreviations) in tree calculus
  function txt(n) { return BN.id === 'ski' ? n.key : n.label; }
  function symbols(s) { return (s.match(BN.id === 'ski' ? /[^\s()]+/g : /△|[^\s()△]+/g) || []).length; }
  function returnsA(n) {
    if (BN.id === 'ski') return nfOuter(App(n.t, A('x'))) === 'x';
    var seq = TREE.run(TREE.app(n.t, TREE.atom('x')), 'outer', 60), last = seq[seq.length - 1];
    return TREE.isNormal(last) && TREE.key(last) === 'x';
  }
  var custom = NODES.map(function () { return false; });
  var PREDS = [
    { id: 'hasK', label: 'mentions K', by: 'a', f: function (n) { return /K/.test(txt(n)); } },
    { id: 'hasA', label: 'mentions a', by: 'a', f: function (n) { return /(^|[\s(△])a($|[\s)])/.test(txt(n)); } },
    { id: 'small', label: 'has at most three symbols', by: 'a', f: function (n) { return symbols(txt(n)) <= 3; } },
    { id: 'normal', label: 'is already a normal form', by: 'a', f: function (n) { return !!n.nf; } },
    { id: 'evalA', label: 'runs to a', by: 'r', f: function (n) { return n.f === 'a'; } },
    { id: 'evalI', label: 'runs to I', by: 'r', f: function (n) { return n.f === 'I'; },
      note: 'This predicate shades one whole fibre. No probe defines it, because it holds of I and not of S K K, and those two give the same readings under every probe.',
      noteTree: 'This predicate shades one whole fibre, and in tree calculus a probe defines it as well, on terms without variables and, through closed instances, on the terms shown: a tree can compare the value of a closed term with I, because equality of closed trees is decided by a program.' },
    { id: 'halts', label: 'has a normal form', by: 'r', f: function (n) { return n.f !== 'loop'; },
      noteTree: 'The loop terms are left unshaded: each of their reducts keeps a redex, an argument made by hand and not mechanized for trees.' },
    { id: 'probeA', label: 'returns its argument', by: 'b', f: function (n) { return returnsA(n); },
      note: 'This predicate is defined by the probe [ ] x with the reading x. The figure applies the probe directly; on the terms drawn it passes exactly when it passes on all closed instances. It shades I, S K K and S K S, and every term that runs to I. These are the fibres that sameness under probes merged.',
      noteTree: 'This predicate is defined by the probe [ ] x with the reading x, read on closed instances. The figure applies the probe directly, which on these terms gives the same verdict. It shades I, S K K and S K (△K), and every term that runs to I. Other probes tell these three apart, but this one does not need to.' },
    { id: 'custom', label: 'your own (select the boxes)', f: function (n, i) { return custom[i]; } }
  ];
  var sel = $('pred'), btn = $('closeit'), closed = false, timers = [];
  PREDS.forEach(function (p) { var o = document.createElement('option'); o.value = p.id; o.textContent = p.label; sel.appendChild(o); });
  function current() { return PREDS.filter(function (q) { return q.id === sel.value; })[0]; }
  function render() {
    timers.forEach(clearTimeout); timers = [];
    var p = current(), pb = p.by ? ' p' + p.by : '';
    var on = NODES.map(p.f), leaks = [], any = on.some(Boolean);
    EDGES.forEach(function (e, ei) { if (on[e[0]] !== on[e[1]]) leaks.push(ei); });
    // closure: a fibre is connected by steps, so one shaded description shades the whole fibre
    var hit = {};
    NODES.forEach(function (n, i) { if (on[i]) hit[n.f] = true; });
    var spread = NODES.map(function (n, i) { return !on[i] && hit[n.f]; });
    v.nodes.forEach(function (n, i) {
      n.r.setAttribute('class', 'n-rect' + (NODES[i].nf ? ' nf' : '') + (on[i] ? ' paint' + pb : ''));
      n.g.setAttribute('aria-pressed', String(!!(on[i] || (closed && spread[i]))));     // pressed if shown shaded
    });
    v.edges.forEach(function (e, ei) {
      var leak = !closed && leaks.indexOf(ei) >= 0;
      e.setAttribute('class', 'edge fade' + (leak ? ' leak' : ''));
      e.setAttribute('marker-end', 'url(#' + F.P + 'p' + (leak ? 'ahr' : 'ah') + ')');
    });
    if (closed) {
      var k = 0;
      NODES.forEach(function (n, i) {
        if (!spread[i]) return;
        var paint = function () { v.nodes[i].r.setAttribute('class', 'n-rect' + (n.nf ? ' nf' : '') + ' spread' + pb); };
        if (RM) paint(); else timers.push(setTimeout(paint, 160 * (++k)));
      });
    }
    btn.setAttribute('aria-pressed', String(closed));
    btn.textContent = closed ? 'Undo closing' : 'Close it';
    btn.disabled = leaks.length === 0;
    var vd = $('verdict'), rd = $('paintread');
    if (leaks.length === 0) {
      vd.className = 'verdict'; vd.textContent = 'No leaks. The predicate is a type.';
      rd.textContent = (BN.id === 'ski' ? p.note : p.noteTree) || (any
        ? 'Each fibre is shaded entirely or not at all, so the predicate can be stated by naming points on the line.'
        : 'Nothing is shaded. The empty predicate is a type, though not a useful one. Select a box to shade it.');
    } else if (!closed) {
      var e = EDGES[leaks[0]], x = NODES[e[0]], y = NODES[e[1]];
      vd.className = 'verdict bad'; vd.textContent = cap(word(leaks.length)) + (leaks.length === 1 ? ' leak.' : ' leaks.') + ' The predicate is not a type.';
      rd.textContent = x.label + ' steps to ' + y.label + ', and only one of the two satisfies the predicate. Running a term can therefore change whether it belongs.';
    } else {
      var fibs = Object.keys(hit).length;
      vd.className = 'verdict'; vd.textContent = 'Closed. The shading is the smallest type that contains the predicate.';
      rd.textContent = 'The shading has been extended to every term joined to a shaded one by steps in either direction. It covers ' + word(fibs) + (fibs === 1 ? ' whole fibre' : ' whole fibres') + ', and the dashed boxes are the terms that were added.';
    }
  }
  // a hand edit starts from the shading on show: the predicate, or its closure if it has been closed
  function toggle(i) {
    if (sel.value !== 'custom' || closed) {
      var on = NODES.map(current().f), hit = {};
      NODES.forEach(function (n, k) { if (on[k]) hit[n.f] = true; });
      custom = NODES.map(function (n, k) { return !!on[k] || (closed && !!hit[n.f]); });
      sel.value = 'custom';
    }
    custom[i] = !custom[i]; closed = false; render();
  }
  sel.addEventListener('change', function () { closed = false; render(); });
  btn.addEventListener('click', function () { closed = !closed; render(); });
  function build() {
    drawn = tallFor(F.width()); useLay(drawn);
    v = drawBundle(svg, F.P + 'p'); fibreLabels(v);
    v.nodes.forEach(function (n, i) {
      n.g.setAttribute('class', 'fade pick'); n.g.setAttribute('role', 'button'); n.g.setAttribute('tabindex', '0');
      n.g.setAttribute('aria-label', 'Shade ' + NODES[i].label);
      n.g.addEventListener('click', function () { toggle(i); });
      n.g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(i); } });
    });
    render();
  }
  F.onWidth(function () { if (tallFor(F.width()) !== drawn) build(); });
  onCalc(function () { custom = NODES.map(function () { return false; }); closed = false; build(); });
  build();
};

/* ---------- types: the fundamental lemma for K ---------- */
FIGS['lemma'] = function (root, F) {
  var $ = F.$, each = F.each, P = F.P;
  var svg = $('svg-lemma'), stem, mark, capt, STAGES;
  var k = 0, x = 350, anim = null;
  function build() {
    clear(svg);
    var defs = S('defs', {}, svg), tr = calc !== 'ski', K = tr ? '△△' : 'K';
    marker(defs, P + 'lah', 'ah', 7); marker(defs, P + 'lahb', 'ah-blue', 7); marker(defs, P + 'lahg', 'ah-run', 5);
    var Y = 98, B = [{ x: 50, s: K, w: 30, atom: true }, { x: 200, s: K + ' u v', w: tr ? 68 : 60 }, { x: 350, s: 'u', w: 28, nf: true }];
    S('line', { x1: 70, y1: Y, x2: 165, y2: Y, 'class': 'edge blue', 'marker-end': 'url(#' + P + 'lahb)' }, svg);
    S('text', { x: 118, y: Y - 9, 'text-anchor': 'middle', 'class': 'lab blue' }, svg).textContent = 'the probe [ ] u v';
    S('line', { x1: 235, y1: Y, x2: 331, y2: Y, 'class': 'edge run', 'marker-end': 'url(#' + P + 'lahg)' }, svg);
    S('text', { x: 283, y: Y - 9, 'text-anchor': 'middle', 'class': 'lab green' }, svg).textContent = tr ? 'the K-rule' : 'one step';
    B.forEach(function (b) {
      S('rect', { x: b.x - b.w / 2, y: Y - 11, width: b.w, height: 22, rx: 3, 'class': 'n-rect' + (b.nf ? ' nf' : '') }, svg);
      S('text', { x: b.x, y: Y + 4.5, 'text-anchor': 'middle', 'class': 't-atom' }, svg).textContent = b.s;
    });
    stem = S('line', { y1: 54, y2: Y - 13, 'class': 'proj' }, svg);
    mark = S('circle', { cy: 46, r: 7, 'class': 'evid' }, svg);
    capt = S('text', { y: 26, 'text-anchor': 'middle', 'class': 't-probe' }, svg);
    STAGES = [
      { x: 350, cap: 'u ∈ ⟦A⟧', say: 'Given: u is in ⟦A⟧ and v is in ⟦B⟧.' },
      { x: 200, cap: K + ' u v ∈ ⟦A⟧', say: K + ' u v steps to u' + (tr ? ' by the K-rule' : '') + '. ⟦A⟧ is a type, so membership passes back across the step, and ' + K + ' u v is in ⟦A⟧.' },
      { x: 50, cap: K + ' ∈ ⟦A → B → A⟧', say: 'This holds for every u in ⟦A⟧ and every v in ⟦B⟧, which is what the probe [ ] u v requires of ' + K + '.' }
    ];
  }
  function put(px) { x = px; mark.setAttribute('cx', px); stem.setAttribute('x1', px); stem.setAttribute('x2', px); capt.setAttribute('x', Math.min(350, Math.max(66, px))); }
  function render(animate) {
    var st = STAGES[k], from = x;
    capt.textContent = st.cap; $('lemmaread').textContent = st.say;
    each('.tab[data-k]', function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-k')) === k)); });
    if (anim) cancelAnimationFrame(anim);
    if (!animate || RM) { put(st.x); if (animate) kick(mark, 'arrive'); return; }
    var t0 = null;
    var tick = function (ts) {
      if (t0 === null) t0 = ts;
      var u = Math.min(1, (ts - t0) / 700);
      put(from + (st.x - from) * ease(u));
      if (u < 1) anim = requestAnimationFrame(tick); else kick(mark, 'arrive');
    };
    anim = requestAnimationFrame(tick);
  }
  var seq = [];
  function halt() { seq.forEach(clearTimeout); seq = []; }
  each('.tab[data-k]', function (b) { b.addEventListener('click', function () { halt(); k = Number(b.getAttribute('data-k')); render(true); }); });
  $('lemmaplay').addEventListener('click', function () {      // the three stages in turn
    halt(); k = 0; render(false);
    seq.push(setTimeout(function () { k = 1; render(true); }, 1100));
    seq.push(setTimeout(function () { k = 2; render(true); }, 3000));
  });
  onCalc(function () { halt(); if (anim) cancelAnimationFrame(anim); anim = null; build(); render(false); });
  build();
  render(false);
};

/* ---------- what a type cannot see: two fibres from the inside ---------- */
FIGS['pentagon'] = function (root, F) {
  var $ = F.$, P = F.P;
  function node(s, x, y, nf) { return { s: s, x: x, y: y, w: boxW(s), nf: nf }; }
  function box(svg, n) {
    S('rect', { x: n.x - n.w / 2, y: n.y - 11, width: n.w, height: 22, rx: 3, 'class': 'n-rect' + (n.nf ? ' nf' : '') }, svg);
    S('text', { x: n.x, y: n.y + 4.5, 'text-anchor': 'middle', 'class': 't-atom' }, svg).textContent = n.s;
  }
  function seg(a, b) { return [clip(a, b), clip(b, a)]; }
  function arrow(svg, id, a, b, cls) {
    var s = seg(a, b);
    S('line', { x1: s[0][0], y1: s[0][1], x2: s[1][0], y2: s[1][1], 'class': 'edge' + (cls ? ' ' + cls : ''), 'marker-end': 'url(#' + id + ')' }, svg);
    return s;
  }
  function base(svg, n, x1, x2) {
    S('line', { x1: n.x, y1: n.y + 11, x2: n.x, y2: 198, 'class': 'proj' }, svg);
    S('line', { x1: x1, y1: 198, x2: x2, y2: 198, 'class': 'baseline' }, svg);
    S('circle', { cx: n.x, cy: 198, r: 4.5, 'class': 'basept' }, svg);
    S('text', { x: n.x, y: 216, 'text-anchor': 'middle', 'class': 'lab' }, svg).textContent = 'one point';
  }
  // position at fraction u of a polyline, by length
  function along(pts, u) {
    var len = [0], i;
    for (i = 1; i < pts.length; i++) len[i] = len[i - 1] + Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2));
    var d = Math.min(1, Math.max(0, u)) * len[len.length - 1];
    for (i = 1; i < pts.length; i++) if (d <= len[i] || i === pts.length - 1) {
      var f = len[i] === len[i - 1] ? 0 : (d - len[i - 1]) / (len[i] - len[i - 1]);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    return pts[0];
  }
  function put(c, p) { c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); }
  // a route that stops d short of its end, so a marker at rest stays clear of the box
  function shortBy(pts, d) {
    var out = pts.slice(), a = out[out.length - 2], b = out[out.length - 1];
    var len = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));
    out[out.length - 1] = [b[0] - (b[0] - a[0]) * d / len, b[1] - (b[1] - a[1]) * d / len];
    return out;
  }

  // the associativity pentagon
  var pent = $('svg-pent'); marker(S('defs', {}, pent), P + 'm1', 'ah', 7);
  var Pa = node('((xy)z)w', 165, 26), Pb = node('(xy)(zw)', 262, 92), Pc = node('x(y(zw))', 165, 158, true),
      Pd = node('(x(yz))w', 68, 70), Pe = node('x((yz)w)', 68, 120);
  var hole = S('polygon', { points: [Pa, Pb, Pc, Pe, Pd].map(function (p) { return p.x + ',' + p.y; }).join(' '), 'class': 'hole' }, pent);
  var r1p = [].concat(arrow(pent, P + 'm1', Pa, Pb), arrow(pent, P + 'm1', Pb, Pc));
  var r2p = [].concat(arrow(pent, P + 'm1', Pa, Pd), arrow(pent, P + 'm1', Pd, Pe), arrow(pent, P + 'm1', Pe, Pc));
  r1p = shortBy(r1p, 7); r2p = shortBy(r2p, 7);
  // markers are drawn under the boxes, so they pass behind a term and not across its text
  var tk1 = S('circle', { r: 6, 'class': 'token' }, pent), tk2 = S('circle', { r: 5.5, 'class': 'ring' }, pent);
  [Pa, Pb, Pc, Pd, Pe].forEach(function (n) { box(pent, n); });
  base(pent, Pc, 100, 230);
  var holeLab = S('text', { x: 165, y: 96, 'text-anchor': 'middle', 'class': 'lab' }, pent);
  function pentSay() {
    var on = $('fill').checked;
    hole.setAttribute('class', 'hole' + (on ? ' on' : ''));
    holeLab.textContent = on ? 'one run' : '';
    $('pentread').textContent = on
      ? 'They are now counted as one run, and evidence carried along either arrives in the same state.'
      : 'Nothing in the rule says whether they are the same run.';
  }
  $('fill').addEventListener('change', pentSay);
  pentSay();

  // K a (ω ω): a cycle of terms, each with an exit. In tree calculus the cycle has five terms (the Lean
  // cycle, Tree.omega_cycle); for nets the panel follows the eager net, whose result port reads a early.
  var ex = $('svg-exit'), tk3, tk3b, lap, out, exitMode = null, exitNet = null;
  function buildExit() {
    clear(ex);
    exitMode = calc;
    if (calc === 'net') { buildExitNet(); return; }
    marker(S('defs', {}, ex), P + 'm2', 'ah', 7);
    var C, X, q1;
    if (calc === 'ski') {
      var T0 = parse('K a (S I I (S I I))'), T1 = contractAt(T0, redexInner(T0)), T2 = contractAt(T1, redexInner(T1));
      C = [node(pretty(T0), 100, 28), node(pretty(T1), 100, 82), node(pretty(T2), 100, 136)];
      X = node('a', 288, 82, true); q1 = [-8, 82];
    } else {
      C = KLOOP().map(function (s, k) { return node(s, 128, 20 + 33 * k); });
      X = node('a', 296, 86, true); q1 = [-10, 86];
    }
    var chain = [];
    for (var k = 0; k + 1 < C.length; k++) chain.push(arrow(ex, P + 'm2', C[k], C[k + 1]));
    var last = C[C.length - 1];
    var q0 = [last.x - last.w / 2 - 3, last.y - 2], q2 = [C[0].x - C[0].w / 2 - 3, C[0].y + 3];
    S('path', { d: 'M ' + q0.join(' ') + ' Q ' + q1.join(' ') + ' ' + q2.join(' '), 'class': 'edge', 'marker-end': 'url(#' + P + 'm2)' }, ex);
    var back = [];
    for (var i = 0; i <= 14; i++) {
      var u = i / 14, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u;
      back.push([w0 * q0[0] + w1 * q1[0] + w2 * q2[0], w0 * q0[1] + w1 * q1[1] + w2 * q2[1]]);
    }
    var exits = C.map(function (n) { return arrow(ex, P + 'm2', n, X, 'thin'); });
    lap = [].concat.apply([], chain).concat(back, [chain[0][0]]);
    out = exits[0].concat([[X.x, X.y - 20]]);
    tk3 = S('circle', { r: 6, 'class': 'token' }, ex); tk3b = S('circle', { r: 5.5, 'class': 'ring' }, ex);
    C.forEach(function (n) { box(ex, n); }); box(ex, X);
    if (calc === 'ski') S('text', { x: 222, y: 48, 'text-anchor': 'middle', 'class': 'lab green' }, ex).textContent = 'K-rule';
    else S('text', { x: 226, y: 42, 'text-anchor': 'middle', 'class': 'lab green' }, ex).textContent = 'K-rule';
    base(ex, X, X.x - 62, X.x + 34);
  }
  // the eager net of K a (ω ω): what the result port reads, and the count of interactions, which has not stopped by the cap
  var CAPN = 400;
  function buildExitNet() {
    if (!exitNet) {
      var run = NET.run(NET.parse('K a (ω ω)'), 'outer', CAPN);
      exitNet = { sizes: run.map(NET.size), reads: run.map(function (n) { return NET.print(n); }), pairs: run.map(function (n) { return NET.activePairs(n).length; }) };
      exitNet.first = exitNet.reads.indexOf('a');
    }
    marker(S('defs', {}, ex), P + 'm2', 'ah', 7);
    var top = node('K a (ω ω)', 84, 34), X = node('a', 84, 128);
    exitNet.top = top; exitNet.X = X;
    var s = arrow(ex, P + 'm2', top, X);
    box(ex, top); box(ex, X);
    S('text', { x: 92, y: 71, 'class': 'lab green' }, ex).textContent = 'reads a after';
    S('text', { x: 92, y: 85, 'class': 'lab green' }, ex).textContent = exitNet.first + ' interactions';
    S('line', { x1: X.x, y1: X.y + 11, x2: X.x, y2: 198, 'class': 'proj' }, ex);
    S('line', { x1: 24, y1: 198, x2: 150, y2: 198, 'class': 'baseline' }, ex);
    exitNet.pt = S('circle', { cx: X.x, cy: 198, r: 4.5, 'class': 'basept' }, ex);
    S('text', { x: X.x, y: 216, 'text-anchor': 'middle', 'class': 'lab' }, ex).textContent = 'the result port reads a';
    // the count is of the whole net, from the start: the eraser of K waits on the net of ω ω, which keeps running
    S('rect', { x: 186, y: 22, width: 132, height: 150, rx: 8, 'class': 'detached-box' }, ex);
    S('text', { x: 252, y: 42, 'text-anchor': 'middle', 'class': 'lab' }, ex).textContent = 'the whole net';
    S('circle', { cx: 252, cy: 92, r: 24, 'class': 'proj' }, ex);
    exitNet.count = S('text', { x: 252, y: 99, 'text-anchor': 'middle', 'class': 'ev' }, ex);
    exitNet.count.style.fill = 'var(--ls-run)';
    S('text', { x: 252, y: 134, 'text-anchor': 'middle', 'class': 'lab green' }, ex).textContent = 'interactions';
    exitNet.agents = S('text', { x: 252, y: 156, 'text-anchor': 'middle', 'class': 'lab' }, ex);
    exitNet.box = ex.querySelectorAll('rect.n-rect')[1];
    tk3 = S('circle', { r: 5, 'class': 'token' }, ex);
    tk3b = null; lap = null; out = s;
  }
  function frameNet(ms) {
    var d = exitNet, step = Math.floor(ms / 45) % (CAPN + 60), n = Math.min(step, CAPN);
    d.count.textContent = n >= CAPN ? CAPN + '…' : String(n);
    d.agents.textContent = d.sizes[n] + ' agents, ' + d.pairs[n] + ' active pairs';
    put(tk3, [252 + 24 * Math.cos(ms / 300), 92 + 24 * Math.sin(ms / 300)]);
    var got = n >= d.first;
    d.box.setAttribute('class', 'n-rect' + (got ? ' cur' : ''));
    if (got && !d.was) kick(d.pt, 'arrive');
    d.was = got;
  }
  function KLOOP() { return BUNDLE.tree.NODES.filter(function (n) { return n.cyc; }).map(function (n) { return 'K a (' + n.s + ')'; }); }
  buildExit();
  onCalc(function () { buildExit(); frame(clock || 0); });

  // under reduced motion the markers move in a few plain jumps, not a glide
  function q(x, n) { return RM ? Math.round(x * n) / n : x; }
  function frame(ms) {
    var v = Math.min(1, ((ms % 4200) / 4200) / 0.7);            // travel, then rest at the end
    put(tk1, along(r1p, q(v, 4))); put(tk2, along(r2p, q(v, 6)));
    if (exitMode === 'net') { frameNet(ms); return; }
    var lapMs = exitMode === 'ski' ? 3000 : 5000;
    put(tk3, along(lap, q((ms % lapMs) / lapMs, exitMode === 'ski' ? 6 : 10)));
    put(tk3b, along(out, q(Math.min(1, ((ms % 4200) / 4200) / 0.3), 2)));
  }
  // The markers move while the figure is on screen, and Pause stops them. Under reduced motion they start
  // still, at rest at the ends of their routes, and Play moves them in plain jumps.
  var visible = !hasIO(), raf = null, clock = 0, last = null, started = false, paused = RM || F.still, hop = null, pauseBtn = $('exitpause');
  function loop(ts) {
    if (last === null) { if (!started) clock = ts; started = true; } else clock += ts - last;
    last = ts; frame(clock);
    if (visible && !paused) raf = requestAnimationFrame(loop); else { raf = null; last = null; }
  }
  function go() {
    if (paused || !visible) return;
    if (RM) { if (hop === null) hop = setInterval(function () { if (visible && !paused) { clock += 600; frame(clock); } }, 600); }
    else if (raf === null) raf = requestAnimationFrame(loop);
  }
  function halt() {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; last = null; }
    if (hop !== null) { clearInterval(hop); hop = null; }
  }
  pauseBtn.addEventListener('click', function () { paused = !paused; if (paused) halt(); pauseBtn.textContent = paused ? 'Play' : 'Pause'; go(); });
  pauseBtn.textContent = paused ? 'Play' : 'Pause';
  // the markers move only while the figure is on screen (and so not before it has been seen)
  if (hasIO() && !F.still) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; go(); }).observe(root);
  }
  if (RM || F.still) clock = 2940;       // both routes of the pentagon ended, and the ring at a
  frame(clock);
  go();
};

/* ---------- changing the ingredients ----------
   The helpers of the figures of this section (the notions, the processes, the grid of words, the fibres, the loop). */
function node(t, x, y, nf) { var s = typeof t === 'string' ? t : pretty(t); return { t: t, s: s, x: x, y: y, w: boxW(s), nf: !!nf }; }
function box(parent, n) {
  S('rect', { x: n.x - n.w / 2, y: n.y - 11, width: n.w, height: 22, rx: 3, 'class': 'n-rect' + (n.nf ? ' nf' : '') }, parent);
  S('text', { x: n.x, y: n.y + 4.5, 'text-anchor': 'middle', 'class': 't-atom' }, parent).textContent = n.s;
}
function seg(a, b) { return [clip(a, b), clip(b, a)]; }
function line(parent, sg, id, cls) {
  var at = { x1: sg[0][0], y1: sg[0][1], x2: sg[1][0], y2: sg[1][1], 'class': 'edge' + (cls ? ' ' + cls : '') };
  if (id) at['marker-end'] = 'url(#' + id + ')';
  return S('line', at, parent);
}
function text(parent, x, y, str, cls, anchor) {
  var e = S('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'class': cls || '' }, parent);
  e.textContent = str; return e;
}
// a polyline measured by length
function route(pts) {
  var len = [0];
  for (var i = 1; i < pts.length; i++) len[i] = len[i - 1] + Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2));
  return {
    L: len[len.length - 1], len: len,
    at: function (d) {
      d = Math.min(this.L, Math.max(0, d));
      for (var k = 1; k < pts.length; k++) if (d <= len[k] || k === pts.length - 1) {
        var f = len[k] === len[k - 1] ? 0 : (d - len[k - 1]) / (len[k] - len[k - 1]);
        return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f];
      }
      return pts[0];
    }
  };
}
function put(c, p) { c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); }
function ruleName(r) { return spine(r.node).head.n; }

/* the zoo: one small picture for each way of making the choices.
   Ochre boxes are descriptions, green arrows steps, blue marks the probe and what it reads, black is what is kept.
   In the component, each drawing has its card's heading under it; the cards' text is in the Markdown.
   Marker ids carry the figure's prefix: start(id) returns the svg, and the drawings name markers by P + id. */
FIGS['notions'] = function (root, F) {
  var $ = F.$, P = F.P;
  function start(id) {
    var svg = $(id), d = S('defs', {}, svg);
    id = P + id;
    marker(d, id + 'g', 'ah', 6); marker(d, id + 'b', 'ah-blue', 6);
    var m = S('marker', { id: id + 'r', viewBox: '0 0 10 10', refX: 1, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, d);
    S('path', { d: 'M10 0 L0 5 L10 10 z', 'class': 'ah' }, m);       // the head at the near end of a two-way step
    return svg;
  }
  function desc(svg, x, y, label) {
    var w = label ? label.length * 6.6 + 12 : 26;
    S('rect', { x: x - w / 2, y: y - 9, width: w, height: 18, rx: 3, 'class': 'zdesc' }, svg);
    if (label) text(svg, x, y + 4, label, 't-atom zt');
    return { x: x, y: y, w: w };
  }
  function edge(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var sx = dx === 0 ? Infinity : (a.w / 2 + 3) / Math.abs(dx), sy = dy === 0 ? Infinity : 12 / Math.abs(dy), s = Math.min(sx, sy);
    return [a.x + dx * s, a.y + dy * s];
  }
  function step(svg, id, a, b, both) {
    var p = edge(a, b), q = edge(b, a), at = { x1: p[0], y1: p[1], x2: q[0], y2: q[1], 'class': 'edge', 'marker-end': 'url(#' + P + id + 'g)' };
    if (both) at['marker-start'] = 'url(#' + P + id + 'r)';
    S('line', at, svg);
  }
  function probe(svg, id, x1, y1, x2, y2) { S('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'class': 'edge blue', 'marker-end': 'url(#' + P + id + 'b)' }, svg); }
  function over(svg, x1, y1, x2, y2) { S('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'class': 'proj' }, svg); }
  function kept(svg, x1, x2, y, pts, hollow) {
    S('line', { x1: x1, y1: y, x2: x2, y2: y, 'class': 'baseline' }, svg);
    pts.forEach(function (x) { S('circle', { cx: x, cy: y, r: 4, 'class': 'basept' + (hollow ? ' hollow' : '') }, svg); });
  }
  var s, a, b, c, d, e;

  // the usual notion: a number in, steps one way, a number out, and only the line kept
  s = start('z0');
  text(s, 12, 38, '3', 't-probe'); probe(s, 'z0', 20, 34, 44, 34);
  a = desc(s, 62, 34); b = desc(s, 110, 34); c = desc(s, 158, 34); step(s, 'z0', a, b); step(s, 'z0', b, c);
  probe(s, 'z0', 176, 34, 198, 34); text(s, 208, 38, '6', 't-probe');
  over(s, 110, 45, 110, 92); kept(s, 40, 180, 92, [110]);

  // cost: the same answer by a short run and a long one, read back with its length
  s = start('z1');
  a = desc(s, 28, 30); b = desc(s, 72, 30); step(s, 'z1', a, b); text(s, 50, 58, 'a, 1 step', 'lab blue');
  c = desc(s, 116, 30); d = desc(s, 160, 30); e = desc(s, 204, 30); step(s, 'z1', c, d); step(s, 'z1', d, e); text(s, 160, 58, 'a, 2 steps', 'lab blue');
  over(s, 50, 64, 50, 96); over(s, 160, 64, 160, 96); kept(s, 20, 200, 96, [50, 160]);

  // higher types: the probe hands over a program, and there is more than one line
  s = start('z2');
  S('rect', { x: 8, y: 20, width: 36, height: 28, rx: 4, 'class': 'zprobe' }, s); desc(s, 26, 34, 'g');
  probe(s, 'z2', 46, 34, 68, 34);
  a = desc(s, 86, 34); b = desc(s, 134, 34); step(s, 'z2', a, b);
  probe(s, 'z2', 152, 34, 176, 34); text(s, 188, 38, '6', 't-probe');
  kept(s, 40, 180, 72, [70, 110, 150]); kept(s, 40, 180, 90, [70, 150]); kept(s, 40, 180, 108, [90, 130]);

  // reading code: the probe looks inside the box, and one point becomes three
  s = start('z3');
  a = desc(s, 34, 34, 'I'); b = desc(s, 100, 34, 'S K K'); c = desc(s, 176, 34, 'S K S');
  S('circle', { cx: 100, cy: 34, r: 16, 'class': 'zlens' }, s); S('line', { x1: 112, y1: 46, x2: 124, y2: 58, 'class': 'zlens' }, s);
  over(s, 34, 45, 34, 96); over(s, 100, 52, 100, 96); over(s, 176, 45, 176, 96); kept(s, 16, 204, 96, [34, 100, 176]);

  // watching a run: two processes with the same traces, and a probe that stops in the middle
  s = start('z4');
  (function () {
    function arr(p, q) {
      var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
      S('line', { x1: p[0] + ux * 6, y1: p[1] + uy * 6, x2: q[0] - ux * 7, y2: q[1] - uy * 7, 'class': 'edge', 'marker-end': 'url(#' + P + 'z4g)' }, s);
    }
    var r = [56, 12], m = [56, 40], l = [38, 68], q = [74, 68], r2 = [160, 12], m1 = [142, 40], m2 = [178, 40], e1 = [142, 68], e2 = [178, 68];
    arr(r, m); arr(m, l); arr(m, q); arr(r2, m1); arr(r2, m2); arr(m1, e1); arr(m2, e2);
    [r, m, l, q, r2, m1, m2, e1, e2].forEach(function (p) { S('circle', { cx: p[0], cy: p[1], r: 3.5, 'class': 'state' }, s); });
    [m, m1, m2].forEach(function (p) { S('circle', { cx: p[0], cy: p[1], r: 9, 'class': 'zlens' }, s); });
    over(s, 56, 76, 56, 100); over(s, 160, 76, 160, 100); kept(s, 30, 190, 100, [56, 160]);
  })();

  // proofs as answers: two proofs of one equality, and a step between them
  s = start('z5');
  a = desc(s, 54, 48, 't'); b = desc(s, 166, 48, 'u');
  S('path', { d: 'M 66 42 Q 110 4 154 42', 'class': 'zproof' }, s); S('path', { d: 'M 66 54 Q 110 92 154 54', 'class': 'zproof' }, s);
  text(s, 110, 16, 'p', 't-probe'); text(s, 110, 88, 'q', 't-probe');
  S('line', { x1: 110, y1: 30, x2: 110, y2: 65, 'class': 'edge', 'marker-end': 'url(#' + P + 'z5g)' }, s);
  kept(s, 40, 180, 108, [110]);

  // steps both ways: words joined by a relation, with no normal form among them
  s = start('z6');
  a = desc(s, 44, 38, 'aab'); b = desc(s, 110, 38, 'aba'); c = desc(s, 176, 38, 'baa'); step(s, 'z6', a, b, true); step(s, 'z6', b, c, true);
  over(s, 44, 49, 110, 94); over(s, 110, 49, 110, 94); over(s, 176, 49, 110, 94); kept(s, 40, 180, 94, [110]);

  // keeping the fibre: the loop itself is kept, and evidence changes round it
  s = start('z7');
  S('rect', { x: 36, y: 4, width: 148, height: 84, rx: 14, 'class': 'zkept' }, s);
  a = desc(s, 110, 20, 'ω ω'); b = desc(s, 152, 66); c = desc(s, 68, 66); step(s, 'z7', a, b); step(s, 'z7', b, c); step(s, 'z7', c, a);
  text(s, 150, 40, '+1', 't-probe', 'start');
  over(s, 110, 88, 110, 106); kept(s, 40, 180, 106, [110], true);
};

/* one probe, two calculi: a schematic */
FIGS['outside'] = function (root, F) {
  var P = F.P;
  var svg = F.$('svg-outside'), d = S('defs', {}, svg);
  marker(d, P + 'oa', 'ah-run', 5); marker(d, P + 'ob', 'ah-blue', 7);
  function tape(cx, y, cells, marks) {
    var w = 18, x = cx - cells * w / 2;
    for (var i = 0; i < cells; i++) {
      S('rect', { x: x + i * w, y: y - 10, width: w, height: 20, 'class': 'n-rect nf' }, svg);
      if (i < marks) text(svg, x + i * w + w / 2, y + 4.5, '1', 't-atom');
    }
  }
  function term(cx, y, str) {
    S('rect', { x: cx - 30, y: y - 11, width: 60, height: 22, rx: 3, 'class': 'n-rect nf' }, svg);
    text(svg, cx, y + 4.5, str, 't-atom');
  }
  function probe(x1, y1, x2, y2) { S('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'class': 'edge blue', 'marker-end': 'url(#' + P + 'ob)' }, svg); }
  text(svg, 210, 18, 'supply the number 3', 'lab blue');
  probe(168, 26, 128, 44); probe(252, 26, 292, 44);
  text(svg, 110, 62, 'a Turing machine', 'lab'); text(svg, 310, 62, 'a term of combinatory logic', 'lab');
  tape(110, 86, 5, 3); term(310, 86, 't n₃');
  S('line', { x1: 110, y1: 102, x2: 110, y2: 126, 'class': 'edge run', 'marker-end': 'url(#' + P + 'oa)' }, svg); text(svg, 120, 118, 'moves', 'lab green', 'start');
  S('line', { x1: 310, y1: 102, x2: 310, y2: 126, 'class': 'edge run', 'marker-end': 'url(#' + P + 'oa)' }, svg); text(svg, 320, 118, 'steps', 'lab green', 'start');
  tape(110, 142, 8, 6); term(310, 142, 'n₆');
  probe(128, 160, 168, 184); probe(292, 160, 252, 184);
  text(svg, 210, 202, 'read the number 6', 'lab blue');
};

/* two processes with the same traces */
FIGS['processes'] = function (root, F) {
  var svg = F.$('svg-proc'); marker(S('defs', {}, svg), F.P + 'pa', 'ah', 6);
  function arr(a, b, l) {
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
    S('line', { x1: a[0] + ux * 7, y1: a[1] + uy * 7, x2: b[0] - ux * 8, y2: b[1] - uy * 8, 'class': 'edge', 'marker-end': 'url(#' + F.P + 'pa)' }, svg);
    text(svg, (a[0] + b[0]) / 2 + (dx < 0 ? -11 : 11), (a[1] + b[1]) / 2 + 4, l);
  }
  var r = [100, 16], m = [100, 64], l = [70, 112], q = [130, 112];
  arr(r, m, 'a'); arr(m, l, 'b'); arr(m, q, 'c');
  var r2 = [300, 16], m1 = [270, 64], m2 = [330, 64], e1 = [270, 112], e2 = [330, 112];
  arr(r2, m1, 'a'); arr(r2, m2, 'a'); arr(m1, e1, 'b'); arr(m2, e2, 'c');
  [r, m, l, q, r2, m1, m2, e1, e2].forEach(function (p) { S('circle', { cx: p[0], cy: p[1], r: 4, 'class': 'state' }, svg); });
  text(svg, 100, 144, 'after a, both b and c are on offer', 'lab');
  text(svg, 300, 144, 'after a, only one of them is', 'lab');
};

/* words as paths: two commuting generators */
FIGS['exchange'] = function (root, F) {
  var $ = F.$;
  var svg = $('svg-grid'), n = 3, c = 62, x0 = 58, y0 = 238, START = 'aaabbb', w, taken, busy = null, refocus = null;
  var gs = S('g', {}, svg), gq = S('g', {}, svg), gd = S('g', {}, svg);
  for (var i = 0; i <= n; i++) {
    S('line', { x1: x0 + i * c, y1: y0, x2: x0 + i * c, y2: y0 - n * c, 'class': 'gridline' }, gs);
    S('line', { x1: x0, y1: y0 - i * c, x2: x0 + n * c, y2: y0 - i * c, 'class': 'gridline' }, gs);
  }
  function P(p) { return [x0 + p[0] * c, y0 - p[1] * c]; }
  function pathOfWord(word) {
    var x = 0, y = 0, out = [[0, 0]];
    word.split('').forEach(function (ch) { if (ch === 'a') x++; else y++; out.push([x, y]); });
    return out;
  }
  // the squares between a word and the first word, as "column,row"
  function squares(word) {
    var out = {}, y = 0, col = 0;
    word.split('').forEach(function (ch) {
      if (ch === 'b') { y++; return; }
      for (var j = 0; j < y; j++) out[col + ',' + j] = true;
      col++;
    });
    return out;
  }
  function square(key) {
    var q = key.split(',');
    return S('rect', { x: x0 + Number(q[0]) * c, y: y0 - (Number(q[1]) + 1) * c, width: c, height: c, 'class': 'swept' }, gq);
  }
  function poly(px, cls) { return S('polyline', { points: px.map(function (p) { return p.join(','); }).join(' '), 'class': cls }, gd); }
  // mv, when given, is a step in progress: the corner slides across its square and the square fills or empties
  function draw(mv) {
    clear(gq); clear(gd);
    var sq = squares(w), area = Object.keys(sq).length;
    Object.keys(sq).forEach(function (key) { var r = square(key); if (mv && mv.key === key) r.style.opacity = mv.u; });
    if (mv && !mv.added) square(mv.key).style.opacity = 1 - mv.u;
    poly(pathOfWord(START).map(P), 'proj');
    var pts = pathOfWord(w).map(P);
    if (mv) { var to = pts[mv.k + 1]; pts[mv.k + 1] = [mv.from[0] + (to[0] - mv.from[0]) * mv.u, mv.from[1] + (to[1] - mv.from[1]) * mv.u]; }
    poly(pts, 'wordpath');
    w.split('').forEach(function (ch, k) {
      if (mv && (k === mv.k || k === mv.k + 1)) return;        // the two letters changing places are drawn below, in motion
      var q = labelAt(ch, pts[k], pts[k + 1]);
      text(gd, q[0], q[1], ch, 't-atom');
    });
    if (mv) mv.labels.forEach(function (l) { text(gd, l.from[0] + (l.to[0] - l.from[0]) * mv.u, l.from[1] + (l.to[1] - l.from[1]) * mv.u, l.ch, 't-atom'); });
    S('circle', { cx: x0, cy: y0, r: 4.5, 'class': 'basept' }, gd);
    var end = P([n, n]);
    S('circle', { cx: end[0], cy: end[1], r: 4.5, 'class': 'basept' }, gd);
    text(gd, end[0] + 10, end[1] - 8, 'a³b³', '', 'start');
    if (mv) { S('circle', { cx: pts[mv.k + 1][0], cy: pts[mv.k + 1][1], r: 8.5, 'class': 'corner moving' }, gd); return; }
    for (var k = 0; k < w.length - 1; k++) {
      if (w[k] === w[k + 1]) continue;
      (function (k) {
        var v = pts[k + 1];
        var g = S('g', { 'class': 'cornerg', role: 'button', tabindex: '0', 'data-k': k, 'aria-label': 'Exchange ' + w[k] + w[k + 1] + ' for ' + w[k + 1] + w[k] + ' at letter ' + (k + 1) }, gd);
        if (taken === 0) S('circle', { cx: v[0], cy: v[1], r: 9, 'class': 'cornerping' }, g);      // shows where to press, until the first step
        S('circle', { cx: v[0], cy: v[1], r: 8, 'class': 'corner' }, g);
        S('circle', { cx: v[0], cy: v[1], r: 21, 'class': 'cornerhit' }, g);                          // the target for a finger, on top
        g.addEventListener('click', function () { swap(k); });
        g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); refocus = k; swap(k); } });
      })(k);
    }
    if (refocus !== null) { var el = gd.querySelector('[data-k="' + refocus + '"]'); if (el) el.focus(); refocus = null; }
    $('gridab').disabled = w.indexOf('ab') < 0; $('gridba').disabled = w.indexOf('ba') < 0;
    $('gridread').innerHTML = 'The word is <code>' + w + '</code>. Its path ends where every path in this fibre ends, at <code>a³b³</code>. Steps taken: ' + taken + '. Squares between this word and the first: ' + area + '.' +
      (taken === 0 ? (F.still ? '' : ' Select a green corner, or press a button, to exchange two letters.')
        : taken > area ? ' The run so far is longer than it had to be. A run of ' + steps(area) + ' reaches this word.'
        : ' No run from the first word reaches this one in fewer steps.');
  }
  function labelAt(ch, a, b) { return ch === 'a' ? [(a[0] + b[0]) / 2, a[1] + 16] : [a[0] - 11, (a[1] + b[1]) / 2 + 4]; }
  // A step is always shown in motion, even where reduced motion has been asked for: the move is short and small,
  // the reader starts it, and seeing the corner cross its square is the point of the figure.
  function glide(ms, frame, done) {
    var t0 = null, live = true;
    function end() { if (!live) return; live = false; done(); }
    requestAnimationFrame(function tick(ts) {
      if (!live) return;
      if (t0 === null) t0 = ts;
      var u = Math.min(1, (ts - t0) / ms);
      if (u < 1) { frame(u); requestAnimationFrame(tick); } else end();
    });
    setTimeout(end, ms + 600);      // finishes the step even if no frames are being delivered
    return { stop: function () { live = false; } };
  }
  function swap(k) {
    if (busy) return;
    var oldPts = pathOfWord(w).map(P), was = squares(w), c1 = w[k], c2 = w[k + 1];
    w = w.slice(0, k) + c2 + c1 + w.slice(k + 2); taken++;
    var newPts = pathOfWord(w).map(P), now = squares(w), key = null, added = false;
    Object.keys(now).forEach(function (q) { if (!was[q]) { key = q; added = true; } });
    Object.keys(was).forEach(function (q) { if (!now[q]) { key = q; added = false; } });
    var labels = [
      { ch: c1, from: labelAt(c1, oldPts[k], oldPts[k + 1]), to: labelAt(c1, newPts[k + 1], newPts[k + 2]) },
      { ch: c2, from: labelAt(c2, oldPts[k + 1], oldPts[k + 2]), to: labelAt(c2, newPts[k], newPts[k + 1]) }
    ];
    $('gridab').disabled = true; $('gridba').disabled = true;
    busy = glide(650, function (u) { draw({ k: k, from: oldPts[k + 1], u: ease(u), key: key, added: added, labels: labels }); },
      function () { busy = null; draw(null); });
  }
  function reset() { if (busy) { busy.stop(); busy = null; } w = START; taken = 0; draw(null); }
  $('gridreset').addEventListener('click', reset);
  // the two directions of the one relation, each applied at the first place it fits
  $('gridab').addEventListener('click', function () { var k = w.indexOf('ab'); if (k >= 0) swap(k); });
  $('gridba').addEventListener('click', function () { var k = w.indexOf('ba'); if (k >= 0) swap(k); });
  reset();
};

/* what is kept of a fibre: two fibres at three levels, and with cost.
   In tree calculus: the fibre of K a (I b) with the I-step expanded, and the five-term loop of ω ω.
   For nets: the lattice of every net K a (I b) can reach, and the first five layers of the nets ω ω can reach. */
FIGS['fibres'] = function (root, F) {
  var $ = F.$, each = F.each;
  function panel(id, terms, pos, edges, o) {
    var svg = $(id); clear(svg); id = F.P + id; marker(S('defs', {}, svg), id + 'g', 'ah', 6);
    var N = terms.map(function (t, i) { return node(t, pos[i][0], pos[i][1]); });
    var gb = S('g', {}, svg), gf = S('g', {}, svg), gl = S('g', { 'class': 'fade' }, svg), gt = S('g', {}, svg), gx = S('g', { 'class': 'fade' }, svg), gk = S('g', {}, svg);
    // kept at every level: the line and the point
    o.over.forEach(function (i) { S('line', { x1: N[i].x, y1: N[i].y + 11, x2: o.pt, y2: 196, 'class': 'proj' }, gb); });
    S('line', { x1: 30, y1: 196, x2: 250, y2: 196, 'class': 'baseline' }, gb);
    var pt = S('circle', { cx: o.pt, cy: 196, r: 4.5, 'class': 'basept' + (o.hollow ? ' hollow' : '') }, gb);
    text(gb, o.pt, 214, o.name, o.hollow ? 'lab' : '');
    var cx = N.reduce(function (a, m) { return a + m.x; }, 0) / N.length, cy = N.reduce(function (a, m) { return a + m.y; }, 0) / N.length;
    var fill = S('polygon', { points: N.map(function (m) { return m.x + ',' + m.y; }).join(' '), 'class': 'hole' }, gf);
    var segs = edges.map(function (e) { return seg(N[e[0]], N[e[1]]); });
    var lines = segs.map(function (sg) { return line(gl, sg, null); });
    var costs = segs.map(function (sg, i) { return text(gl, (sg[0][0] + sg[1][0]) / 2 + o.off[i][0], (sg[0][1] + sg[1][1]) / 2 + o.off[i][1], '1', 'lab green fade'); });
    var rects = N.map(function (m) {
      var r = S('rect', { x: m.x - m.w / 2, y: m.y - 11, width: m.w, height: 22, rx: 3, 'class': 'n-rect' }, gx);
      S('text', { x: m.x, y: m.y + 4.5, 'text-anchor': 'middle', 'class': 't-atom' }, gx).textContent = m.s;
      return r;
    });
    var hole = S('circle', { cx: cx, cy: cy, r: 17, 'class': 'zhole fade' }, gk), holeLab = text(gk, cx, cy + 4, 'hole', 'lab fade');
    var trip = S('polygon', { 'class': 'roundtrip fade' }, gk);
    var tk = S('circle', { r: 5.5, 'class': 'token fade' }, gt), tk2 = S('circle', { r: 5, 'class': 'ring fade' }, gt);
    var nx = o.note ? o.note[0] : cx, ny = o.note ? o.note[1] : cy - 2, an = o.note ? 'start' : 'middle';
    var notes = [text(gk, nx, ny, '', 'lab halo', an), text(gk, nx, ny + 15, '', 'lab halo', an)];
    var routes = o.routes ? o.routes.map(function (r) { return r.map(function (e) { return segs[e]; }); }) : null;
    return { id: id, N: N, cx: cx, cy: cy, fill: fill, segs: segs, lines: lines, costs: costs, rects: rects, hole: hole, holeLab: holeLab, trip: trip, tk: tk, tk2: tk2, notes: notes, gl: gl, gx: gx, pt: pt,
      routes: routes, nfi: o.nfi, rcls: 'n-rect', unit: 'step', T: 1100, hasHole: !!o.hollow };
  }
  // a lattice of nets as dots, with the same parts as a panel of boxes
  function netPanel(id, lat, o) {
    var svg = $(id); clear(svg); id = F.P + id; marker(S('defs', {}, svg), id + 'g', 'ah', 5);
    var g = lat.g, D = Math.max(1, lat.depth), dx = Math.min(24, 200 / D), x0 = 140 - dx * lat.depth / 2;
    var sp = Math.min(16, 118 / Math.max(1, lat.widest - 1)), rad = sp < 9 ? 2.6 : 4;
    var P = g.states.map(function (s, i) { return { x: r1(x0 + s.depth * dx), y: r1(92 + lat.place[i] * sp), w: 2 * rad }; });
    var gb = S('g', {}, svg), gf = S('g', {}, svg), gl = S('g', { 'class': 'fade' }, svg), gt = S('g', {}, svg), gx = S('g', { 'class': 'fade' }, svg), gk = S('g', {}, svg);
    var last = o.last;
    S('line', { x1: o.hollow ? 140 : P[last].x, y1: o.hollow ? 160 : P[last].y + 6, x2: o.hollow ? 140 : P[last].x, y2: 196, 'class': 'proj' }, gb);
    S('line', { x1: 30, y1: 196, x2: 250, y2: 196, 'class': 'baseline' }, gb);
    var ptx = o.hollow ? 140 : P[last].x;
    var pt = S('circle', { cx: ptx, cy: 196, r: 4.5, 'class': 'basept' + (o.hollow ? ' hollow' : '') }, gb);
    text(gb, ptx, 214, o.name, o.hollow ? 'lab' : '');
    // the region the squares fill: the hull of the dots
    var hull = (function (pts) {
      pts = pts.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
      function cross(o2, a, b) { return (a.x - o2.x) * (b.y - o2.y) - (a.y - o2.y) * (b.x - o2.x); }
      var lo = [], hi = [];
      pts.forEach(function (p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
      pts.slice().reverse().forEach(function (p) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); });
      return lo.slice(0, -1).concat(hi.slice(0, -1));
    })(P);
    var N = hull.length >= 3 ? hull : P;
    var cx = N.reduce(function (a, m) { return a + m.x; }, 0) / N.length, cy = N.reduce(function (a, m) { return a + m.y; }, 0) / N.length;
    var fill = S('polygon', { points: N.map(function (m) { return m.x + ',' + m.y; }).join(' '), 'class': 'hole' }, gf);
    var eidx = {}, segs = g.edges.map(function (e, k) {
      eidx[e.from + '>' + e.to] = k;
      var a = P[e.from], b = P[e.to], ddx = b.x - a.x, ddy = b.y - a.y, len = Math.sqrt(ddx * ddx + ddy * ddy) || 1, s = (rad + 1) / len;
      return [[r1(a.x + ddx * s), r1(a.y + ddy * s)], [r1(b.x - ddx * s), r1(b.y - ddy * s)]];
    });
    var lines = segs.map(function (sg) { return line(gl, sg, null, 'thin'); });
    var rects = P.map(function (m, i) { return S('circle', { cx: m.x, cy: m.y, r: rad, 'class': 'n-dot' + (g.states[i].normal ? ' nf' : '') }, gx); });
    if (o.more) text(gx, x0 + dx * lat.depth + 16, 96, '…', 'lab', 'start');
    var hole = S('circle', { cx: cx, cy: cy, r: 17, 'class': 'zhole fade' }, gk), holeLab = text(gk, cx, cy + 4, 'hole', 'lab fade');
    var trip = S('polygon', { 'class': 'roundtrip fade' }, gk);
    var tk = S('circle', { r: 5.5, 'class': 'token fade' }, gt), tk2 = S('circle', { r: 5, 'class': 'ring fade' }, gt);
    var notes = [text(gk, o.note[0], o.note[1], '', 'lab halo', 'start'), text(gk, o.note[0], o.note[1] + 15, '', 'lab halo', 'start')];
    // routes: runs in two orders, as lists of segments through the lattice
    var routes = o.orders.map(function (ord) {
      var rp = GRAPH.runPath(NET, g.states[0].t, ord, { max: o.max || 400 });
      var ids = rp.keys.map(function (k) { return g.index[k]; }).filter(function (k) { return k !== undefined; });
      var out = [];
      for (var k = 0; k + 1 < ids.length; k++) { var e = eidx[ids[k] + '>' + ids[k + 1]]; if (e !== undefined) out.push(segs[e]); }
      return out;
    });
    return { id: id, N: N, cx: cx, cy: cy, fill: fill, segs: routes[0], lines: lines, costs: [], rects: rects, hole: hole, holeLab: holeLab, trip: trip, tk: tk, tk2: tk2, notes: notes, gl: gl, gx: gx, pt: pt,
      routes: routes, nfi: last, rcls: 'n-dot', unit: 'interaction', T: 330, hasHole: false };
  }
  var SAYS = {
    ski: [
      'Each fibre is counted as one piece. All that is kept is its point on the line: a value on the left, and on the right the hollow point that stands for no value.',
      'The arrowheads are forgotten and each fibre is a graph. On the left the two routes count as one run, so the triangle is filled, and a round trip can be shrunk to nothing. On the right nothing fills the cycle drawn, so in the graph drawn a round trip cannot be shrunk. In Lean, under the equations between runs used there, no run out of ω ω absorbs a lap. That the whole fibre has a hole is argued in the text only under an assumption, which is open.',
      'The arrowheads are kept. On the left every run ends at the normal form a. On the right the run goes round for ever and ends nowhere.',
      'Each step has length one. On the left one route to a has length 1 and the other has length 2. On the right the count goes on rising, and no route reaches a value at any length.'
    ],
    tree: [
      'Each fibre is counted as one piece. All that is kept is its point on the line: a value on the left, and on the right the hollow point, for no value reached in the terms drawn.',
      'The arrowheads are forgotten and each fibre is a graph. On the left the three routes count as one run, so the shape is filled, and a round trip can be shrunk to nothing. On the right the cycle of five terms is drawn with nothing filling it, so in the graph drawn a round trip cannot be shrunk. Whether the whole fibre, with the steps that leave the cycle, has a hole is not settled for trees.',
      'The arrowheads are kept. On the left every run ends at the normal form a. On the right the run goes round for ever and ends nowhere.',
      'Each step has length one. On the left the routes to a have lengths 1, 2 and 3. On the right the count rises with each lap, and no route in the drawing reaches a value.'
    ],
    net: [
      'Each fibre is counted as one piece. All that is kept is its point on the line: the value a on the left, and on the right a hollow point, for no value reached in the layers drawn.',
      'The arrowheads are forgotten and each fibre is a graph. On the left the lattice is made of squares. Counting the two orders round a square as one run fills it, and the round trip shown shrinks to nothing. On the right the first layers of ω ω contain squares too, each a round trip that swapping two interactions fills. Whether the whole fibre of ω ω has a hole is not settled here.',
      'The arrowheads are kept. On the left every run ends at the same net, which reads a. On the right the run shown has not ended by the last layer drawn. In the outermost run checked with the essay’s reducer no net repeats in the first thousand interactions, which is as far as the check went.',
      'Each interaction has length one. On the left every run to the irreducible net has the same length, ten interactions in the graph the browser computes, whatever the order, though in the outermost order the result port reads a after three. On the right the count is still rising at the last layer drawn.'
    ]
  };
  var A, W, mode = null;
  function buildPanels() {
    mode = calc;
    if (mode === 'ski') {
      var W0 = parse('S I I (S I I)'), W1 = contractAt(W0, redexInner(W0)), W2 = contractAt(W1, redexInner(W1));
      A = panel('fib-a', ['K a (I b)', 'K a b', 'a'].map(parse), [[120, 30], [206, 92], [64, 150]], [[0, 2], [0, 1], [1, 2]],
        { over: [2], pt: 64, hollow: false, name: 'a', off: [[-10, 0], [10, -4], [6, 15]], note: [86, 170], routes: [[0], [1, 2]], nfi: 2 });
      W = panel('fib-w', [W0, W1, W2], [[140, 30], [214, 130], [58, 130]], [[0, 1], [1, 2], [2, 0]],
        { over: [1, 2], pt: 140, hollow: true, name: 'no value', off: [[12, -2], [0, 15], [-12, -2]], note: null });
    } else if (mode === 'tree') {
      A = panel('fib-a', ['K a (I b)', 'K a (K b (△b))', 'K a b', 'a'], [[120, 30], [205, 80], [200, 140], [64, 150]], [[0, 3], [0, 1], [1, 2], [1, 3], [2, 3]],
        { over: [3], pt: 64, hollow: false, name: 'a', off: [[-10, 0], [12, -6], [12, 0], [0, -7], [0, 15]], note: [86, 170], routes: [[0], [1, 2, 4]], nfi: 3 });
      var ring = BUNDLE.tree.NODES.filter(function (n) { return n.cyc; }).map(function (n) { return n.s; });
      var rp = ring.map(function (s, k) { var a = -Math.PI / 2 + 2 * Math.PI * k / ring.length; return [r1(145 + 88 * Math.cos(a)), r1(100 + 65 * Math.sin(a))]; });
      var off = rp.map(function (p, k) {
        var q = rp[(k + 1) % rp.length], mx = (p[0] + q[0]) / 2 - 145, my = (p[1] + q[1]) / 2 - 100, l = Math.sqrt(mx * mx + my * my) || 1;
        return [r1(mx / l * 12), r1(my / l * 12 + 4)];
      });
      W = panel('fib-w', ring, rp, ring.map(function (s, k) { return [k, (k + 1) % ring.length]; }),
        { over: [2, 3], pt: 145, hollow: true, name: 'no value reached in the terms drawn', off: off, note: null });
    } else {
      var la = lattice(TREE.parse('K a (I b)'));
      var lastA = la.g.states.map(function (s, i) { return i; }).filter(function (i) { return la.g.states[i].normal; })[0];
      A = netPanel('fib-a', la, { last: lastA, name: 'a', hollow: false, note: [36, 172], orders: ['outer', 'inner'] });
      var lw = lattice(TREE.parse('ω ω'), 5);
      W = netPanel('fib-w', lw, { last: 0, name: 'no value reached', hollow: true, note: [24, 30], orders: ['outer'], max: 5, more: true });
      W.cx = 140; W.cy = 92;
    }
  }
  buildPanels();
  var level = 0, clock = 0, last = null, raf = null, visible = !hasIO(), touched = false, seq = [];
  // paused: the moving parts stand still, at a state that shows the view (REST, in ms) when a view is chosen
  var paused = RM || F.still, hop = null, REST = [0, 1080, 2040, 3600], pauseBtn = $('fpause');
  function along(sg, u) { u = Math.min(1, Math.max(0, u)); return [sg[0][0] + (sg[1][0] - sg[0][0]) * u, sg[0][1] + (sg[1][1] - sg[0][1]) * u]; }
  // along a route of steps, T ms to a step
  function alongSteps(r, tt, T) { var k = Math.min(Math.floor(tt / T), r.length - 1); return along(r[k], (tt - k * T) / T); }
  function tri(p, s) { p.trip.setAttribute('points', p.N.map(function (m) { return (p.cx + (m.x - p.cx) * s) + ',' + (p.cy + (m.y - p.cy) * s); }).join(' ')); }
  function note(p, i, s) { if (p.notes[i].textContent !== s) p.notes[i].textContent = s; }
  function count(p, n) { return mode === 'net' ? word(n) + (n === 1 ? ' interaction' : ' interactions') : n + (n === 1 ? ' step' : ' steps'); }
  function frame() {
    var t = clock, u, k;
    if (level === 1) {
      u = (t % 3600) / 3600;
      tri(A, u < 0.6 ? 0.76 * (1 - ease(u / 0.6)) : 0); op(A.trip, u < 0.58 ? 1 : 0);      // shrinks away: no hole
      if (W.hasHole) tri(W, 0.76 - 0.25 * Math.sin(Math.PI * Math.min(1, u / 0.8)));      // stopped by the hole, and returns
      else { tri(W, u < 0.6 ? 0.76 * (1 - ease(u / 0.6)) : 0); op(W.trip, u < 0.58 ? 1 : 0); }
    } else if (level === 2) {
      u = (t % 3400) / 3400;
      var r0 = A.routes ? A.routes[0] : [A.segs[0]], f = u / 0.42, kk = Math.min(Math.floor(f * r0.length), r0.length - 1);
      put(A.tk, along(r0[kk], f * r0.length - kk));
      A.rects[A.nfi].setAttribute('class', A.rcls + ' nf' + (u >= 0.42 ? ' cur' : ''));
      var nW = W.segs.length, P = 1300 * nW;
      u = ((t % P) / P) * nW; k = Math.floor(u) % nW;
      put(W.tk, along(W.segs[k], u - Math.floor(u)));
    } else if (level === 3) {
      var T = A.T, ra = A.routes[0], rb = A.routes[1], tt = t % (T * (mode === 'ski' ? 4.4 : rb.length + 2.4));
      put(A.tk, alongSteps(ra, tt, T));
      put(A.tk2, alongSteps(rb, tt, T));
      note(A, 0, tt >= ra.length * T ? (mode === 'net' ? cap(count(A, ra.length)) + ' in one order' : count(A, ra.length) + ' by one route') : '');
      note(A, 1, tt >= rb.length * T ? (mode === 'net' ? word(rb.length) + ' in another' : count(A, rb.length) + (mode === 'ski' ? ' by the other' : ' by the longest')) : '');
      var nw = W.segs.length, TW = W.T;
      tt = t % (TW * (mode === 'net' ? nw + 4 : 13)); k = Math.floor(tt / TW);
      if (mode === 'net') { put(W.tk, alongSteps(W.segs, tt, TW)); note(W, 0, Math.min(k, nw) + (Math.min(k, nw) === 1 ? ' interaction' : ' interactions') + (k >= nw ? ', and on' : '')); }
      else { put(W.tk, along(W.segs[k % nw], tt / TW - k)); note(W, 0, k + (k === 1 ? ' step' : ' steps')); }
      note(W, 1, mode === 'ski' ? 'and no value' : 'and no value reached');
    }
  }
  function setLevel(k) {
    level = k; clock = paused ? REST[k] : 0;
    [A, W].forEach(function (p) {
      op(p.gl, k === 0 ? 0.15 : 1); op(p.gx, k === 0 ? 0.15 : 1);
      p.lines.forEach(function (l) { if (k >= 2) l.setAttribute('marker-end', 'url(#' + p.id + 'g)'); else l.removeAttribute('marker-end'); });
      p.costs.forEach(function (c) { op(c, k === 3 ? 1 : 0); });
      op(p.trip, k === 1 ? 1 : 0); op(p.tk, k >= 2 ? 1 : 0); op(p.tk2, 0);
      p.notes.forEach(function (n) { n.textContent = ''; });
      p.pt.setAttribute('r', k === 0 ? 7 : 4.5);
      op(p.hole, 0); op(p.holeLab, 0);
    });
    A.fill.setAttribute('class', 'hole' + (k >= 1 ? ' on' : ''));
    if (mode === 'net') W.fill.setAttribute('class', 'hole' + (k >= 1 ? ' on' : ''));
    op(W.hole, k === 1 && W.hasHole ? 1 : 0); op(W.holeLab, k === 1 && W.hasHole ? 1 : 0);
    op(A.tk2, k === 3 ? 1 : 0);
    A.rects[A.nfi].setAttribute('class', A.rcls + (k >= 2 ? ' nf' : ''));
    if (k === 2) { note(A, 0, 'every run ends here'); note(W, 0, mode === 'net' ? 'still active at the last layer shown' : 'never ends'); }
    $('fread').textContent = SAYS[mode][k];
    each('[data-f]', function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-f')) === k)); });
    frame();
  }
  function halt() { seq.forEach(clearTimeout); seq = []; }
  function playAll() {
    halt(); setLevel(0);
    seq.push(setTimeout(function () { setLevel(1); }, 2800));
    seq.push(setTimeout(function () { setLevel(2); }, 9000));
    seq.push(setTimeout(function () { setLevel(3); }, 14500));
  }
  each('[data-f]', function (b) { b.addEventListener('click', function () { touched = true; halt(); setLevel(Number(b.getAttribute('data-f'))); }); });
  $('fplay').addEventListener('click', function () { touched = true; playAll(); });
  onCalc(function () { buildPanels(); setLevel(level); });
  setLevel(0);
  // the moving parts run only while the figure is on screen
  function tick(ts) {
    if (last !== null) clock += Math.min(100, ts - last);
    last = ts; frame();
    if (visible && !paused) raf = requestAnimationFrame(tick); else { raf = null; last = null; }
  }
  // under reduced motion the parts move only after Play, and then in plain jumps
  function go() {
    if (paused || !visible) return;
    if (RM) { if (hop === null) hop = setInterval(function () { if (visible && !paused) { clock += 550; frame(); } }, 550); }
    else if (raf === null) raf = requestAnimationFrame(tick);
  }
  pauseBtn.addEventListener('click', function () {
    touched = true; paused = !paused;
    if (paused) { if (raf !== null) { cancelAnimationFrame(raf); raf = null; last = null; } if (hop !== null) { clearInterval(hop); hop = null; } }
    pauseBtn.textContent = paused ? 'Play' : 'Pause'; go();
  });
  pauseBtn.textContent = paused ? 'Play' : 'Pause';
  var fig = root;
  if (hasIO() && !F.still) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; go(); }).observe(fig);
  }
  go();
  if (!RM && !F.still) onFirstView(fig, function () { if (!touched) playAll(); });
};

/* evidence carried along runs, in two fibres. In tree calculus (and for nets, which have no loop to
   go round) the loop has five terms, and the counter advances at the S-step that copies ω. */
FIGS['loop'] = function (root, F) {
  var $ = F.$, P = F.P;
  var kind = 'count', mode = null;
  var svg = $('svg-loop'), svgK = $('svg-kloop');
  var N, RULES, adds, labs, ev, tok, lapR, flips, d0;
  var C, X, kAdd, kS, arrA, arrB, tkA, tkB, direct, round;
  var n = 0, d = 0, anim = null, moved = false;
  var kstate = 'idle', kanim = null, ku = 0;
  function treeCycle() { return BUNDLE.tree.NODES.filter(function (m) { return m.cyc; }); }

  // left: the loop ω ω
  function buildLoop() {
    clear(svg); marker(S('defs', {}, svg), P + 'lp', 'ah', 7);
    var LP, low;
    if (mode === 'ski') {
      var T0 = parse('S I I (S I I)'), R0 = redexInner(T0), T1 = contractAt(T0, R0), R1 = redexInner(T1), T2 = contractAt(T1, R1), R2 = redexInner(T2);
      N = [node(T0, 165, 44), node(T1, 255, 140), node(T2, 75, 140)];
      RULES = [R0, R1, R2].map(ruleName); adds = RULES.map(function (r) { return r === 'S' ? 1 : 0; });   // S, I, I: computed
      LP = [[236, 82, 'start'], [165, 162, 'middle'], [94, 82, 'end']];
      low = [N[1], N[2]];
    } else {
      if (!BUNDLE.tree.ready) initBundle(BUNDLE.tree);
      var cyc = treeCycle(), m = cyc.length;
      N = cyc.map(function (c, k) { var a = -Math.PI / 2 + 2 * Math.PI * k / m; return node(c.s, r1(165 + 100 * Math.cos(a)), r1(108 + 62 * Math.sin(a))); });
      // the rules round the cycle; the counter advances at the S-step at the root, which copies ω
      RULES = cyc.map(function (c) { return c.cycR.rule === 'the S-rule' ? 'S' : 'K'; });
      adds = cyc.map(function (c) { return c.cycR.rule === 'the S-rule' && c.cycR.at === '' ? 1 : 0; });
      LP = N.map(function (p, k) {
        var q = N[(k + 1) % m], mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, ox = mx - 165, oy = my - 108, l = Math.sqrt(ox * ox + oy * oy) || 1;
        var x = r1(mx + ox / l * 16), y = r1(my + oy / l * 16 + 4);
        return [x, y, Math.abs(ox / l) < 0.35 ? 'middle' : ox > 0 ? 'start' : 'end'];
      });
      low = N.slice().sort(function (a, b) { return b.y - a.y; }).slice(0, 2);
    }
    var gb = S('g', {}, svg), ge = S('g', {}, svg), gt = S('g', {}, svg), gx = S('g', {}, svg);
    low.forEach(function (m) { S('line', { x1: m.x, y1: m.y + 11, x2: 165, y2: 206, 'class': 'proj' }, gb); });
    S('line', { x1: 85, y1: 206, x2: 245, y2: 206, 'class': 'baseline' }, gb);
    S('circle', { cx: 165, cy: 206, r: 4.5, 'class': 'basept hollow' }, gb);
    text(gb, 165, 226, BN.id === 'ski' ? 'no value' : 'no value reached in the terms drawn', 'lab');
    var segs = N.map(function (m, k) { return seg(N[k], N[(k + 1) % N.length]); });
    segs.forEach(function (sg) { line(ge, sg, P + 'lp'); });
    labs = LP.map(function (p) { return text(ge, p[0], p[1], '', 'lab green', p[2]); });
    text(ge, 165, 100, 'evidence', 'lab blue halo');
    ev = text(ge, 165, 126, '', 'ev halo');
    tok = S('circle', { r: 6, 'class': 'token' }, gt);
    N.forEach(function (m) { box(gx, m); });
    // the marker rests just clear of ω ω, on the first arrow
    var s0 = segs[0];
    d0 = Math.sqrt(Math.pow(s0[1][0] - s0[0][0], 2) + Math.pow(s0[1][1] - s0[0][1], 2));
    var rest = [s0[0][0] + (s0[1][0] - s0[0][0]) * 7 / d0, s0[0][1] + (s0[1][1] - s0[0][1]) * 7 / d0];
    lapR = route([rest, s0[1]].concat(segs.slice(1).reduce(function (a, sg) { return a.concat([sg[0], sg[1]]); }, []), [rest]));
    // the counter changes halfway along each S-step
    flips = [];
    segs.forEach(function (sg, k) { if (adds[k]) flips.push(k === 0 ? (d0 - 7) / 2 : (lapR.len[2 * k] + lapR.len[2 * k + 1]) / 2); });
  }
  function crossed(dist) { return flips.filter(function (f) { return f <= dist; }).length; }
  function lapSay() {
    $('loopread').textContent = anim ? 'On the way round.'
      : !moved ? (kind === 'count' ? 'The evidence starts at 0.' + (F.still ? '' : ' Carry it round the loop in either direction.')
        : 'The evidence is a yes: the term satisfies some predicate that no step changes.' + (F.still ? '' : ' Carry it round the loop.'))
      : kind === 'count' ? 'The term is ω ω again and the evidence is ' + String(n).replace('-', '−') + '. The text of the term has not changed, and the evidence has.'
      : 'A yes is carried across each step as a yes, and it comes back as it left. A predicate has nothing in it that could change.';
  }
  function lapDraw() {
    put(tok, lapR.at(d));
    var txt = kind === 'count' ? String(n + crossed(d)).replace('-', '−') : 'yes';
    if (txt !== ev.textContent) { var first = ev.textContent === ''; ev.textContent = txt; if (!first) kick(ev, 'pop'); }   // the number jumps as it changes
    labs.forEach(function (l, k) { l.textContent = RULES[k] + '-rule' + (adds[k] && kind === 'count' ? ', +1' : ''); });
    lapSay();
  }
  function lap(dir) {
    if (anim || kanim) return;
    moved = true;
    var total = crossed(lapR.L);
    if (dir < 0) { n -= total; d = lapR.L; }
    anim = animate(mode === 'ski' ? 2800 : 4200, function (u) { d = dir > 0 ? u * lapR.L : (1 - u) * lapR.L; if (u < 1) lapDraw(); },
      function () { anim = null; if (dir > 0) n += total; d = 0; lapDraw(); kick(tok, 'arrive'); }, 6);
    lapDraw();
  }
  $('lapfwd').addEventListener('click', function () { lap(1); });
  $('lapback').addEventListener('click', function () { lap(-1); });

  // right: the fibre of K a (ω ω)
  function buildK() {
    clear(svgK); marker(S('defs', {}, svgK), P + 'kp', 'ah', 7);
    var q1, kSat, kRat;
    if (mode === 'ski') {
      var K0 = parse('K a (S I I (S I I))'), KR0 = redexInner(K0), K1 = contractAt(K0, KR0), KR1 = redexInner(K1), K2 = contractAt(K1, KR1);
      C = [node(K0, 100, 30), node(K1, 100, 84), node(K2, 100, 138)]; X = node(parse('a'), 288, 84, true);
      kAdd = ruleName(KR0) === 'S' ? 1 : 0;
      q1 = [-8, 84]; kSat = [108, 62, 'start']; kRat = [222, 48];
    } else {
      C = treeCycle().map(function (c, k) { return node('K a (' + c.s + ')', 128, 22 + 33 * k); }); X = node('a', 296, 88, true);
      kAdd = 1;     // the first step of the lap is the S-step that copies ω
      q1 = [-10, 88]; kSat = [122, r1((C[0].y + C[1].y) / 2 + 4), 'end']; kRat = [226, 44];
    }
    var kb = S('g', {}, svgK), ke = S('g', {}, svgK), kt = S('g', {}, svgK), kx = S('g', {}, svgK);
    S('line', { x1: X.x, y1: X.y + 11, x2: X.x, y2: 206, 'class': 'proj' }, kb);
    S('line', { x1: X.x - 62, y1: 206, x2: X.x + 34, y2: 206, 'class': 'baseline' }, kb);
    S('circle', { cx: X.x, cy: 206, r: 4.5, 'class': 'basept' }, kb);
    text(kb, X.x, 226, 'a');
    var chain = [];
    for (var k = 0; k + 1 < C.length; k++) { chain.push(seg(C[k], C[k + 1])); line(ke, chain[k], P + 'kp'); }
    var lastC = C[C.length - 1];
    var q0 = [lastC.x - lastC.w / 2 - 3, lastC.y - 2], q2 = [C[0].x - C[0].w / 2 - 3, C[0].y + 3];
    S('path', { d: 'M ' + q0.join(' ') + ' Q ' + q1.join(' ') + ' ' + q2.join(' '), 'class': 'edge', 'marker-end': 'url(#' + P + 'kp)' }, ke);
    var back = [];
    for (var i = 0; i <= 14; i++) {
      var u = i / 14, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u;
      back.push([w0 * q0[0] + w1 * q1[0] + w2 * q2[0], w0 * q0[1] + w1 * q1[1] + w2 * q2[1]]);
    }
    var exits = C.map(function (m) { return seg(m, X); });
    exits.forEach(function (sg) { line(ke, sg, P + 'kp', 'thin'); });
    kS = text(ke, kSat[0], kSat[1], '', 'lab green halo', kSat[2]);
    text(ke, kRat[0], kRat[1], 'K-rule', 'lab green');
    arrA = text(ke, X.x, 42, '', 'lab blue halo'); arrB = text(ke, X.x, 60, '', 'lab blue halo');
    tkA = S('circle', { r: 6, 'class': 'token' }, kt); tkB = S('circle', { r: 5.5, 'class': 'ring' }, kt);
    C.forEach(function (m) { box(kx, m); }); box(kx, X);
    direct = route(exits[0]);
    round = route([].concat.apply([], chain).concat(back, [exits[0][0], exits[0][1]]));
  }
  function kSay() {
    $('kloopread').textContent = kstate === 'idle'
      ? 'Two runs lead from K a (ω ω) to a. One uses the K-rule at once. The other goes round the loop first.'
      : kstate === 'running' ? 'On the way.'
      : kind === 'count'
        ? 'The counter arrives as 0 by one route and as ' + kAdd + ' by the other. The two runs count as one run, since they differ only inside an argument that the K-rule throws away. The counter is not a behaviour on this fibre.'
        : 'A yes arrives as a yes by both routes. A predicate is untroubled by the loop here, as it was on the left.';
  }
  function say(el, txt) { if (txt !== el.textContent) { el.textContent = txt; if (txt) kick(el, 'pop'); } }
  function kDraw() {
    var tA = Math.min(1, ku / 0.26), dB = ku * round.L;
    put(tkA, direct.at(tA * direct.L)); put(tkB, round.at(dB));
    var show = kstate !== 'idle';
    op(tkA, show && tA < 1 ? 1 : 0); op(tkB, show && ku < 1 ? 1 : 0);
    var vA = kind === 'count' ? '0' : 'yes', vB = kind === 'count' ? String(kAdd) : 'yes';
    say(arrA, show && tA >= 1 ? 'at once: ' + vA : '');
    say(arrB, kstate === 'done' ? 'after a lap: ' + vB : '');
    var clash = kstate === 'done' && vA !== vB;
    arrA.classList.toggle('bad', clash); arrB.classList.toggle('bad', clash);
    kS.textContent = 'S-rule' + (kAdd && kind === 'count' ? ', +1' : '');
    kSay();
  }
  $('ksend').addEventListener('click', function () {
    if (kanim || anim) return;
    kstate = 'running'; ku = 0;
    kanim = animate(mode === 'ski' ? 3800 : 5200, function (u) { ku = u; if (u < 1) kDraw(); },
      function () { kanim = null; ku = 1; kstate = 'done'; kDraw(); }, 8);
    kDraw();
  });

  function reset() {
    if (anim) anim.stop(); if (kanim) kanim.stop();
    anim = null; kanim = null; n = 0; d = 0; moved = false; kstate = 'idle'; ku = 0;
    ev.textContent = '';
    lapDraw(); kDraw();
  }
  function build() {
    var m = calc === 'ski' ? 'ski' : 'tree';
    if (m === mode) return;
    if (anim) anim.stop(); if (kanim) kanim.stop();
    anim = null; kanim = null;
    mode = m; buildLoop(); buildK();
  }
  $('lapreset').addEventListener('click', reset);
  $('evid').addEventListener('change', function () { kind = this.value; reset(); });
  onCalc(function () { var was = mode; build(); if (mode !== was) reset(); });
  build();
  reset();
};


/* ---------- mounting ---------- */
var REF_ATTRS = ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant'];
// every id in the markup becomes `${prefix}${id}`, and so does every reference to one
function scopeIds(root, prefix) {
  Array.prototype.forEach.call(root.querySelectorAll('*'), function (el) {
    var id = el.getAttribute('id');
    if (id) el.setAttribute('id', prefix + id);
    REF_ATTRS.forEach(function (a) {
      var v = el.getAttribute(a);
      if (v) el.setAttribute(a, v.split(/\s+/).filter(Boolean).map(function (x) { return prefix + x; }).join(' '));
    });
    ['href', 'xlink:href'].forEach(function (a) {
      var v = el.getAttribute(a);
      if (v && v.charAt(0) === '#') el.setAttribute(a, '#' + prefix + v.slice(1));
    });
    Array.prototype.slice.call(el.attributes || []).forEach(function (at) {
      if (at.value.indexOf('url(#') >= 0) el.setAttribute(at.name, at.value.replace(/url\(#([^)]+)\)/g, function (m, x) { return 'url(#' + prefix + x + ')'; }));
    });
  });
}
function hostWidth(host) {
  var w = host.getBoundingClientRect ? host.getBoundingClientRect().width : 0;
  return w > 0 ? w : Infinity;       // not laid out (or no layout at all): the wide drawing, until the observer says otherwise
}
var MOTION = [], FONTS = false;
function followMotion(mq) {
  if (!mq) return;
  RM = !!mq.matches;
  if (MOTION.indexOf(mq) >= 0) return;
  MOTION.push(mq);
  var f = function (e) { RM = !!e.matches; };
  if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f);
}
// once the fonts are in, the labels with △ are measured again; if any width changes, the tree figures are redrawn
function followFonts() {
  if (FONTS || typeof document === 'undefined' || !document.fonts || !document.fonts.ready) return;
  FONTS = true;
  document.fonts.ready.then(function () {
    if (!measured) return;
    var old = WIDTHS;
    WIDTHS = {};
    if (!Object.keys(old).some(function (s) { return old[s] !== undefined && Math.abs(boxW(s) - old[s]) > 0.5; })) return;
    BUNDLE.tree.ready = false;
    if (calc !== 'ski') runHooks(calc);
  });
}

export const COMPONENTS = Object.keys(TEMPLATES);

/* Mount the figure `name` (a component of post/CONVERSION.md) into host, by the contract of SPEC.md:
   ctx = { id, attrs, params, on, reducedMotion }. Throws if something essential is missing, so that the page
   keeps the still. With attrs.still === '1' the default state is drawn once, synchronously: no autoplay, no
   animation, no observers. */
export function mountFigure(name, host, ctx) {
  ctx = ctx || {};
  var init = FIGS[name], tpl = TEMPLATES[name];
  if (!init || typeof tpl !== 'string') throw new Error('lsfig: no figure called ' + name);
  if (!host || typeof host.querySelector !== 'function') throw new Error('lsfig: no host element');
  var attrs = ctx.attrs || {}, params = ctx.params || {}, still = attrs.still === '1';
  if (typeof document === 'undefined' || typeof document.createElementNS !== 'function') throw new Error('lsfig: needs a document');
  if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') throw new Error('lsfig: needs CSS.escape');
  if (!still && typeof ResizeObserver !== 'function') throw new Error('lsfig: needs ResizeObserver');
  if (!still && typeof requestAnimationFrame !== 'function') throw new Error('lsfig: needs requestAnimationFrame');
  var id = String(ctx.id || 'lsfig-' + name), P = id + '-';
  followMotion(ctx.reducedMotion);

  host.classList.add('lsfig', 'lsfig-' + name);
  host.innerHTML = tpl;
  scopeIds(host, P);
  Array.prototype.forEach.call(host.querySelectorAll('svg[viewBox]'), function (svg) { setVB(svg, svg.getAttribute('viewBox')); });
  if (!RULER_HOST || !RULER_HOST.isConnected) RULER_HOST = host;
  if (!still) followFonts();

  var width = hostWidth(host), widthHooks = [];
  var F = {
    id: id, P: P, host: host, still: still,
    $: function (k) { return host.querySelector('#' + CSS.escape(P + k)); },
    each: function (sel, f) { Array.prototype.forEach.call(host.querySelectorAll(sel), f); },
    width: function () { return width; },
    onWidth: function (f) { widthHooks.push(f); }
  };
  var hooks = CALC_HOOKS.length;
  HOSTS.push(host);
  try {
    setCalc(params.calc || 'ski');
    host.dataset.calc = calc;
    init(host, F);
    bindAria(F);
  } catch (e) {
    // a figure that cannot be drawn leaves no trace: its hooks go, and the page keeps the still
    CALC_HOOKS.splice(hooks);
    HOSTS.splice(HOSTS.indexOf(host), 1);
    host.innerHTML = '';
    throw e;
  }
  if (typeof ctx.on === 'function') ctx.on('calc', setCalc);
  if (!still) {
    new ResizeObserver(function (entries) {
      var w = entries[entries.length - 1].contentRect.width;
      if (!(w > 0) || w === width) return;
      width = w;
      widthHooks.forEach(function (f) { f(w); });
    }).observe(host);
  }
}
