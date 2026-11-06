import http from 'node:http';
import { renderOptions } from './render-options.mjs';
import { loadInput, InputError } from './input.mjs';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const port = Number(process.env.PORT || 3000);
const root = resolve('dist');
const browser = await chromium.launch({ headless: true, args: process.env.CHROMIUM_NO_SANDBOX === '1' ? ['--no-sandbox'] : [] });
let busy = false;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const fail = (status, message) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: message })); };
  if (req.method === 'GET' && url.pathname === '/health') { res.end('ok'); return; }
  if (req.method === 'POST' && url.pathname === '/render') {
    if (busy) { fail(503, 'Worker busy; retry later'); return; }
    busy = true;
    let context;
    try {
      const options = renderOptions(url.searchParams);
      const yaml = await loadInput(req);
      context = await browser.newContext(options);
      const page = await context.newPage();
      await page.route('**/*', route => new URL(route.request().url()).origin === `http://127.0.0.1:${port}` ? route.continue() : route.abort());
      await page.goto(`http://127.0.0.1:${port}/worker-render`);
      await page.waitForFunction(() => window.renderStatus === 'idle');
      await page.evaluate(yaml => window.renderCompose(yaml), yaml);
      await page.waitForFunction(() => ['ready', 'error'].includes(window.renderStatus), null, { timeout: 15000 });
      const error = await page.evaluate(() => window.renderError);
      if (error) { fail(422, error); return; }
      const png = await page.screenshot({ type: 'png', animations: 'disabled', scale: 'device' });
      res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(png);
    } catch (error) { fail(error instanceof InputError ? error.status : 500, error instanceof InputError ? error.message : 'Image rendering failed'); console.error(error); }
    finally { await context?.close(); busy = false; }
    return;
  }
  if (req.method !== 'GET') { fail(405, 'Method not allowed'); return; }
  const path = url.pathname === '/worker-render' ? '/index.html' : url.pathname;
  const file = resolve(root, '.' + path);
  if (!file.startsWith(root + '/')) { fail(404, 'Not found'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream' }); res.end(body);
  } catch { fail(404, 'Not found'); }
});
server.requestTimeout = 30000;
server.listen(port, '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); void browser.close().then(() => process.exit()); });
