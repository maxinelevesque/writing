/* A small stub DOM for the figure tests, adapted from post/lab/stubdom.js: an HTML parser, the
   selectors and element methods the figures use, and a fake clock for timers and animation frames.

     const env = createEnv({ textLength });   // textLength(s): stands in for getComputedTextLength
     const restore = env.install();           // document, timers, frames, CSS, ResizeObserver, IntersectionObserver
     env.advance(ms); env.click(el); env.change(el, value); env.key(el, key);
     env.resize(host, width);                 // tell the ResizeObserver of host its new width
     env.showAll();                           // every IntersectionObserver sees its target on screen
     restore();

   Never bundled: only the tests import it. */
var VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, track: 1, wbr: 1 };
var RAW = { script: 1, style: 1 };
var CLOSES_P = { address: 1, article: 1, aside: 1, div: 1, figure: 1, footer: 1, header: 1, h1: 1, h2: 1, h3: 1, h4: 1, ol: 1, ul: 1, p: 1, pre: 1, section: 1, table: 1 };
var SVG_NS = 'http://www.w3.org/2000/svg';
var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (m, e) {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e] !== undefined ? ENT[e] : m;
  });
}
function escText(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

function makeDocument(env) {
  function Node() {}
  Node.prototype.parentNode = null;
  Object.defineProperty(Node.prototype, 'firstChild', { get: function () { return this.childNodes[0] || null; } });
  Object.defineProperty(Node.prototype, 'lastChild', { get: function () { return this.childNodes[this.childNodes.length - 1] || null; } });

  function Text(s) { this.nodeType = 3; this.data = s; this.childNodes = []; }
  Text.prototype = Object.create(Node.prototype);
  Object.defineProperty(Text.prototype, 'textContent', { get: function () { return this.data; }, set: function (v) { this.data = String(v); } });

  function Element(tag, ns) {
    this.nodeType = 1;
    this.namespaceURI = ns || null;
    this.localName = tag;
    this.tagName = ns === SVG_NS ? tag : tag.toUpperCase();
    this.childNodes = [];
    this._attrs = [];        // [name, value] in the order they were set
    this._listeners = {};
    this._props = {};
    this.style = {};
    var self = this;
    this.classList = {
      _get: function () { var c = self.getAttribute('class'); return c ? c.split(/\s+/).filter(Boolean) : []; },
      contains: function (c) { return this._get().indexOf(c) >= 0; },
      add: function () { var l = this._get(); for (var i = 0; i < arguments.length; i++) if (l.indexOf(arguments[i]) < 0) l.push(arguments[i]); self.setAttribute('class', l.join(' ')); },
      remove: function () { var a = Array.prototype.slice.call(arguments), l = this._get().filter(function (c) { return a.indexOf(c) < 0; }); if (self.hasAttribute('class')) self.setAttribute('class', l.join(' ')); },
      toggle: function (c, on) { if (on === undefined) on = !this.contains(c); if (on) this.add(c); else this.remove(c); return on; }
    };
  }
  Element.prototype = Object.create(Node.prototype);
  var E = Element.prototype;
  E.getAttribute = function (n) { for (var i = 0; i < this._attrs.length; i++) if (this._attrs[i][0] === n) return this._attrs[i][1]; return null; };
  E.hasAttribute = function (n) { return this.getAttribute(n) !== null; };
  E.setAttribute = function (n, v) {
    v = String(v);
    for (var i = 0; i < this._attrs.length; i++) if (this._attrs[i][0] === n) { this._attrs[i][1] = v; return; }
    this._attrs.push([n, v]);
  };
  E.removeAttribute = function (n) { this._attrs = this._attrs.filter(function (a) { return a[0] !== n; }); };
  Object.defineProperty(E, 'id', { get: function () { return this.getAttribute('id') || ''; }, set: function (v) { this.setAttribute('id', v); } });
  Object.defineProperty(E, 'className', { get: function () { return this.getAttribute('class') || ''; }, set: function (v) { this.setAttribute('class', v); } });
  Object.defineProperty(E, 'children', { get: function () { return this.childNodes.filter(function (c) { return c.nodeType === 1; }); } });
  function sib(el, d) {
    if (!el.parentNode) return null;
    var k = el.parentNode.childNodes, i = k.indexOf(el) + d;
    while (i >= 0 && i < k.length && k[i].nodeType !== 1) i += d;
    return k[i] || null;
  }
  Object.defineProperty(E, 'previousElementSibling', { get: function () { return sib(this, -1); } });
  Object.defineProperty(E, 'nextElementSibling', { get: function () { return sib(this, 1); } });
  E.appendChild = function (c) {
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this; this.childNodes.push(c); return c;
  };
  E.insertBefore = function (c, ref) {
    if (!ref) return this.appendChild(c);
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(ref), 0, c); return c;
  };
  E.removeChild = function (c) {
    var i = this.childNodes.indexOf(c);
    if (i < 0) throw new Error('removeChild: not a child');
    this.childNodes.splice(i, 1); c.parentNode = null; return c;
  };
  Object.defineProperty(E, 'textContent', {
    get: function () { return this.childNodes.map(function (c) { return c.textContent; }).join(''); },
    set: function (v) { this.childNodes.forEach(function (c) { c.parentNode = null; }); this.childNodes = []; if (String(v) !== '') this.appendChild(new Text(String(v))); }
  });
  Object.defineProperty(E, 'innerHTML', {
    get: function () { return this.childNodes.map(serialize).join(''); },
    set: function (v) {
      this.childNodes.forEach(function (c) { c.parentNode = null; }); this.childNodes = [];
      parseInto(this, String(v), this.namespaceURI);
    }
  });
  Object.defineProperty(E, 'outerHTML', { get: function () { return serialize(this); } });
  E.addEventListener = function (t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); };
  E.removeEventListener = function (t, f) { var l = this._listeners[t] || []; var i = l.indexOf(f); if (i >= 0) l.splice(i, 1); };
  E.dispatch = function (type, extra) {
    var ev = { type: type, target: this, defaultPrevented: false, preventDefault: function () { this.defaultPrevented = true; }, stopPropagation: function () { this._stop = true; } };
    for (var k in extra || {}) ev[k] = extra[k];
    for (var el = this; el && !ev._stop; el = el.parentNode) {
      ev.currentTarget = el;
      (el._listeners && el._listeners[type] || []).slice().forEach(function (f) { f.call(el, ev); });
      if (type === 'change' || type === 'input') { /* these bubble as well */ }
    }
    return ev;
  };
  // a host may be given a width (el._width), which getBoundingClientRect reports
  E.getBoundingClientRect = function () { var w = this._width || 0; return { top: 0, left: 0, right: w, bottom: 0, width: w, height: 0, x: 0, y: 0 }; };
  Object.defineProperty(E, 'isConnected', { get: function () { for (var el = this; el; el = el.parentNode) if (el === doc) return true; return false; } });
  Object.defineProperty(E, 'attributes', { get: function () { return this._attrs.map(function (a) { return { name: a[0], value: a[1] }; }); } });
  Object.defineProperty(E, 'dataset', { get: function () {
    var self = this;
    function name(k) { return 'data-' + String(k).replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); }
    return new Proxy({}, {
      get: function (t, k) { var v = self.getAttribute(name(k)); return v === null ? undefined : v; },
      set: function (t, k, v) { self.setAttribute(name(k), v); return true; }
    });
  } });
  E.getTotalLength = function () { return 100; };
  E.focus = function () { doc.activeElement = this; };
  E.blur = function () { if (doc.activeElement === this) doc.activeElement = doc.body; };
  Object.defineProperty(E, 'offsetHeight', { get: function () { return 0; } });
  E.matches = function (sel) { return matches(this, sel); };
  E.closest = function (sel) { for (var el = this; el && el.nodeType === 1; el = el.parentNode) if (matches(el, sel)) return el; return null; };
  E.querySelectorAll = function (sel) { var out = []; walk(this, function (el) { if (matches(el, sel)) out.push(el); }); return out; };
  E.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };
  // form controls: properties that reflect attributes, as in a browser
  function boolProp(name) {
    Object.defineProperty(E, name, {
      get: function () { return this.hasAttribute(name); },
      set: function (v) { if (v) this.setAttribute(name, ''); else this.removeAttribute(name); }
    });
  }
  boolProp('disabled'); boolProp('hidden');
  ['max', 'min', 'name', 'type'].forEach(function (name) {
    Object.defineProperty(E, name, { get: function () { var v = this.getAttribute(name); return v === null ? '' : v; }, set: function (v) { this.setAttribute(name, v); } });
  });
  Object.defineProperty(E, 'checked', {
    get: function () { return this._props.checked !== undefined ? this._props.checked : this.hasAttribute('checked'); },
    set: function (v) {
      v = !!v; this._props.checked = v;
      // a radio button unchecks the others of its group
      if (v && this.getAttribute('type') === 'radio' && this.getAttribute('name')) {
        var me = this, nm = this.getAttribute('name');
        doc.querySelectorAll('input[type="radio"]').forEach(function (r) { if (r !== me && r.getAttribute('name') === nm) r._props.checked = false; });
      }
    }
  });
  Object.defineProperty(E, 'value', {
    get: function () {
      if (this.localName === 'select') {
        var os = this.querySelectorAll('option'), s = os.filter(function (o) { return o._props.selected; })[0] || os[0];
        return s ? s.value : '';
      }
      if (this._props.value !== undefined) return this._props.value;
      var v = this.getAttribute('value');
      if (v === null && this.localName === 'option') return this.textContent;
      return v === null ? (this.getAttribute('type') === 'checkbox' || this.getAttribute('type') === 'radio' ? 'on' : '') : v;
    },
    set: function (v) {
      v = String(v);
      if (this.localName === 'select') { this.querySelectorAll('option').forEach(function (o) { o._props.selected = o.value === v; }); return; }
      if (this.localName === 'option') { this.setAttribute('value', v); return; }
      this._props.value = v;
    }
  });
  Object.defineProperty(E, 'options', { get: function () { return this.querySelectorAll('option'); } });

  function serialize(n) {
    if (n.nodeType === 3) return n.parentNode && RAW[n.parentNode.localName] ? n.data : escText(n.data);
    var s = '<' + n.localName;
    n._attrs.forEach(function (a) { s += ' ' + a[0] + '="' + escAttr(a[1]) + '"'; });
    var st = Object.keys(n.style).filter(function (k) { return n.style[k] !== '' && n.style[k] !== undefined; }).sort();
    if (st.length) s += ' style="' + escAttr(st.map(function (k) { return k + ': ' + n.style[k]; }).join('; ')) + '"';
    // the state of a form control, where it differs from what its attributes say
    if (n._props.checked !== undefined && n._props.checked !== n.hasAttribute('checked')) s += ' data-stub-checked="' + n._props.checked + '"';
    if (n._props.value !== undefined && n._props.value !== n.getAttribute('value')) s += ' data-stub-value="' + escAttr(n._props.value) + '"';
    if (n.localName === 'option' && n.parentNode && n.parentNode.localName === 'select' && n.parentNode.value === n.value && n.parentNode.querySelectorAll('option').indexOf(n) > 0) s += ' data-stub-selected="true"';
    s += '>';
    if (VOID[n.localName] && !n.childNodes.length) return s;
    return s + n.childNodes.map(serialize).join('') + '</' + n.localName + '>';
  }
  function walk(root, f) { root.childNodes.forEach(function (c) { if (c.nodeType === 1) { f(c); walk(c, f); } }); }

  /* ---------- selectors: compound selectors joined by ' ' and '>', in comma lists ---------- */
  var cache = {};
  function compile(sel) {
    if (cache[sel]) return cache[sel];
    var groups = splitTop(sel, ',').map(function (g) {
      var parts = [], toks = g.trim().replace(/\s*>\s*/g, ' > ').split(/\s+(?![^\[]*\])/);
      var comb = ' ';
      toks.forEach(function (t) { if (t === '>') comb = '>'; else { parts.push({ comb: comb, c: compound(t) }); comb = ' '; } });
      return parts;
    });
    cache[sel] = groups;
    return groups;
  }
  function splitTop(s, ch) {
    var out = [], depth = 0, cur = '', q = null;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { if (c === q) q = null; cur += c; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '[' || c === '(') depth++;
      if (c === ']' || c === ')') depth--;
      if (c === ch && !depth) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out;
  }
  function compound(t) {
    var re = /^(\*|[a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([~|^$*]?=)("[^"]*"|'[^']*'|[^\]]*))?\]|:([\w-]+)/g, m, c = { tag: null, ids: [], cls: [], attrs: [], pseudo: [] };
    var consumed = 0;
    while ((m = re.exec(t))) {
      if (m.index !== consumed) throw new Error('selector not supported: ' + t);
      consumed = re.lastIndex;
      if (m[1]) c.tag = m[1] === '*' ? null : m[1].toLowerCase();
      else if (m[2]) c.ids.push(m[2]);
      else if (m[3]) c.cls.push(m[3]);
      else if (m[4]) c.attrs.push({ n: m[4], op: m[5], v: m[6] === undefined ? undefined : m[6].replace(/^["']|["']$/g, '') });
      else if (m[7]) c.pseudo.push(m[7]);
    }
    if (consumed !== t.length) throw new Error('selector not supported: ' + t);
    return c;
  }
  function matchCompound(el, c) {
    if (el.nodeType !== 1) return false;
    if (c.tag && el.localName.toLowerCase() !== c.tag) return false;
    for (var i = 0; i < c.ids.length; i++) if (el.getAttribute('id') !== c.ids[i]) return false;
    var cl = c.cls.length ? el.classList._get() : null;
    for (i = 0; i < c.cls.length; i++) if (cl.indexOf(c.cls[i]) < 0) return false;
    for (i = 0; i < c.attrs.length; i++) {
      var a = c.attrs[i], v = el.getAttribute(a.n);
      if (v === null) return false;
      if (a.op === '=' && v !== a.v) return false;
      if (a.op === '~=' && v.split(/\s+/).indexOf(a.v) < 0) return false;
    }
    for (i = 0; i < c.pseudo.length; i++) {
      if (c.pseudo[i] === 'checked' && !el.checked) return false;
      if (c.pseudo[i] !== 'checked') throw new Error('pseudo-class not supported: ' + c.pseudo[i]);
    }
    return true;
  }
  function matchParts(el, parts, k) {
    if (!matchCompound(el, parts[k].c)) return false;
    if (k === 0) return true;
    if (parts[k].comb === '>') return !!el.parentNode && el.parentNode.nodeType === 1 && matchParts(el.parentNode, parts, k - 1);
    for (var p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (matchParts(p, parts, k - 1)) return true;
    return false;
  }
  function matches(el, sel) { return compile(sel).some(function (parts) { return matchParts(el, parts, parts.length - 1); }); }

  /* ---------- parsing ---------- */
  function parseInto(root, html, ns) {
    var stack = [root], i = 0, n = html.length;
    function top() { return stack[stack.length - 1]; }
    function text(s) { if (s) top().appendChild(new Text(decode(s))); }
    while (i < n) {
      var lt = html.indexOf('<', i);
      if (lt < 0) { text(html.slice(i)); break; }
      text(html.slice(i, lt));
      if (html.startsWith('<!--', lt)) { var ce = html.indexOf('-->', lt); i = ce < 0 ? n : ce + 3; continue; }
      if (html[lt + 1] === '!' || html[lt + 1] === '?') { i = html.indexOf('>', lt) + 1; continue; }
      if (html[lt + 1] === '/') {
        var ge = html.indexOf('>', lt), name = html.slice(lt + 2, ge).trim().toLowerCase();
        for (var s = stack.length - 1; s > 0; s--) if (stack[s].localName.toLowerCase() === name) { stack.length = s; break; }
        i = ge + 1; continue;
      }
      var m = /^<([a-zA-Z][\w:-]*)/.exec(html.slice(lt, lt + 64));
      if (!m) { text('<'); i = lt + 1; continue; }
      var tag = m[1], j = lt + m[0].length, attrs = [];
      // attributes
      for (;;) {
        while (/\s/.test(html[j])) j++;
        if (html[j] === '>' || html.startsWith('/>', j)) break;
        var am = /^([^\s=>\/]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/.exec(html.slice(j, j + 4000));
        if (!am) { j++; continue; }
        attrs.push([am[1], am[2] === undefined ? '' : decode(am[3] !== undefined ? am[3] : am[4] !== undefined ? am[4] : am[5])]);
        j += am[0].length;
      }
      var selfClose = html.startsWith('/>', j);
      i = j + (selfClose ? 2 : 1);
      var lower = tag.toLowerCase();
      var inSvg = lower === 'svg' || (top().namespaceURI === SVG_NS);
      if (!inSvg && CLOSES_P[lower] && top().localName === 'p') stack.pop();
      var el = new Element(inSvg ? tag : lower, inSvg ? SVG_NS : null);
      attrs.forEach(function (a) { el.setAttribute(inSvg ? a[0] : a[0].toLowerCase(), a[1]); });
      top().appendChild(el);
      if (RAW[lower]) {
        var end = html.toLowerCase().indexOf('</' + lower, i);
        if (end < 0) end = n;
        el.appendChild(new Text(html.slice(i, end)));
        i = html.indexOf('>', end) + 1 || n;
        continue;
      }
      if (!selfClose && !VOID[lower]) stack.push(el);
    }
  }

  var doc = new Element('#document');
  doc.nodeType = 9;
  doc.createElement = function (t) { return new Element(String(t).toLowerCase()); };
  doc.createElementNS = function (ns, t) { return new Element(t, ns); };
  doc.createTextNode = function (s) { return new Text(String(s)); };
  doc.createRange = function () { return { selectNodeContents: function () {}, getBoundingClientRect: E.getBoundingClientRect }; };
  doc.getElementById = function (id) { var r = null; walk(doc, function (el) { if (!r && el.getAttribute('id') === id) r = el; }); return r; };
  doc.parse = function (html) { parseInto(doc, html, null); };
  doc.Element = Element;
  doc.serialize = serialize;
  doc.walk = function (f) { walk(doc, f); };
  return doc;
}


export function createEnv(opts) {
  opts = opts || {};
  var env = { now: 0, timers: [], frames: [], seq: 0, observers: [], intersections: [] };
  var doc = makeDocument(env);
  if (opts.textLength) doc.Element.prototype.getComputedTextLength = function () { return opts.textLength(this.textContent); };
  doc.parse('<html><head></head><body></body></html>');
  doc.documentElement = doc.querySelector('html');
  doc.body = doc.querySelector('body');
  doc.head = doc.querySelector('head');
  doc.activeElement = doc.body;
  env.document = doc;
  env.setTimeout = function (f, ms) { var id = ++env.seq; env.timers.push({ id: id, at: env.now + Math.max(0, ms || 0), f: f, order: id }); return id; };
  env.clearTimeout = function (id) { env.timers = env.timers.filter(function (t) { return t.id !== id; }); };
  env.setInterval = function (f, ms) {
    var id = ++env.seq;
    function again() { var t = { id: id, at: env.now + ms, f: function () { again(); f(); }, order: ++env.seq }; env.timers.push(t); }
    again();
    return id;
  };
  env.clearInterval = env.clearTimeout;
  env.requestAnimationFrame = function (f) { var id = ++env.seq; env.frames.push({ id: id, f: f }); return id; };
  env.cancelAnimationFrame = function (id) { env.frames = env.frames.filter(function (t) { return t.id !== id; }); };
  function ResizeObserver(cb) { this.cb = cb; this.els = []; env.observers.push(this); }
  ResizeObserver.prototype.observe = function (el) { this.els.push(el); };
  ResizeObserver.prototype.disconnect = function () { this.els = []; };
  function IntersectionObserver(cb) { this.cb = cb; this.els = []; env.intersections.push(this); }
  IntersectionObserver.prototype.observe = function (el) { this.els.push(el); };
  IntersectionObserver.prototype.disconnect = function () { this.els = []; };
  env.resize = function (el, w) {
    el._width = w;
    env.observers.forEach(function (o) { if (o.els.indexOf(el) >= 0) o.cb([{ target: el, contentRect: { width: w, height: 0 } }], o); });
  };
  env.showAll = function () {
    env.intersections.forEach(function (o) { o.els.slice().forEach(function (el) { o.cb([{ target: el, isIntersecting: true, intersectionRatio: 1 }], o); }); });
  };
  env.install = function () {
    var g = globalThis, keys = ['document', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'CSS', 'ResizeObserver', 'IntersectionObserver'];
    var saved = keys.map(function (k) { return [k, Object.getOwnPropertyDescriptor(g, k)]; });
    var vals = {
      document: doc, setTimeout: env.setTimeout, clearTimeout: env.clearTimeout, setInterval: env.setInterval, clearInterval: env.clearInterval,
      requestAnimationFrame: env.requestAnimationFrame, cancelAnimationFrame: env.cancelAnimationFrame,
      CSS: { escape: function (s) { return String(s).replace(/[^\w-]/g, function (c) { return '\\' + c; }); } },
      ResizeObserver: opts.noResizeObserver ? undefined : ResizeObserver,
      IntersectionObserver: opts.noIntersectionObserver ? undefined : IntersectionObserver
    };
    keys.forEach(function (k) { Object.defineProperty(g, k, { value: vals[k], configurable: true, writable: true }); });
    return function restore() { saved.forEach(function (s) { if (s[1]) Object.defineProperty(g, s[0], s[1]); else delete g[s[0]]; }); };
  };
  // fake time: frames come every 16 ms while any is queued; timers fire at their time
  env.advance = function (ms) {
    var end = env.now + ms;
    for (var guard = 0; guard < 1e6; guard++) {
      var nextFrame = env.frames.length ? Math.floor(env.now / 16) * 16 + 16 : Infinity;
      var t0 = null;
      env.timers.forEach(function (t) { if (!t0 || t.at < t0.at || (t.at === t0.at && t.order < t0.order)) t0 = t; });
      var nextTimer = t0 ? t0.at : Infinity, next = Math.min(nextFrame, nextTimer);
      if (next > end) { env.now = end; return; }
      env.now = next;
      if (nextTimer <= nextFrame) {
        env.timers.splice(env.timers.indexOf(t0), 1);
        t0.f();
      } else {
        var fs = env.frames; env.frames = [];
        fs.forEach(function (fr) { fr.f(env.now); });
      }
    }
    throw new Error('advance: too many events');
  };
  env.click = function (el) {
    if (!el) throw new Error('click: no element');
    if (el.disabled) return;
    if (el.localName === 'input' && el.type === 'checkbox') { el.checked = !el.checked; el.dispatch('click'); el.dispatch('change'); return; }
    el.dispatch('click');
  };
  env.change = function (el, v) { if (v !== undefined) el.value = v; el.dispatch('input'); el.dispatch('change'); };
  env.key = function (el, k) { el.dispatch('keydown', { key: k }); };
  return env;
}
