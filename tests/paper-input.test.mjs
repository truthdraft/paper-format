import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compilePaperJson } from '../paper-input.js';

const valid = {
  $comment: 'AI instructions should never render.', format: 'IEEE conference', page: { size: 'A4' }, sourceContent: 'Original input, ignored by renderer.',
  title: 'Reliable A4 Paper', authors: [{ name: 'Ada Lovelace', department: 'Computing', institution: 'Analytical Institute', city: 'London', country: 'UK', email: 'ada@example.org', orcid: '0000-0000-0000-0000' }],
  abstract: 'A self-contained summary.', indexTerms: ['formatting', 'research', 'IEEE'],
  sections: [{ heading: 'I. Introduction', content: [{ type: 'paragraph', text: 'Opening paragraph.' }, { type: 'subsection', heading: 'Context', content: [{ type: 'paragraph', text: 'Background.' }] }, { type: 'equation', label: '(1)', latex: 'x = y' }, { type: 'table', caption: 'Results', columns: ['Metric', 'Value'], rows: [['Accuracy', '98%']] }] }],
  funding: { agency: 'Research Council', grantNumber: '42' }, acknowledgment: 'Thanks to colleagues.',
  references: [{ authors: 'A. Author', title: 'A paper', publication: 'Journal', year: 2024, doi: '10.1234/example' }], appendices: [{ heading: 'Proof', content: 'Additional details.' }]
};

test('loads the reusable format file and compiles a valid JSON paper', async () => {
  const template = JSON.parse(await readFile(new URL('../ieee-a4-format.json', import.meta.url), 'utf8'));
  assert.match(template.$comment, /Return only one valid JSON object/);
  assert.equal(template.page.size, 'A4');
  const paper = compilePaperJson(JSON.stringify(valid));
  assert.equal(paper.title, 'Reliable A4 Paper');
  assert.equal(paper.authors[0].affiliation, 'Computing, Analytical Institute, London, UK');
  assert.equal(paper.authors[0].orcid, '0000-0000-0000-0000');
  assert.equal(paper.keywords, 'formatting, research, IEEE');
  assert.match(paper.sections[0].text, /## Context/);
  assert.match(paper.sections[0].text, /\[\[PAPER_EQUATION/);
  assert.match(paper.sections[0].text, /\[\[PAPER_TABLE/);
  assert.equal(paper.sections[1].heading, 'Appendix A: Proof');
  assert.match(paper.funding, /Research Council/);
  assert.match(paper.references, /doi: 10\.1234\/example/);
  assert.doesNotMatch(JSON.stringify(paper), /AI instructions should never render|Original input/);
});

test('accepts a fenced JSON response from an AI', () => {
  const paper = compilePaperJson(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``);
  assert.equal(paper.title, valid.title);
});

test('gives useful line and column for invalid JSON', () => {
  assert.throws(() => compilePaperJson('{\n  "title":,\n}'), /Invalid JSON at line 2, column/);
});

test('blocks compilation when required paper content is absent', () => {
  assert.throws(() => compilePaperJson(JSON.stringify({ title: 'No author paper' })), /Add at least one author/);
});
