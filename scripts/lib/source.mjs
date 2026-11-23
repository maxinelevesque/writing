// SOURCE: an exported piece's provenance (SCHEMA.md, "SOURCE"). One line,
// "<repository> <40-character commit>", naming the upstream commit the piece
// was exported from. Exported pieces change upstream and arrive here by
// re-export, which updates SOURCE; an edit made here would be overwritten by
// the next export, so `validate --against <ref>` rejects it.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const SOURCE_RE = /^[a-z0-9][a-z0-9._-]* [0-9a-f]{40}\r?\n?$/;

const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'buffer', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
const blobHash = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

// path (relative to the piece, '/'-separated) → git blob hash
function treeAt(root, ref, rel) {
  const out = new Map();
  const listing = git(root, 'ls-tree', '-r', '-z', ref, '--', `${rel}/`).toString('utf8');
  for (const entry of listing.split('\0')) {
    const m = /^\d+ blob ([0-9a-f]+)\t(.*)$/s.exec(entry);
    if (m) out.set(m[2].slice(rel.length + 1), m[1]);
  }
  return out;
}

function treeNow(dir) {
  const out = new Map();
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      const a = join(abs, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(a).isDirectory()) walk(a, r);
      else out.set(r, blobHash(readFileSync(a)));
    }
  };
  walk(dir, '');
  return out;
}

// Setting date/updated at publication is bookkeeping done here, not an edit.
function withoutDates(text) {
  return text.replace(/^(---\r?\n[\s\S]*?\r?\n---)/, (fm) => fm.replace(/^(date|updated):.*\r?\n/gm, ''));
}

export function checkSourceAgainst(root, ref, units) {
  try { git(root, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`); }
  catch { return [{ label: 'validate', msg: `--against: ${ref} is not a commit here (fetch it, or use a full clone)` }]; }
  const problems = [];
  for (const unit of units) {
    let base = null;
    let baseRel = null;
    for (const rel of [`pieces/${unit.slug}`, `drafts/${unit.slug}`]) {
      const t = treeAt(root, ref, rel);
      if (t.size) { base = t; baseRel = rel; break; }
    }
    if (!base || !base.has('SOURCE')) continue; // new, or not an exported piece before
    const now = treeNow(unit.dir);
    if (!now.has('SOURCE')) {
      problems.push({ label: unit.label, msg: 'SOURCE was removed; an exported piece keeps its SOURCE' });
      continue;
    }
    if (now.get('SOURCE') !== base.get('SOURCE')) continue; // re-exported
    const changed = [];
    for (const path of new Set([...base.keys(), ...now.keys()])) {
      if (path === 'SOURCE' || base.get(path) === now.get(path)) continue;
      if (path === 'index.md' && base.has(path) && now.has(path)) {
        const before = git(root, 'show', `${ref}:${baseRel}/index.md`).toString('utf8');
        const after = readFileSync(join(unit.dir, 'index.md'), 'utf8');
        if (withoutDates(before) === withoutDates(after)) continue;
      }
      changed.push(path);
    }
    if (changed.length) {
      const list = changed.slice(0, 4).join(', ') + (changed.length > 4 ? `, and ${changed.length - 4} more` : '');
      problems.push({
        label: unit.label,
        msg: `changed (${list}) without updating SOURCE. This piece is exported from ${readFileSync(join(unit.dir, 'SOURCE'), 'utf8').split(' ')[0]}: make the change there and re-export, which updates SOURCE.`,
      });
    }
  }
  return problems;
}
