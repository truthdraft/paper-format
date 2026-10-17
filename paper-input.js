const emptyPaper = () => ({
  title: '', venue: '', year: String(new Date().getFullYear()),
  authors: [], abstract: '', keywords: '', sections: [], acknowledgment: '',
  funding: '', references: ''
});

const text = value => value == null ? '' : typeof value === 'string' ? value.trim() : String(value);
const headingText = (value, fallback) => text(value).replace(/^\s*(?:[IVXLCDM]+|\d+)\s*[.)-]\s*/i, '').trim() || fallback;
function blockMarker(type, value) { return `[[PAPER_${type.toUpperCase()} ${JSON.stringify(value)}]]`; }

function blocksToText(value) {
  if (typeof value === 'string') return value.trim();
  if (!Array.isArray(value)) return text(value?.text ?? value?.value ?? '');
  const output = [];
  for (const block of value) {
    if (typeof block === 'string') { if (block.trim()) output.push(block.trim()); continue; }
    if (!block || typeof block !== 'object') continue;
    const type = String(block.type ?? 'paragraph').toLowerCase();
    if (type === 'paragraph' || type === 'text') { if (text(block.text ?? block.content)) output.push(text(block.text ?? block.content)); }
    else if (type === 'subsection' || type === 'subsubsection') {
      const level = type === 'subsection' ? '##' : '###';
      const inner = blocksToText(block.content ?? block.paragraphs ?? block.text);
      if (text(block.heading)) output.push(`${level} ${text(block.heading)}${inner ? `\n${inner}` : ''}`);
    } else if (['equation', 'figure', 'table'].includes(type)) {
      const clean = Object.fromEntries(Object.entries(block).filter(([key]) => key !== 'type'));
      const hasData = type === 'equation' ? Boolean(text(clean.latex ?? clean.math ?? clean.text))
        : type === 'figure' ? Boolean(text(clean.caption) || text(clean.altText) || text(clean.imageDataUri ?? clean.dataUri))
          : Boolean(text(clean.caption) || clean.columns?.length || clean.rows?.length);
      if (hasData) output.push(blockMarker(type, clean));
    }
  }
  return output.join('\n\n');
}

function authorsOf(value) {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(a => a && (typeof a === 'string' || typeof a === 'object')).map(a => {
    if (typeof a === 'string') return { name: a.trim(), affiliation: '', email: '', orcid: '' };
    const affiliation = [a.department, a.institution ?? a.organization ?? a.affiliation, a.city, a.country].map(text).filter(Boolean).join(', ');
    return { name: text(a.name ?? a.fullName), affiliation: text(a.affiliation) || affiliation, email: text(a.email), orcid: text(a.orcid) };
  }).filter(a => a.name);
}

function referenceText(ref) {
  if (typeof ref === 'string') return ref.trim().replace(/^\s*\[\d+\]\s*/, '');
  if (!ref || typeof ref !== 'object') return '';
  const authors = Array.isArray(ref.authors) ? ref.authors.map(text).filter(Boolean).join(', ') : text(ref.authors);
  const title = text(ref.title);
  const publication = text(ref.publication ?? ref.journal ?? ref.conference ?? ref.bookTitle);
  const details = [ref.volume && `vol. ${text(ref.volume)}`, ref.issue && `no. ${text(ref.issue)}`, ref.pages && `pp. ${text(ref.pages)}`].filter(Boolean).join(', ');
  return [authors, title ? `“${title}”` : '', publication ? `in ${publication}` : '', details, text(ref.location), text(ref.publisher), text(ref.year), ref.doi ? `doi: ${text(ref.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}` : '', ref.url ? text(ref.url) : ''].filter(Boolean).join(', ');
}

function normalizePaper(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The JSON root must be an IEEE paper object.');
  const source = parsed.paper ?? parsed.document ?? parsed.manuscript ?? parsed;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('The JSON root must be an IEEE paper object.');
  const sections = (Array.isArray(source.sections) ? source.sections : Array.isArray(source.body?.sections) ? source.body.sections : [])
    .filter(s => typeof s === 'string' || (s && typeof s === 'object' && !Array.isArray(s)))
    .map((s, i) => typeof s === 'string' ? { heading: `Section ${i + 1}`, text: s, equations: [], figures: [], tables: [] } : ({
      heading: headingText(s.heading ?? s.title ?? s.name, `Section ${i + 1}`),
      text: blocksToText(s.content ?? s.blocks ?? s.text ?? s.paragraphs),
      equations: Array.isArray(s.equations) ? s.equations : [],
      figures: Array.isArray(s.figures) ? s.figures : [],
      tables: Array.isArray(s.tables) ? s.tables : []
    }));
  for (const [i, appendix] of (Array.isArray(source.appendices) ? source.appendices : []).entries()) {
    const content = blocksToText(appendix.content ?? appendix.paragraphs ?? appendix.text);
    if (content) sections.push({ heading: `Appendix ${String.fromCharCode(65 + i)}${appendix.heading ? `: ${text(appendix.heading)}` : ''}`, text: content, equations: [], figures: [], tables: [] });
  }
  const refs = source.references ?? source.referenceList ?? source.bibliography ?? [];
  const funding = source.funding;
  const fundingText = typeof funding === 'string' ? funding : funding && typeof funding === 'object'
    ? [funding.statement, funding.agency, funding.grantNumber && `Grant ${funding.grantNumber}`].map(text).filter(Boolean).join('. ')
    : '';
  return {
    ...emptyPaper(), title: text(source.title ?? source.paperTitle), venue: text(source.venue ?? source.conference), year: text(source.year) || emptyPaper().year,
    authors: authorsOf(source.authors ?? source.author), abstract: text(source.abstract), keywords: (Array.isArray(source.indexTerms ?? source.keywords) ? source.indexTerms ?? source.keywords : [source.indexTerms ?? source.keywords]).map(text).filter(Boolean).join(', '),
    sections, acknowledgment: text(source.acknowledgment ?? source.acknowledgements), funding: fundingText,
    references: (Array.isArray(refs) ? refs : String(refs).split(/\n+/)).map(referenceText).filter(Boolean).join('\n')
  };
}

export function compilePaperJson(input) {
  let raw = String(input ?? '').trim();
  if (!raw) throw new Error('Paste the completed paper JSON first.');
  const fenced = raw.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  if (fenced) raw = fenced[1].trim();
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (error) {
    const match = error.message.match(/position\s+(\d+)/i);
    const tokenMatch = error.message.match(/Unexpected token\s+['"]([^'"]+)['"]/i);
    const position = match ? Number(match[1]) : tokenMatch ? raw.indexOf(tokenMatch[1]) : error.message.includes('end of JSON') ? raw.length : -1;
    const before = position >= 0 ? raw.slice(0, position) : '';
    const line = before ? before.split('\n').length : null;
    const column = before ? before.length - before.lastIndexOf('\n') : null;
    throw new Error(line ? `Invalid JSON at line ${line}, column ${column}: ${error.message}` : `Invalid JSON: ${error.message}`);
  }
  const paper = normalizePaper(parsed);
  const errors = [];
  if (!paper.title) errors.push('Add a paper title.');
  if (!paper.authors.length) errors.push('Add at least one author with a name.');
  if (!paper.abstract) errors.push('Add the paper abstract.');
  if (!paper.sections.some(section => section.text.trim() || section.equations?.length || section.figures?.length || section.tables?.length)) errors.push('Add at least one non-empty paper section.');
  if (errors.length) throw new Error(`Paper JSON is missing required content: ${errors.join(' ')}`);
  return paper;
}
