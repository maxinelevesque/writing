// Figures in the interactive essay format (SCHEMA.md, "Figures"). Each figure
// is three blocks in a piece's body:
//
//   <!-- figure #fig-reduction component="reduction" calc="tree" -->
//
//   ![Alt text that carries the figure's content.](assets/fig-reduction.svg)
//
//   **Figure 3. Reduction (tree calculus).** Caption …
//
// The marker grammar matches maxine.science's src/lib/essay-format.mjs, except
// that `layout` is the site's choice (its presentation.json), never the source's.

const NAME = /^[a-z][a-z0-9-]*$/;
const IMAGE = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)$/;

// `<!-- figure … -->` → { id, component, attrs }; null for any other text;
// throws on a figure comment it can't read.
export function parseFigureMarker(text) {
  const m = /^<!--\s*figure\b([\s\S]*?)-->\s*$/.exec(text.trim());
  if (!m) return null;
  const out = { id: null, component: null, attrs: {} };
  const rest = m[1].replace(/\s*(?:#([^\s"]+)|([^\s=]+)="([^"]*)")\s*/g, (_, id, key, value) => {
    if (id !== undefined) {
      if (out.id) throw new Error('figure marker has two ids');
      out.id = id;
    } else if (key === 'component') out.component = value;
    else if (key === 'layout') throw new Error('figure layout is set by the site (its presentation.json), not in the source');
    else {
      if (!NAME.test(key)) throw new Error(`figure marker attribute "${key}" must be lowercase letters, digits and hyphens`);
      if (key in out.attrs) throw new Error(`figure marker repeats "${key}"`);
      out.attrs[key] = value;
    }
    return '';
  });
  if (rest.trim()) throw new Error(`unreadable figure marker near "${rest.trim()}"`);
  if (!out.id || !NAME.test(out.id)) throw new Error('figure marker needs an id like #fig-name');
  if (!out.component || !NAME.test(out.component)) throw new Error('figure marker needs component="name"');
  return out;
}

// Split a Markdown body into blank-line-separated blocks, skipping fenced code
// (where a marker is an example, not a figure). Each block: { text, line }.
export function blocks(body) {
  const out = [];
  const lines = body.split(/\r?\n/);
  let cur = null;
  let fence = null;
  lines.forEach((line, i) => {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      cur = null;
      return;
    }
    if (f) { fence = f[1]; cur = null; return; }
    if (line.trim() === '') { cur = null; return; }
    if (!cur) { cur = { text: line, line: i + 1 }; out.push(cur); }
    else cur.text += '\n' + line;
  });
  return out;
}

// Every figure in a body, with what follows its marker. Problems are returned
// as messages; the caller decides how to report them.
export function figures(body) {
  const found = [];
  const problems = [];
  const bs = blocks(body);
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (!/^<!--\s*figure\b/.test(b.text.trim())) continue;
    let marker;
    try { marker = parseFigureMarker(b.text); }
    catch (e) { problems.push(`line ${b.line}: ${e.message}`); continue; }
    if (!marker) continue;
    const where = `figure #${marker.id} (line ${b.line})`;
    const img = bs[i + 1] && IMAGE.exec(bs[i + 1].text.trim());
    if (!img) { problems.push(`${where}: the marker must be followed by a still image on its own, ![alt](assets/…)`); continue; }
    const [, alt, src] = img;
    if (!alt.trim()) problems.push(`${where}: the still image needs alt text that carries the figure's content`);
    const caption = bs[i + 2]?.text.trim() ?? '';
    if (!caption || /^(!\[|\[\^[^\]]+\]:|<!--|#|>|[-*+] |\d+\. |\|)/.test(caption)) {
      problems.push(`${where}: the image must be followed by a caption paragraph`);
    }
    found.push({ ...marker, line: b.line, alt, src });
  }
  return { found, problems };
}

// Relative link and image targets in a body (outside fenced code):
// [{ target, image, line }]. URLs, site paths and #anchors are skipped.
export function relativeTargets(body) {
  const out = [];
  for (const b of blocks(body)) {
    for (const m of b.text.matchAll(/(!?)\[[^\]]*\]\(\s*<?([^)\s>]+)>?/g)) {
      const target = m[2];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/') || target.startsWith('#')) continue;
      const line = b.line + b.text.slice(0, m.index).split('\n').length - 1;
      out.push({ target: target.replace(/[?#].*$/, '').replace(/^\.\//, ''), image: m[1] === '!', line });
    }
  }
  return out;
}

// Report conventions beyond figures (STYLE.md): the page-switch marker, the
// abstract, and links. Returns { errors, warnings } as messages.
export function reportChecks(body, kind) {
  const errors = [];
  const warnings = [];
  const bs = blocks(body);
  const switches = bs.filter((b) => /^<!--\s*page-switch\s*-->$/.test(b.text.trim()));
  if (switches.length > 1) errors.push(`<!-- page-switch --> appears ${switches.length} times (lines ${switches.map((b) => b.line).join(', ')}); a piece introduces its switch once`);
  if (switches.length && kind !== 'report') errors.push('<!-- page-switch --> is only rendered for kind: report');
  for (const b of bs) {
    const t = b.text.trim();
    if (/^<!--/.test(t) && !/^<!--\s*(figure\b|page-switch\s*-->)/.test(t) && /^<!--\s*[a-z-]+\s*(#|[a-z-]+=|-->)/.test(t)) {
      warnings.push(`line ${b.line}: unknown marker ${t.split(/\s+/).slice(0, 2).join(' ')}; only "figure" and "page-switch" mean anything to the site`);
    }
  }
  if (kind !== 'report') return { errors, warnings };
  if (!bs.some((b) => /^>\s*\*\*Abstract[.:]?\*\*/i.test(b.text.trim()))) {
    errors.push('a research report needs an abstract: a blockquote starting "> **Abstract.**"');
  }
  for (const b of bs) {
    const prose = b.text.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, '](…)').replace(/<(?![a-z][a-z0-9+.-]*:)[^>]*>/gi, '');
    for (const m of prose.matchAll(/\b(?:https?:\/\/\S+|doi:\s*10\.\S+|\b10\.\d{4,9}\/\S+)/gi)) {
      warnings.push(`line ${b.line}: bare link or DOI "${m[0].slice(0, 40)}"; put the link on the title instead (STYLE.md, Citations)`);
    }
    for (const m of b.text.matchAll(/\[(?:lean|Lean|proof)\]\(([^)]*\.lean[^)]*)\)/g)) {
      warnings.push(`line ${b.line}: a proof link labelled "${m[0].slice(1, m[0].indexOf(']'))}"; link the proved statement itself (STYLE.md, Proofs)`);
    }
  }
  return { errors, warnings };
}
