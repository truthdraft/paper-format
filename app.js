import { makeDocx } from './docx-core.js';
import { compilePaperJson } from './paper-input.js';

const $ = selector => document.querySelector(selector);
let paper;
let compiled = false;
let toastTimer;

function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function words(value = '') { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function referenceList() { return paper.references.split(/\n+/).map(s => s.trim()).filter(Boolean); }
function safeImage(value) { return /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/]+=*$/i.test(String(value || '')) ? value : ''; }

function tableHtml(table) {
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const head = columns.length ? `<thead><tr>${columns.map(x => `<th>${escapeHtml(x)}</th>`).join('')}</tr></thead>` : '';
  const body = rows.map(row => `<tr>${(Array.isArray(row) ? row : [row]).map(x => `<td>${escapeHtml(x)}</td>`).join('')}</tr>`).join('');
  return `<figure class="paper-table-block">${table.caption ? `<figcaption>${escapeHtml(table.caption)}</figcaption>` : ''}<table>${head}<tbody>${body}</tbody></table></figure>`;
}
function richBlock(type, value) {
  if (type === 'equation') return `<div class="paper-equation">${value.label ? `<span class="equation-label">${escapeHtml(value.label)}</span>` : ''}<span>${escapeHtml(value.latex ?? value.math ?? value.text ?? '')}</span></div>`;
  if (type === 'figure') { const src = safeImage(value.imageDataUri ?? value.dataUri); return `<figure class="paper-figure">${src ? `<img src="${src}" alt="${escapeHtml(value.altText || value.caption || 'Paper figure')}">` : `<div class="figure-placeholder">${escapeHtml(value.altText || 'Figure image not embedded')}</div>`}${value.caption ? `<figcaption>${escapeHtml(value.caption)}</figcaption>` : ''}</figure>`; }
  if (type === 'table') return tableHtml(value);
  return '';
}
function markdownBlocks(source) {
  let subsection = 0, subsubsection = 0;
  return String(source || '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean).map(part => {
    const lines = part.split('\n'); let markup = '', paragraphLines = [];
    const flush = () => { if (paragraphLines.length) markup += `<p>${paragraphLines.map(escapeHtml).join('<br>')}</p>`; paragraphLines = []; };
    for (const line of lines) {
      const marker = line.match(/^\[\[PAPER_(EQUATION|FIGURE|TABLE)\s+([\s\S]+)\]\]$/);
      if (marker) { flush(); try { markup += richBlock(marker[1].toLowerCase(), JSON.parse(marker[2])); } catch { markup += `<p>${escapeHtml(line)}</p>`; } continue; }
      const heading = line.match(/^(#{2,3})\s+(.+)$/);
      if (heading?.[1].length === 2) { flush(); subsubsection = 0; subsection++; markup += `<h3>${String.fromCharCode(64 + Math.min(26, subsection))}. ${escapeHtml(heading[2].replace(/^(?:[A-Z]|\d+)[.)]\s*/, ''))}</h3>`; }
      else if (heading?.[1].length === 3) { flush(); subsubsection++; markup += `<h4>${subsubsection}) ${escapeHtml(heading[2].replace(/^(?:[A-Z]|\d+)[.)]\s*/, ''))}</h4>`; }
      else paragraphLines.push(line);
    }
    flush(); return markup;
  }).join('');
}
function renderPreview() {
  const authors = paper.authors.filter(a => a.name.trim());
  const authorBlocks = authors.map(a => `<div class="paper-author"><div class="paper-author-name">${escapeHtml(a.name)}</div>${a.affiliation ? `<div>${escapeHtml(a.affiliation)}</div>` : ''}${a.email ? `<div>${escapeHtml(a.email)}</div>` : ''}${a.orcid ? `<div>ORCID: ${escapeHtml(a.orcid)}</div>` : ''}</div>`).join('');
  const funding = paper.funding ? `<p class="paper-funding">${escapeHtml(paper.funding)}</p>` : '';
  const keywords = paper.keywords.split(',').map(x => x.trim()).filter(Boolean).join(', ');
  const sections = paper.sections.map((s, i) => {
    const extra = [...(s.equations || []).map(x => richBlock('equation', x)), ...(s.figures || []).map(x => richBlock('figure', x)), ...(s.tables || []).map(x => tableHtml(x))].join('');
    return `<section><h2>${roman(i + 1)}. ${escapeHtml(s.heading || `Section ${i + 1}`)}</h2>${markdownBlocks(s.text)}${extra}</section>`;
  }).join('');
  const ack = paper.acknowledgment.trim() ? `<section><h2>ACKNOWLEDGMENT</h2>${markdownBlocks(paper.acknowledgment)}</section>` : '';
  const references = referenceList().map((ref, i) => `<p class="paper-ref">[${i + 1}]&nbsp; ${escapeHtml(ref)}</p>`).join('');
  $('#paperContent').classList.remove('paper-empty');
  $('#paperContent').innerHTML = `<div class="paper-top"><div class="paper-title">${escapeHtml(paper.title)}</div><div class="paper-author-grid" style="--author-count:${Math.min(3, authors.length)}">${authorBlocks}</div>${funding}</div><div class="paper-body"><p class="paper-abstract"><b>Abstract—</b> ${escapeHtml(paper.abstract)}</p>${keywords ? `<p class="paper-keywords"><em><b>Index Terms—</b></em> ${escapeHtml(keywords)}</p>` : ''}${sections}${ack}<section><h2>REFERENCES</h2>${references}</section></div>`;
  const totalWords = words(paper.abstract) + words(paper.acknowledgment) + paper.sections.reduce((n, s) => n + words(s.text), 0) + referenceList().reduce((n, s) => n + words(s), 0);
  $('#pageEstimate').textContent = Math.max(1, Math.ceil(totalWords / 850));
}
function roman(n) { const vals = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let out = ''; for (const [v, s] of vals) while (n >= v) { out += s; n -= v; } return out; }
function validationNotes() {
  const warnings = [], count = words(paper.abstract);
  if (count > 250) warnings.push(`Abstract has ${count} words; IEEE guidance recommends no more than 250.`);
  if (/\[(?:\d+(?:\s*[-,;–]\s*\d+)*)\]/.test(paper.abstract)) warnings.push('Remove numbered citations from the abstract.');
  if (!paper.keywords.trim()) warnings.push('No Index Terms were provided.');
  else { const terms = paper.keywords.split(',').map(x => x.trim()).filter(Boolean); if (terms.length < 3 || terms.length > 5) warnings.push(`Found ${terms.length} Index Terms; IEEE Author Center guidance recommends 3–5.`); }
  if (!referenceList().length) warnings.push('No references were provided.');
  const citationText = paper.sections.map(s => s.text).join('\n');
  const cited = new Set((citationText.match(/\[(\d+(?:\s*[-–,;]\s*\d+)*)\]/g) || []).flatMap(c => c.slice(1, -1).split(/[,;]/).flatMap(part => { const range = part.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/); if (range) return Array.from({ length: Math.min(100, Number(range[2]) - Number(range[1]) + 1) }, (_, i) => Number(range[1]) + i); const n = Number(part.trim()); return n ? [n] : []; })));
  for (const n of cited) if (n > referenceList().length) warnings.push(`Citation [${n}] has no matching reference entry.`);
  return warnings;
}
function showCompileMessage(message, kind = 'info') { const el = $('#compileMessage'); el.textContent = message; el.className = `compile-message ${kind}`; }
function setSaveState(label, state) { $('#saveStatus').textContent = label; $('#saveDot').className = state; }
function compile() {
  try {
    paper = compilePaperJson($('#paperJson').value);
    renderPreview(); compiled = true; $('#downloadDocx').disabled = false;
    const warnings = validationNotes();
    $('#report').innerHTML = warnings.length ? `<div class="report-summary has-warnings"><span>◒</span><div><b>Compiled with ${warnings.length} review note${warnings.length === 1 ? '' : 's'}</b><small>Check these against your source paper and the target conference.</small></div></div><ul class="compile-warnings">${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : `<div class="report-summary is-ready"><span>✓</span><div><b>JSON compiled successfully</b><small>Required paper fields are present. Review the full preview before export.</small></div></div>`;
    $('#previewState').textContent = 'Compiled from paper JSON';
    showCompileMessage(`Compiled successfully · ${paper.sections.length} section${paper.sections.length === 1 ? '' : 's'} · ${paper.authors.length} author${paper.authors.length === 1 ? '' : 's'}`, warnings.length ? 'warn' : 'success');
    setSaveState('Compiled', 'is-compiled');
    try { localStorage.setItem('paperform-ieee-json-v1', $('#paperJson').value); } catch { /* local storage is optional */ }
  } catch (error) {
    compiled = false; $('#downloadDocx').disabled = true; setSaveState('Needs review', 'is-error');
    showCompileMessage(error.message, 'error');
    $('#report').innerHTML = `<div class="report-summary has-errors"><span>!</span><div><b>Compilation stopped</b><small>Fix the JSON syntax or required fields, then compile again.</small></div></div>`;
  }
}
function fileBase() { return (paper.title || 'ieee-a4-paper').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'ieee-a4-paper'; }
function download(content, type, name) { const blob = content instanceof Blob ? content : new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1200); }

$('#compilePaper').addEventListener('click', compile);
$('#paperJson').addEventListener('input', () => {
  compiled = false; $('#downloadDocx').disabled = true;
  setSaveState('Needs compile', 'is-dirty'); $('#previewState').textContent = 'JSON changed — compile to update preview';
  showCompileMessage('JSON changed. Compile again to refresh the preview.', 'info');
  try { localStorage.setItem('paperform-ieee-json-v1', $('#paperJson').value); } catch { /* local storage is optional */ }
});
$('#loadFormat').addEventListener('click', async () => {
  try { const response = await fetch('ieee-a4-format.json', { cache: 'no-store' }); if (!response.ok) throw new Error('Format file could not be loaded.'); $('#paperJson').value = await response.text(); $('#paperJson').dispatchEvent(new Event('input')); showToast('Format JSON loaded. Add source content, then send it to your AI.'); }
  catch (e) { showToast(e.message); }
});
$('#copyFormat').addEventListener('click', async () => {
  try { const response = await fetch('ieee-a4-format.json', { cache: 'no-store' }); if (!response.ok) throw new Error('Format file could not be loaded.'); await navigator.clipboard.writeText(await response.text()); showToast('Format JSON copied. Add your paper content before sending it to the AI.'); }
  catch { showToast('Use Download IEEE A4 JSON, then open and copy the file.'); }
});
$('#clearJson').addEventListener('click', () => { $('#paperJson').value = ''; $('#paperJson').dispatchEvent(new Event('input')); setSaveState('Ready', ''); $('#report').innerHTML = ''; $('#paperContent').className = 'paper-empty'; $('#paperContent').innerHTML = '<div class="empty-illustration" aria-hidden="true"><span class="empty-page"><i></i><i></i><i></i><i></i></span><span class="empty-spark">✳</span></div><b>Your paper will appear here</b><p>Paste the completed JSON and select <strong>Compile paper</strong> to build a side-by-side preview.</p><span class="empty-format">A4 · IEEE CONFERENCE</span>'; $('#pageEstimate').textContent = '—'; $('#previewState').textContent = 'Waiting for paper JSON'; $('#downloadDocx').disabled = true; });
$('#downloadDocx').addEventListener('click', () => { if (!compiled) return; try { download(makeDocx(paper), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', `${fileBase()}.docx`); showToast('A4 IEEE Word document downloaded.'); } catch (e) { showToast(`DOCX error: ${e.message}`); } });
$('#printPaper').addEventListener('click', () => { if (compiled) window.print(); else showToast('Compile paper JSON before printing.'); });
$('#zoomIn').addEventListener('click', () => zoom(0.05)); $('#zoomOut').addEventListener('click', () => zoom(-0.05));
function zoom(by) { const current = parseFloat(getComputedStyle($('#paper')).getPropertyValue('--paper-zoom')) || .8; const next = Math.max(.55, Math.min(1.1, current + by)); $('#paper').style.setProperty('--paper-zoom', next); $('#zoomLabel').textContent = `${Math.round(next * 100)}%`; }
function setTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  $('#themeButton').setAttribute('aria-pressed', String(isDark));
}
$('#themeButton').addEventListener('click', () => {
  const isDark = !document.documentElement.classList.contains('dark');
  setTheme(isDark);
  try { localStorage.setItem('truthdraft_theme', isDark ? 'dark' : 'light'); } catch { /* theme persistence is optional */ }
});
setTheme(document.documentElement.classList.contains('dark'));
function showToast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2700); }
function setInitialJson() { try { $('#paperJson').value = localStorage.getItem('paperform-ieee-json-v1') || ''; if ($('#paperJson').value) { setSaveState('Draft restored', 'is-dirty'); showCompileMessage('Restored your saved JSON. Compile it to render the paper.', 'info'); } } catch { /* local storage is optional */ } }
setInitialJson();
