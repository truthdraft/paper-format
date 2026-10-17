import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocx } from '../docx-core.js';

function readStoredZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  assert.notEqual(end, -1, 'ZIP end record exists');
  const count = view.getUint16(end + 10, true), directory = view.getUint32(end + 16, true), files = new Map();
  let pos = directory;
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(pos, true), 0x02014b50, 'central directory entry is valid');
    const method = view.getUint16(pos + 10, true), size = view.getUint32(pos + 20, true), nameLen = view.getUint16(pos + 28, true), extraLen = view.getUint16(pos + 30, true), commentLen = view.getUint16(pos + 32, true), local = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nameLen));
    assert.equal(method, 0, 'generated package uses ZIP store entries');
    const localName = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true), start = local + 30 + localName + localExtra;
    files.set(name, new TextDecoder().decode(bytes.slice(start, start + size)));
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

test('creates an A4 IEEE conference DOCX package with the expected section flow', async () => {
  const paper = {
    title: 'Reliable Research Formatting',
    authors: [
      { name: 'Ada Example', affiliation: 'Example University, London, UK', email: 'ada@example.edu' },
      { name: 'Lin Sample', affiliation: 'Research Institute, Paris, France', email: '0000-0001-2345-6789' }
    ],
    abstract: 'A concise abstract for the test paper.', keywords: 'formatting, IEEE',
    sections: [{ heading: 'Introduction', text: 'A paper paragraph.\n\n## Related Work\nPrior studies [1].\n\n### Baseline\nA subsection.' }],
    acknowledgment: 'We thank our colleagues.', references: 'A. Example, “A sample,” Journal, 2024.'
  };
  const blob = makeDocx(paper);
  assert.match(blob.type, /wordprocessingml\.document/);
  const files = readStoredZip(new Uint8Array(await blob.arrayBuffer()));
  assert.ok(files.has('[Content_Types].xml'));
  assert.ok(files.has('_rels/.rels'));
  const xml = files.get('word/document.xml');
  assert.match(xml, /w:pgSz w:w="11906" w:h="16838"/);
  assert.match(xml, /w:pgMar w:top="1080" w:right="793" w:bottom="2440" w:left="793"/);
  assert.match(xml, /w:cols w:num="2" w:space="240"/);
  assert.match(xml, /Abstract—/);
  assert.match(xml, /Index Terms—/);
  assert.match(xml, /<w:rPr><w:b\/><w:i\/><\/w:rPr><w:t xml:space="preserve">Abstract—<\/w:t>/, 'the abstract label is bold italic');
  assert.match(xml, /<w:rPr><w:b\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><\/w:rPr><w:t xml:space="preserve">A concise abstract for the test paper\.<\/w:t>/, 'the abstract text uses IEEE conference bold styling');
  assert.match(xml, /Ada Example/);
  assert.match(xml, /Lin Sample/);
  assert.match(xml, /ACKNOWLEDGMENT/);
  assert.match(xml, /REFERENCES/);
  assert.ok(xml.indexOf('Ada Example') < xml.indexOf('Abstract—'), 'full-width author blocks precede the two-column abstract');
  assert.ok(xml.indexOf('Abstract—') < xml.indexOf('I. INTRODUCTION'), 'abstract precedes numbered body sections');
});

test('includes compiled figures, tables, and funding notes in the DOCX package', async () => {
  const figure = { id: 'fig1', caption: 'System overview', altText: 'A simple diagram', imageDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V4QAAAAASUVORK5CYII=' };
  const paper = { title: 'Rich Paper', authors: [{ name: 'Ada', affiliation: 'Institute' }], abstract: 'Summary.', keywords: 'one, two, three', funding: 'Supported by Example Grant.', sections: [{ heading: 'Method', text: `[[PAPER_EQUATION ${JSON.stringify({ label: '(1)', latex: 'x = y' })}]]`, figures: [figure], tables: [{ caption: 'Measurements', columns: ['Metric', 'Value'], rows: [['Accuracy', '99%']] }] }], references: '' };
  const files = readStoredZip(new Uint8Array(await makeDocx(paper).arrayBuffer()));
  const xml = files.get('word/document.xml');
  assert.match(xml, /Supported by Example Grant/);
  assert.match(xml, /x = y/);
  assert.match(xml, /System overview/);
  assert.match(xml, /Measurements/);
  assert.match(xml, /r:embed="rIdImage1"/);
  assert.ok(files.has('word/media/figure1.png'));
  assert.match(files.get('word/_rels/document.xml.rels'), /relationships\/image/);
});
