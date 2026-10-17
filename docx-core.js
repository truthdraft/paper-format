// Dependency-free OOXML and ZIP creation for browser and Node.js verification.
const encoder = new TextEncoder();
const u16 = n => [n & 255, (n >>> 8) & 255];
const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
function crc32(bytes) { let c = -1; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ -1) >>> 0; }
function zip(files) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nm = encoder.encode(name), bytes = typeof content === 'string' ? encoder.encode(content) : content, crc = crc32(bytes);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(bytes.length), ...u32(bytes.length), ...u16(nm.length), ...u16(0), ...nm, ...bytes]);
    locals.push(local);
    const central = new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(bytes.length), ...u32(bytes.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nm]);
    centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((n, a) => n + a.length, 0), count = centrals.length;
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  return new Blob([...locals, ...centrals, end], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
const xesc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
function run(text, props = '') { return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xesc(text)}</w:t></w:r>`; }
function paragraph(text, { align = '', bold = false, italic = false, boldPrefix = '', boldItalicPrefix = '', italicPrefix = '', size, before, after, indent, hanging, keep = false } = {}) {
  const rpr = (bold ? '<w:b/>' : '') + (italic ? '<w:i/>' : '') + (size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : '');
  const ppr = `${align ? `<w:jc w:val="${align}"/>` : ''}${before || after ? `<w:spacing${before ? ` w:before="${before}"` : ''}${after ? ` w:after="${after}"` : ''}/>` : ''}${indent || hanging ? `<w:ind${indent ? ` w:firstLine="${indent}"` : ''}${hanging ? ` w:left="${hanging}" w:hanging="${hanging}"` : ''}/>` : ''}${keep ? '<w:keepNext/>' : ''}`;
  const content = (boldPrefix ? run(boldPrefix, '<w:b/>') : '') + (boldItalicPrefix ? run(boldItalicPrefix, '<w:b/><w:i/>') : '') + (italicPrefix ? run(italicPrefix, '<w:i/><w:b/>') : '') + run(text, rpr);
  return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${content}</w:p>`;
}
function normalizedParagraphs(source) {
  const output = [];
  for (const block of String(source || '').split(/\n\s*\n/).map(value => value.trim()).filter(Boolean)) {
    let lines = [];
    const flush = () => {
      const value = lines.join(' ').replace(/\s+/g, ' ').trim();
      if (value) output.push({ type: 'text', value });
      lines = [];
    };
    for (const line of block.split('\n').map(value => value.trim()).filter(Boolean)) {
      const marker = line.match(/^\[\[PAPER_(EQUATION|FIGURE|TABLE)\s+([\s\S]+)\]\]$/);
      const heading = line.match(/^(#{2,3})\s+(.+)$/);
      if (marker || heading) {
        flush();
        output.push(marker ? { type: 'marker', marker } : { type: 'heading', heading });
      } else lines.push(line);
    }
    flush();
  }
  return output;
}
function stripLeadingLabel(value, label) {
  return String(value || '').replace(new RegExp(`^\\s*${label}(?=$|\\s|[—–:-])\\s*(?:[—–:-]\\s*)?`, 'i'), '').trim();
}
function authorTable(authors) {
  const count = Math.min(3, Math.max(1, authors.length)), width = Math.floor(10320 / count);
  const columns = Array.from({ length: count }, (_, i) => `<w:gridCol w:w="${i === count - 1 ? 10320 - width * (count - 1) : width}"/>`).join('');
  const rows = [];
  for (let i = 0; i < authors.length; i += count) {
    const row = authors.slice(i, i + count); while (row.length < count) row.push(null);
    rows.push(`<w:tr>${row.map(author => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${author ? paragraph(author.name, { align: 'center', size: 18, after: 15, keep: true }) + paragraph(author.affiliation || '', { align: 'center', size: 20, after: 0 }) + paragraph(author.email || '', { align: 'center', size: 20, after: 20 }) : '<w:p/>'}</w:tc>`).join('')}</w:tr>`);
  }
  return `<w:tbl><w:tblPr><w:tblW w:w="10320" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid>${columns}</w:tblGrid>${rows.join('')}</w:tbl>`;
}
function wordTable(table) {
  const columns = Array.isArray(table.columns) ? table.columns.map(String) : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const allRows = [...(columns.length ? [columns] : []), ...rows];
  if (!allRows.length) return '';
  const count = Math.max(1, ...allRows.map(row => Array.isArray(row) ? row.length : 1));
  const width = Math.floor(10320 / count), grid = Array.from({ length: count }, () => `<w:gridCol w:w="${width}"/>`).join('');
  const xmlRows = allRows.map((row, ri) => {
    const cells = Array.isArray(row) ? row : [row];
    return `<w:tr>${Array.from({ length: count }, (_, ci) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraph(cells[ci] ?? '', { bold: Boolean(columns.length && ri === 0), size: 16, after: 20 })}</w:tc>`).join('')}</w:tr>`;
  }).join('');
  return `${table.caption ? paragraph(table.caption, { align: 'center', size: 16, before: 30, after: 25 }) : ''}<w:tbl><w:tblPr><w:tblW w:w="10320" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="777777"/><w:left w:val="single" w:sz="4" w:color="777777"/><w:bottom w:val="single" w:sz="4" w:color="777777"/><w:right w:val="single" w:sz="4" w:color="777777"/><w:insideH w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideV w:val="single" w:sz="4" w:color="BBBBBB"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${xmlRows}</w:tbl>`;
}
const roman = n => { const vals = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let out = ''; for (const [v, s] of vals) while (n >= v) { out += s; n -= v; } return out; };

export function makeDocx(paper) {
  const ps = [paragraph(paper.title || 'Untitled Paper', { align: 'center', size: 48, after: 250, keep: true })];
  const authors = (paper.authors || []).filter(a => a.name?.trim()); ps.push(authorTable(authors.length ? authors : [{ name: 'Author Name', affiliation: '', email: '' }]));
  if (paper.funding?.trim()) ps.push(paragraph(paper.funding, { size: 16, before: 35, after: 70 }));
  const media = {}, imageRelationships = [];
  function figureOutput(figure) {
    const caption = figure.caption ? paragraph(figure.caption, { align: 'center', size: 16, before: 15, after: 35 }) : '';
    const dataUri = String(figure.imageDataUri ?? figure.dataUri ?? '');
    const match = dataUri.match(/^data:image\/(png|jpeg);base64,([a-z\d+/]+=*)$/i);
    if (!match) return `${figure.altText ? paragraph(`[Figure image: ${figure.altText}]`, { align: 'center', size: 16, after: 20 }) : ''}${caption}`;
    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : 'png', index = imageRelationships.length + 1, file = `figure${index}.${ext}`, relId = `rIdImage${index}`;
    const binary = atob(match[2]), bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); media[`word/media/${file}`] = bytes;
    imageRelationships.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${file}"/>`);
    let ratio = 4 / 3;
    if (ext === 'png' && bytes.length > 24) { const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const w = view.getUint32(16, false), h = view.getUint32(20, false); if (w && h) ratio = w / h; }
    let cx = 3100000, cy = Math.round(cx / ratio);
    if (cy > 4200000) { cy = 4200000; cx = Math.round(cy * ratio); }
    cy = Math.max(250000, cy);
    const drawing = `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${index}" name="${xesc(figure.id || file)}" descr="${xesc(figure.altText || figure.caption || '')}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${index}" name="${xesc(file)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    return drawing + caption;
  }
  // IEEEtran conference title and author blocks span the full text width. Abstract starts in column one.
  ps.push('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="793" w:bottom="2440" w:left="793" w:header="360" w:footer="360" w:gutter="0"/><w:cols w:num="1" w:space="240"/></w:sectPr></w:pPr><w:r><w:rPr><w:vanish/><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r></w:p>');
  ps.push(paragraph(stripLeadingLabel(paper.abstract || '', 'Abstract'), { align: 'both', bold: true, boldItalicPrefix: 'Abstract—', size: 18, before: 300, after: 20 }));
  if (paper.keywords?.trim()) ps.push(paragraph(stripLeadingLabel(paper.keywords.split(',').map(x => x.trim()).filter(Boolean).join(', '), 'Index Terms'), { align: 'both', bold: true, italicPrefix: 'Index Terms—', size: 18, after: 55 }));
  for (let i = 0; i < (paper.sections || []).length; i++) {
    const section = paper.sections[i]; ps.push(paragraph(`${roman(i + 1)}. ${(section.heading || `Section ${i + 1}`).toUpperCase()}`, { align: 'center', bold: true, size: 20, before: 90, after: 55, keep: true }));
    let subsection = 0, subsubsection = 0;
    for (const item of normalizedParagraphs(section.text)) {
      if (item.type === 'marker') {
        const { marker } = item;
        try { const value = JSON.parse(marker[2]); if (marker[1] === 'EQUATION') ps.push(paragraph(`${value.latex ?? value.math ?? value.text ?? ''}${value.label ? `    ${value.label}` : ''}`, { align: 'center', italic: true, size: 18, before: 35, after: 35 })); else if (marker[1] === 'FIGURE') ps.push(figureOutput(value)); else ps.push(wordTable(value)); }
        catch { ps.push(paragraph(marker[0], { size: 20, after: 45 })); }
        continue;
      }
      if (item.type === 'heading') {
        const sub = item.heading;
        if (sub[1].length === 2) { subsection++; subsubsection = 0; ps.push(paragraph(`${String.fromCharCode(64 + Math.min(26, subsection))}. ${sub[2]}`, { align: 'left', italic: true, size: 20, before: 55, after: 35, keep: true })); }
        else { subsubsection++; ps.push(paragraph(`${subsubsection}) ${sub[2]}`, { align: 'left', italic: true, size: 20, before: 45, after: 30, keep: true })); }
        continue;
      }
      ps.push(paragraph(item.value, { align: 'both', size: 20, indent: 200 }));
    }
    for (const equation of section.equations || []) ps.push(paragraph(`${equation.latex ?? equation.math ?? equation.text ?? ''}${equation.label ? `    ${equation.label}` : ''}`, { align: 'center', italic: true, size: 18, before: 35, after: 35 }));
    for (const figure of section.figures || []) ps.push(figureOutput(figure));
    for (const table of section.tables || []) ps.push(wordTable(table));
  }
  if (paper.acknowledgment?.trim()) { ps.push(paragraph('ACKNOWLEDGMENT', { align: 'center', bold: true, size: 20, before: 90, after: 55, keep: true })); paper.acknowledgment.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).forEach(p => ps.push(paragraph(p, { align: 'both', size: 20, indent: 200 }))); }
  ps.push(paragraph('REFERENCES', { align: 'center', bold: true, size: 20, before: 90, after: 60, keep: true }));
  (paper.references || '').split(/\n+/).map(s => s.trim()).filter(Boolean).forEach((ref, i) => ps.push(paragraph(`[${i + 1}] ${ref}`, { align: 'both', size: 18, hanging: 240 })));
  const page = '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="793" w:bottom="2440" w:left="793" w:header="360" w:footer="360" w:gutter="0"/>';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${ps.join('')}<w:sectPr><w:type w:val="continuous"/>${page}<w:cols w:num="2" w:space="240"/></w:sectPr></w:body></w:document>`;
  const imageTypes = [...new Set(imageRelationships.map(rel => rel.match(/Target="media\/[^.]+\.(jpg|png)"/)?.[1]).filter(Boolean))].map(ext => `<Default Extension="${ext}" ContentType="image/${ext === 'jpg' ? 'jpeg' : 'png'}"/>`).join('');
  return zip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imageTypes}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${imageRelationships.join('')}</Relationships>`,
    'word/document.xml': document,
    'word/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>',
    ...media
  });
}
