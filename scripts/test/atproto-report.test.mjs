// The atproto copy of a research report (scripts/lib/atproto-report.mjs).
//   npm test   (node --test 'scripts/test/*.test.mjs')
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectReport, texToUnicode } from '../lib/atproto-report.mjs';

const body = `> **Abstract.** A report.

Three calculi, then the switch.

<!-- page-switch -->

<!-- figure #fig-runs component="runs" calc="net" -->

![Twelve circles joined by a green path.](assets/fig-runs.svg)

**Figure 2. Four views of running (interaction nets).** Each dot is a net, and $\\llbracket A \\to B \\rrbracket$ holds.

A type is a predicate:

$$
t \\in \\llbracket A \\rrbracket
$$
continues here, with a [read-aloud text](read-aloud.txt) and \`$not math$\` in code.

$$
\\frac{a}{b}
$$
`;
const canonical = 'https://maxine.science/research/thirds';

test('figures become their PNG still, their caption and a link to the live figure', () => {
  const r = projectReport({ slug: 'thirds', body, canonical, hasFile: (rel) => rel === 'assets/fig-runs.png' });
  assert.doesNotMatch(r.markdown, /<!--/);
  assert.match(r.markdown, /!\[Twelve circles joined by a green path\.\]\(https:\/\/maxine\.science\/files\/thirds\/assets\/fig-runs\.png\)/);
  assert.match(r.markdown, /holds\. \[Interactive version →\]\(https:\/\/maxine\.science\/research\/thirds\?calc=net#fig-runs\)/);
  assert.match(r.markdown, /\[read-aloud text\]\(https:\/\/maxine\.science\/files\/thirds\/read-aloud\.txt\)/);
  assert.match(r.textContent, /\[Figure 2 \(interaction nets\): Four views of running\. Each dot is a net, and ⟦A → B⟧ holds\. Twelve circles joined by a green path\.\]/);
});

test('simple math becomes Unicode; the rest stays TeX and is reported; code is left alone', () => {
  const r = projectReport({ slug: 'thirds', body, canonical });
  assert.match(r.markdown, /^t ∈ ⟦A⟧$/m);
  assert.match(r.markdown, /\$\$\n\\frac\{a\}\{b\}\n\$\$/);
  assert.match(r.markdown, /`\$not math\$`/);
  assert.deepEqual(r.warnings.filter((w) => /formula/.test(w)), ['display formula stays as TeX: \\frac{a}{b}']);
  assert.ok(r.warnings.some((w) => /fig-runs\.svg has no PNG/.test(w)), 'a figure without a PNG still is reported');
  assert.equal(texToUnicode('\\mathrm{Hom}(t, -) \\to \\Gamma'), 'Hom(t, -) → Γ');
  assert.equal(texToUnicode('x^2'), null);
});

test('boxes stay quotations, opened, with their lead in bold', () => {
  const body = '> [!THEOREM] The gap\n>\n> No price fits.\n\n> [!DETAILS] By level of support\n>\n> | Claim | Lean |\n> |---|---|\n> | a | b |\n\n> [!ESTABLISHED] What is established\n>\n> Older name.\n';
  const r = projectReport({ slug: 'x', body, canonical: 'https://maxine.science/research/x' });
  assert.doesNotMatch(r.markdown, /\[!/);
  assert.match(r.markdown, /^> \*\*Theorem\. The gap\*\*$/m);
  assert.match(r.markdown, /^> \*\*By level of support\*\*\n>\n> \| Claim \| Lean \|$/m);
  assert.match(r.markdown, /^> \*\*What is established\*\*$/m);
  assert.doesNotMatch(r.textContent, /\[!|\*\*/);
  assert.match(r.textContent, /^Theorem\. The gap\. No price fits\. By level of support\./);
});
