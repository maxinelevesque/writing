// Minimal, dependency-free frontmatter reader for this repo's own format.
// We control how frontmatter is written (see scripts/normalize history and
// SCHEMA.md), so this deliberately supports only what we emit: a leading
// `---` block of `key: value` lines, values either double-quoted (with \" and
// \\ escapes) or bare scalars. It is not a general YAML parser.

export function parse(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: null, body: raw, raw };
  const data = {};
  const order = [];
  for (const line of m[1].split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (!kv) {
      throw new Error(`unparseable frontmatter line: ${JSON.stringify(line)}`);
    }
    const key = kv[1];
    data[key] = parseValue(kv[2]);
    order.push(key);
  }
  return { data, order, body: raw.slice(m[0].length), raw };
}

function parseValue(v) {
  v = v.trim();
  // inline flow-sequence, e.g. `tags: [a, "b c", d]`
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => unquote(s.trim())).filter((s) => s !== '');
  }
  return unquote(v);
}

function unquote(v) {
  v = v.trim();
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return v;
}
