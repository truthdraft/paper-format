import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('serves the editor, client logic, and styles over HTTP', async t => {
  const port = await freePort();
  const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  t.after(() => server.kill());
  const base = `http://127.0.0.1:${port}`;
  let response;
  for (let i = 0; i < 50; i++) {
    try { response = await fetch(base); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  assert.ok(response, 'server starts and accepts HTTP requests');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /IEEE conference · A4/);
  assert.match(html, /Completed paper JSON/);
  assert.match(html, /Compile paper/);
  assert.doesNotMatch(html, /Import \.docx/);
  assert.match(html, /ieee-a4-format\.json/);
  assert.match(html, /Paper preview/);
  assert.match(html, /TruthDraft/);
  assert.match(html, /app\.js/);
  const app = await fetch(`${base}/app.js`);
  assert.equal(app.status, 200);
  const script = await app.text();
  assert.match(script, /makeDocx/);
  assert.match(script, /docx-core\.js/);
  assert.match(script, /Citation \[\$\{n\}\] has no matching reference/);
  const core = await fetch(`${base}/docx-core.js`);
  assert.equal(core.status, 200);
  const parser = await fetch(`${base}/paper-input.js`);
  assert.equal(parser.status, 200);
  const format = await fetch(`${base}/ieee-a4-format.json`);
  assert.equal(format.status, 200);
  const schema = await format.json();
  assert.equal(schema.page.size, 'A4');
  assert.ok(schema.$comment);
  const css = await fetch(`${base}/styles.css`);
  assert.equal(css.status, 200);
  const logo = await fetch(`${base}/assets/truthdraft-mark.svg`);
  assert.equal(logo.status, 200);
  const font = await fetch(`${base}/assets/archivo-regular.woff2`);
  assert.equal(font.status, 200);
});
