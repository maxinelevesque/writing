// The atproto copy of a research report (SCHEMA.md "atproto copy of a report"). Readers that
// don't run the site (Standard Reader, docs.surf, pub-search) see this, so each figure becomes
// its PNG still with its caption, plus a link to the live figure on the site:
//
//   <!-- figure #fig-runs component="runs" calc="net" -->        (removed)
//   ![Alt.](assets/fig-runs.svg)        → ![Alt.](https://maxine.science/files/<slug>/assets/fig-runs.png)
//   **Figure 2. … (interaction nets).** Caption.
//                                       → … Caption. [Interactive version →](<canonical>?calc=net#fig-runs)
//
// Other relative links (assets/, the read-aloud file) become absolute URLs on the site, and the
// page-switch marker goes. Theorem and collapsible boxes become quotations with a bold lead. In
// textContent each figure reads
// "[Figure 2 (interaction nets): Four views of running. Caption… Alt text.]".
// Math becomes Unicode where it's simple (the brackets, arrows and letters of the report); a
// formula with anything else stays as TeX, and is reported as a warning for the author.
import { blocks, parseFigureMarker, IMAGE, LINK } from './figures.mjs';


const SYMBOLS = { llbracket: '⟦', rrbracket: '⟧', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
  mapsto: '↦', vdash: '⊢', in: '∈', notin: '∉', subseteq: '⊆', cup: '∪', cap: '∩', times: '×', circ: '∘',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', equiv: '≡', simeq: '≃', cong: '≅', approx: '≈',
  forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', emptyset: '∅', infty: '∞', cdot: '·', ldots: '…', dots: '…',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', tau: 'τ',
  phi: 'φ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ', Omega: 'Ω' };

/** Simple TeX → Unicode, or null when the formula needs real typesetting. */
export function texToUnicode(tex) {
  let out = tex.trim()
    .replace(/\\(?:mathrm|text|mathsf|operatorname)\{([^{}]*)\}/g, '$1')
    .replace(/\\([A-Za-z]+)/g, (all, name) => (name in SYMBOLS ? SYMBOLS[name] : all))
    .replace(/\\[,;: ]/g, ' ');
  if (/[\\^_{}]/.test(out)) return null;
  return out.replace(/\s+/g, ' ').replace(/⟦\s+/g, '⟦').replace(/\s+⟧/g, '⟧');
}

/** Markdown → plain text, as publish-atproto's textContent. */
export function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^\s{0,3}\[\^[^\]]+\]:\s?/gm, '')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}([-*_])\s*\1\s*\1[\s\S]*?$/gm, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/([*_])([^*_]+)\1/g, '$2')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * slug, body (the Markdown after the front matter), canonical (the piece's URL),
 * hasFile(rel): whether pieces/<slug>/<rel> exists (to prefer a figure's PNG still).
 * → { markdown, textContent, warnings }
 */
export function projectReport({ slug, body, canonical, hasFile = () => false }) {
  const site = new URL(canonical).origin;
  const filesBase = `${site}/files/${slug}/`;
  const warnings = [];
  const isRelative = (u) => !/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(u);
  const absolute = (rel) => filesBase + rel.replace(/^\.\//, '');
  const still = (src) => {
    if (!isRelative(src)) return src;
    const png = src.replace(/\.svg$/i, '.png');
    if (png !== src && hasFile(png)) return absolute(png);
    if (/\.svg$/i.test(src)) warnings.push(`${src} has no PNG beside it; atproto readers get the SVG`);
    return absolute(src);
  };

  // Figures: marker, still, caption (three blocks; SCHEMA.md "Figures").
  const bs = blocks(body);
  const figs = [];
  for (let i = 0; i < bs.length; i++) {
    let marker = null;
    try { marker = parseFigureMarker(bs[i].text); } catch { marker = null; }
    if (!marker) continue;
    const img = bs[i + 1] && IMAGE.exec(bs[i + 1].text.trim());
    const cap = bs[i + 2] && /^\*\*Figure\b/.test(bs[i + 2].text.trim()) ? bs[i + 2] : null;
    if (!img || !cap) { warnings.push(`figure #${marker.id} isn't marker, still and caption; left as it is`); continue; }
    figs.push({ marker, markerBlock: bs[i], imgBlock: bs[i + 1], capBlock: cap, alt: img[1], src: img[2] });
  }

  let md = body; let plain = body;
  figs.forEach((f, k) => {
    const calc = f.marker.attrs.calc;
    const live = `${canonical}${calc ? `?calc=${encodeURIComponent(calc)}` : ''}#${f.marker.id}`;
    const caption = f.capBlock.text.trim();
    md = md.replace(f.markerBlock.text, '\u0000DROP\u0000')
      .replace(f.imgBlock.text, `![${f.alt}](${still(f.src)})`)
      .replace(f.capBlock.text, `${caption} [Interactive version →](${live})`);
    // In textContent: "[Figure 2 (interaction nets): Four views of running. Caption. Alt.]"
    const capText = stripMarkdown(caption);
    const m = /^Figure (\d+)\.\s+(.*?)(?:\s*\(([^)]+)\))?\.\s+([\s\S]*)$/.exec(capText);
    const head = m ? `Figure ${m[1]}${m[3] ? ` (${m[3]})` : ''}: ${m[2]}. ${m[4]}` : capText;
    plain = plain.replace(f.markerBlock.text, '').replace(f.imgBlock.text, '')
      .replace(f.capBlock.text, `\u0000FIG${k}\u0000`);
    f.text = `[${head.trim()} ${stripMarkdown(f.alt).trim()}]`;
  });
  md = md.replace(/\n*\u0000DROP\u0000\n*/g, '\n\n');

  // The page switch is the site's; other relative links and images point at the site's files.
  md = md.replace(/^<!--\s*page-switch\s*-->\s*$/gm, '')
    .replace(LINK, (all, bang, text, url, title) => {
      if (!isRelative(url)) return all;
      return `${bang}[${text}](${bang ? still(url) : absolute(url)}${title})`;
    });

  // Boxes (SCHEMA.md "Boxes") are the site's; here they stay quotations, opened, with their lead
  // in bold: "> [!THEOREM] The gap" → "> **Theorem. The gap**", "> [!DETAILS] Label" → "> **Label**".
  const BOX = /^(\s{0,3}>\s?)\[!(THEOREM|DETAILS|ESTABLISHED)\] (.+?)\s*$/gm;
  const lead = (kind, label) => (kind === 'THEOREM' ? `Theorem. ${label}` : label);
  md = md.replace(BOX, (all, q, kind, label) => `${q}**${lead(kind, label)}**`);
  plain = plain.replace(BOX, (all, q, kind, label) => {
    const l = lead(kind, label);
    return `${q}${/[.!?:]$/.test(l) ? l : `${l}.`}`;
  });

  // Math: Unicode where it's simple; otherwise TeX, said so. (Code is left alone.)
  const math = (text, report) => text.split(/(```[\s\S]*?```|`[^`\n]+`)/).map((part, i) => (i % 2 ? part : part
    .replace(/\$\$([\s\S]+?)\$\$/g, (all, tex) => {
      const u = texToUnicode(tex);
      if (u === null && report) warnings.push(`display formula stays as TeX: ${tex.trim().slice(0, 60)}`);
      return u === null ? all : u;
    })
    .replace(/(?<![\\$])\$(?!\$)([^$\n]+?)\$(?!\$)/g, (all, tex) => {
      const u = texToUnicode(tex);
      if (u === null && report) warnings.push(`inline formula stays as TeX: ${tex.trim().slice(0, 60)}`);
      return u === null ? all : u;
    }))).join('');
  md = math(md, true);
  plain = math(plain, false);

  md = md.replace(/\n{3,}/g, '\n\n').trim();
  let text = stripMarkdown(plain);
  figs.forEach((f, k) => { text = text.replace(`\u0000FIG${k}\u0000`, math(f.text, false)); });
  text = text.replace(/\s+/g, ' ').trim();
  return { markdown: md, textContent: text, warnings };
}
